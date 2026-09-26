package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/handler/middleware"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	"github.com/rudra-netra/backend/internal/service"
	ws "github.com/rudra-netra/backend/internal/websocket"
)

// Dependencies bundles all services and repositories injected into handlers.
type Dependencies struct {
	Hub       *ws.Hub
	Logger    *zap.Logger
	Auth      *service.AuthService
	Users     *postgres.UserRepository
	Vehicles  *postgres.VehicleRepository
	Companies *postgres.CompanyRepository
	Pool      *pgxpool.Pool
}

var deps *Dependencies

// SetDependencies sets the global handler dependencies.
func SetDependencies(d *Dependencies) {
	deps = d
}

// ─── DB-only helpers ─────────────────────────────────────

// dbUnavailable reports (and answers with 503) when the database pool is absent.
// Every handler is database-backed; there is no in-memory fallback.
func dbUnavailable(c *gin.Context) bool {
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "database unavailable",
		})
		return true
	}
	return false
}

func serverError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
}

func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": msg})
}

// getEffectiveCompanyID resolves the tenant scope. SuperAdmins may target a
// tenant via ?company_id=; ordinary users are always scoped to their own JWT.
// No tenant is ever assumed: a missing scope returns 0 and the caller rejects it.
func getEffectiveCompanyID(c *gin.Context) int64 {
	companyID := c.GetInt64("company_id")
	userRole, _ := c.Get("role")

	if qCompany := c.Query("company_id"); qCompany != "" {
		if userRole == "superadmin" || companyID == 0 {
			if id, err := strconv.ParseInt(qCompany, 10, 64); err == nil && id > 0 {
				companyID = id
			}
		}
	}
	return companyID
}

// companyScope returns the effective tenant or writes a 400 response.
func companyScope(c *gin.Context) (int64, bool) {
	id := getEffectiveCompanyID(c)
	if id <= 0 {
		badRequest(c, "company scope is required: authenticate with a tenant user or pass company_id")
		return 0, false
	}
	return id, true
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return def
}

// fmtTime formats a nullable timestamp for the API (empty string when absent).
func fmtTime(t *time.Time, layout string) string {
	if t == nil {
		return ""
	}
	return t.Format(layout)
}

// ─── Auth Handlers ───────────────────────────────────────

func loginHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "invalid username or password format")
		return
	}

	tokens, user, err := deps.Auth.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil || tokens == nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid username or password"})
		return
	}

	companyName := ""
	if user.CompanyID > 0 {
		if comp, cErr := deps.Companies.GetByID(c.Request.Context(), user.CompanyID); cErr == nil && comp != nil {
			companyName = comp.Name
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"token":         tokens.AccessToken,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    tokens.ExpiresAt,
		"user": gin.H{
			"id":           user.ID,
			"username":     user.Username,
			"full_name":    user.FullName,
			"email":        user.Email,
			"role":         user.Role,
			"company_id":   user.CompanyID,
			"company_name": companyName,
		},
	})
}

func signupHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req domain.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "all required signup fields must be provided")
		return
	}
	if req.CompanyID <= 0 {
		badRequest(c, "company_id is required")
		return
	}
	if comp, err := deps.Companies.GetByID(c.Request.Context(), req.CompanyID); err != nil || comp == nil {
		badRequest(c, "unknown organization: provide a valid company_id")
		return
	}

	tokens, user, err := deps.Auth.Register(c.Request.Context(), req)
	if err != nil || tokens == nil || user == nil {
		msg := "registration failed"
		if err != nil {
			msg = err.Error()
		}
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": msg})
		return
	}

	companyName := ""
	if comp, cErr := deps.Companies.GetByID(c.Request.Context(), user.CompanyID); cErr == nil && comp != nil {
		companyName = comp.Name
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":       true,
		"token":         tokens.AccessToken,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    tokens.ExpiresAt,
		"user": gin.H{
			"id":           user.ID,
			"username":     user.Username,
			"full_name":    user.FullName,
			"email":        user.Email,
			"role":         user.Role,
			"company_id":   user.CompanyID,
			"company_name": companyName,
		},
	})
}

func listCompaniesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}

	query := `
		SELECT c.id, c.name, c.code,
		       COALESCE(c.contact_person, ''), COALESCE(c.email, ''), COALESCE(c.phone, ''),
		       COALESCE(c.database_name, ''), COALESCE(c.city, ''), COALESCE(c.address, ''),
		       CASE WHEN c.status = 1 THEN 'Active' ELSE 'Suspended' END,
		       TO_CHAR(c.created_at, 'YYYY-MM-DD'),
		       COALESCE(c.max_devices, 0), COALESCE(c.max_users, 0),
		       COALESCE(c.sira_relay, FALSE), COALESCE(c.api_key, ''),
		       (SELECT COUNT(*) FROM devices d WHERE d.company_id = c.id),
		       (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id)
		FROM companies c
		ORDER BY c.id ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type CompanyItem struct {
		ID            int64  `json:"id"`
		Name          string `json:"name"`
		Code          string `json:"code"`
		ContactPerson string `json:"contactPerson"`
		ContactEmail  string `json:"contactEmail"`
		ContactPhone  string `json:"contactPhone"`
		DBShard       string `json:"dbShard"`
		City          string `json:"city"`
		Address       string `json:"address"`
		Status        string `json:"status"`
		CreatedAt     string `json:"createdAt"`
		MaxDevices    int    `json:"maxDevices"`
		MaxUsers      int    `json:"maxUsers"`
		SIRARelay     bool   `json:"siraRelay"`
		APIKey        string `json:"apiKey"`
		Devices       int    `json:"devices"`
		Users         int    `json:"users"`
	}

	list := make([]CompanyItem, 0)
	for rows.Next() {
		var item CompanyItem
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Code, &item.ContactPerson, &item.ContactEmail,
			&item.ContactPhone, &item.DBShard, &item.City, &item.Address, &item.Status,
			&item.CreatedAt, &item.MaxDevices, &item.MaxUsers, &item.SIRARelay, &item.APIKey,
			&item.Devices, &item.Users,
		); err != nil {
			continue
		}
		list = append(list, item)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func refreshTokenHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.RefreshToken == "" {
		badRequest(c, "refresh_token is required")
		return
	}

	token, err := jwt.Parse(req.RefreshToken, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid or expired refresh token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid refresh token claims"})
		return
	}
	userID := int64(0)
	switch v := claims["user_id"].(type) {
	case float64:
		userID = int64(v)
	case json.Number:
		userID, _ = v.Int64()
	case string:
		userID, _ = strconv.ParseInt(v, 10, 64)
	}
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid refresh token subject"})
		return
	}

	user, err := deps.Users.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil || !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "user is no longer active"})
		return
	}

	tokens, err := deps.Auth.GenerateTokenPair(user)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"token":         tokens.AccessToken,
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"expires_at":    tokens.ExpiresAt,
	})
}

func changePasswordHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	userID := c.GetInt64("user_id")
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "authentication required"})
		return
	}
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.OldPassword == "" || len(req.NewPassword) < 8 {
		badRequest(c, "old_password and new_password (min 8 chars) are required")
		return
	}

	user, err := deps.Users.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		serverError(c, fmt.Errorf("user not found"))
		return
	}
	if !verifyPassword(user.PasswordHash, req.OldPassword) {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "current password is incorrect"})
		return
	}
	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		serverError(c, err)
		return
	}
	if err := deps.Users.UpdatePassword(c.Request.Context(), userID, hash); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "password updated"})
}

// ─── Tracking Handlers ──────────────────────────────────

func getPositionsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	vehicles, err := deps.Vehicles.ListByCompany(c.Request.Context(), companyID, 1000, 0)
	if err != nil {
		serverError(c, err)
		return
	}

	type PositionResponse struct {
		DeviceID     int64    `json:"device_id"`
		VehicleID    int64    `json:"vehicle_id"`
		RegNumber    string   `json:"reg_number"`
		Make         string   `json:"make"`
		Model        string   `json:"model"`
		DriverName   string   `json:"driver_name"`
		DriverPhone  string   `json:"driver_phone"`
		LocationName string   `json:"location_name,omitempty"`
		Lat          *float64 `json:"lat"`
		Lng          *float64 `json:"lng"`
		Speed        *float64 `json:"speed"`
		Heading      *float64 `json:"heading"`
		Ignition     *bool    `json:"ignition"`
		Status       string   `json:"status"`
		Temperature  *float64 `json:"temperature,omitempty"`
		Timestamp    string   `json:"timestamp"`
	}

	positions := make([]PositionResponse, 0, len(vehicles))
	for _, v := range vehicles {
		devID := v.ID
		if v.DeviceID != nil {
			devID = *v.DeviceID
		}
		ts := ""
		if v.Timestamp != nil {
			ts = v.Timestamp.Format(time.RFC3339)
		}
		positions = append(positions, PositionResponse{
			DeviceID:     devID,
			VehicleID:    v.ID,
			RegNumber:    v.RegNumber,
			Make:         v.Make,
			Model:        v.Model,
			DriverName:   v.DriverName,
			DriverPhone:  v.DriverPhone,
			LocationName: v.LocationName,
			Lat:          v.Lat,
			Lng:          v.Lng,
			Speed:        v.Speed,
			Heading:      v.Heading,
			Ignition:     v.Ignition,
			Status:       v.Status,
			Temperature:  v.Temperature,
			Timestamp:    ts,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"company_id": companyID,
		"count":      len(positions),
		"data":       positions,
	})
}

func getDevicePositionHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	deviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}

	query := `
		SELECT d.id, d.imei, COALESCE(v.id, 0), COALESCE(v.reg_number, ''),
		       ST_Y(p.location), ST_X(p.location), p.speed, p.heading, p.ignition, p.temperature, p.time
		FROM devices d
		LEFT JOIN vehicles v ON v.device_id = d.id
		LEFT JOIN LATERAL (
			SELECT location, speed, heading, ignition, temperature, time
			FROM positions WHERE device_id = d.id ORDER BY time DESC LIMIT 1
		) p ON TRUE
		WHERE d.id = $1 AND d.company_id = $2
	`
	var (
		id        int64
		imei      string
		vehicleID int64
		reg       string
		lat, lng  *float64
		speed     *float64
		heading   *float64
		ignition  *bool
		temp      *float64
		ts        *time.Time
	)
	if err := deps.Pool.QueryRow(c.Request.Context(), query, deviceID, companyID).Scan(
		&id, &imei, &vehicleID, &reg, &lat, &lng, &speed, &heading, &ignition, &temp, &ts,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found for this organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"device_id":   id,
			"imei":        imei,
			"vehicle_id":  vehicleID,
			"reg_number":  reg,
			"lat":         lat,
			"lng":         lng,
			"speed":       speed,
			"heading":     heading,
			"ignition":    ignition,
			"temperature": temp,
			"timestamp":   fmtTime(ts, time.RFC3339),
		},
	})
}

func getHistoryHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	param := c.Param("id")

	var vehicleID, deviceID int64
	var regNumber string
	vehQuery := `
		SELECT id, COALESCE(device_id, 0), reg_number
		FROM vehicles
		WHERE (id::text = $1 OR reg_number = $1) AND company_id = $2
		LIMIT 1
	`
	if err := deps.Pool.QueryRow(c.Request.Context(), vehQuery, param, companyID).Scan(&vehicleID, &deviceID, &regNumber); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found for this organization"})
		return
	}

	type HistoryPt struct {
		Lat   float64 `json:"lat"`
		Lng   float64 `json:"lng"`
		Speed float64 `json:"speed"`
		Time  string  `json:"time"`
		TS    string  `json:"timestamp"`
	}

	points := make([]HistoryPt, 0)
	if deviceID > 0 {
		posQuery := `
			SELECT ST_Y(location) AS lat, ST_X(location) AS lng, COALESCE(speed, 0), time
			FROM positions
			WHERE device_id = $1
			ORDER BY time ASC
			LIMIT 500
		`
		rows, err := deps.Pool.Query(c.Request.Context(), posQuery, deviceID)
		if err != nil {
			serverError(c, err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var pt HistoryPt
			var t time.Time
			if err := rows.Scan(&pt.Lat, &pt.Lng, &pt.Speed, &t); err == nil {
				pt.Time = t.Format("03:04 pm")
				pt.TS = t.Format(time.RFC3339)
				points = append(points, pt)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"company_id":   companyID,
		"vehicle_id":   vehicleID,
		"reg_number":   regNumber,
		"total_points": len(points),
		"data":         points,
	})
}

func getClustersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	query := `
		SELECT ROUND(ST_Y(p.location)::numeric, 2)::float8 AS lat,
		       ROUND(ST_X(p.location)::numeric, 2)::float8 AS lng,
		       COUNT(*) AS vehicles
		FROM vehicles v
		JOIN LATERAL (
			SELECT location FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
		) p ON TRUE
		WHERE v.company_id = $1
		GROUP BY 1, 2
		ORDER BY vehicles DESC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type Cluster struct {
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
		Vehicles int64   `json:"vehicles"`
	}
	clusters := make([]Cluster, 0)
	for rows.Next() {
		var cl Cluster
		if err := rows.Scan(&cl.Lat, &cl.Lng, &cl.Vehicles); err == nil {
			clusters = append(clusters, cl)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": clusters})
}

// ─── Device Handlers ─────────────────────────────────────

func listDevicesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	query := `
		SELECT d.id, d.imei, COALESCE(d.device_type, ''), COALESCE(d.sim_no, ''),
		       COALESCE(d.port, 0), COALESCE(d.status, ''), d.warranty_end,
		       COALESCE(d.firmware_ver, ''), COALESCE(d.sim_operator, ''), d.last_heartbeat,
		       COALESCE(v.reg_number, '')
		FROM devices d
		LEFT JOIN vehicles v ON v.device_id = d.id AND v.company_id = d.company_id
		WHERE d.company_id = $1
		ORDER BY d.id ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type DevResp struct {
		ID              int64  `json:"id"`
		IMEI            string `json:"imei"`
		Protocol        string `json:"protocol"`
		SimNo           string `json:"simNo"`
		Port            int    `json:"port"`
		Status          string `json:"status"`
		WarrantyEnd     string `json:"warrantyEnd"`
		Firmware        string `json:"firmware"`
		SimOperator     string `json:"simOperator"`
		LastHeartbeat   string `json:"lastHeartbeat"`
		AssignedVehicle string `json:"assignedVehicle"`
	}

	list := make([]DevResp, 0)
	for rows.Next() {
		var d DevResp
		var warranty, heartbeat *time.Time
		if err := rows.Scan(&d.ID, &d.IMEI, &d.Protocol, &d.SimNo, &d.Port, &d.Status,
			&warranty, &d.Firmware, &d.SimOperator, &heartbeat, &d.AssignedVehicle); err != nil {
			continue
		}
		d.WarrantyEnd = fmtTime(warranty, "2006-01-02")
		d.LastHeartbeat = fmtTime(heartbeat, time.RFC3339)
		list = append(list, d)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}

	query := `
		SELECT d.id, d.imei, COALESCE(d.device_type, ''), COALESCE(d.sim_no, ''),
		       COALESCE(d.port, 0), COALESCE(d.status, ''), d.warranty_end,
		       COALESCE(d.firmware_ver, ''), COALESCE(d.sim_operator, ''), d.last_heartbeat,
		       COALESCE(v.id, 0), COALESCE(v.reg_number, '')
		FROM devices d
		LEFT JOIN vehicles v ON v.device_id = d.id AND v.company_id = d.company_id
		WHERE d.id = $1 AND d.company_id = $2
	`
	var (
		id2, vehicleID   int64
		imei, dtype, sim string
		port             int
		status, firmware string
		simOperator      string
		warranty, hb     *time.Time
		reg              string
	)
	if err := deps.Pool.QueryRow(c.Request.Context(), query, id, companyID).Scan(
		&id2, &imei, &dtype, &sim, &port, &status, &warranty, &firmware, &simOperator, &hb, &vehicleID, &reg,
	); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found for this organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"id": id2, "imei": imei, "device_type": dtype, "simNo": sim, "port": port,
		"status": status, "warrantyEnd": fmtTime(warranty, "2006-01-02"),
		"firmware": firmware, "simOperator": simOperator,
		"lastHeartbeat": fmtTime(hb, time.RFC3339),
		"vehicleId":     vehicleID, "assignedVehicle": reg,
	}})
}

// createDeviceHandler registers a tracker. Unspecified columns are left to the
// database defaults; no protocol/port/warranty values are invented here.
func createDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	var req struct {
		IMEI            string `json:"imei"`
		Protocol        string `json:"protocol"`
		SimNo           string `json:"simNo"`
		SimOperator     string `json:"simOperator"`
		Port            int    `json:"port"`
		Firmware        string `json:"firmware"`
		WarrantyEnd     string `json:"warrantyEnd"`
		AssignedVehicle string `json:"assignedVehicle"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.IMEI) == "" {
		badRequest(c, "imei is required")
		return
	}

	var newID int64
	if err := deps.Pool.QueryRow(c.Request.Context(),
		"INSERT INTO devices (company_id, imei) VALUES ($1, $2) RETURNING id",
		companyID, req.IMEI).Scan(&newID); err != nil {
		serverError(c, err)
		return
	}

	var warranty *time.Time
	if req.WarrantyEnd != "" {
		if t, err := time.Parse("2006-01-02", req.WarrantyEnd); err == nil {
			warranty = &t
		}
	}
	_, _ = deps.Pool.Exec(c.Request.Context(), `
		UPDATE devices SET
			device_type  = COALESCE(NULLIF($1, ''), device_type),
			sim_no       = COALESCE(NULLIF($2, ''), sim_no),
			sim_operator = COALESCE(NULLIF($3, ''), sim_operator),
			port         = CASE WHEN $4 > 0 THEN $4 ELSE port END,
			firmware_ver = COALESCE(NULLIF($5, ''), firmware_ver),
			warranty_end = COALESCE($6, warranty_end),
			updated_at   = NOW()
		WHERE id = $7
	`, req.Protocol, req.SimNo, req.SimOperator, req.Port, req.Firmware, warranty, newID)

	if req.AssignedVehicle != "" {
		_, _ = deps.Pool.Exec(c.Request.Context(),
			"UPDATE vehicles SET device_id = $1, updated_at = NOW() WHERE reg_number = $2 AND company_id = $3",
			newID, req.AssignedVehicle, companyID)
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Device registered successfully"})
}

func updateDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}

	var req struct {
		Protocol    string `json:"protocol"`
		SimNo       string `json:"simNo"`
		SimOperator string `json:"simOperator"`
		Port        int    `json:"port"`
		Status      string `json:"status"`
		Firmware    string `json:"firmware"`
		WarrantyEnd string `json:"warrantyEnd"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	var warranty *time.Time
	if req.WarrantyEnd != "" {
		if t, err := time.Parse("2006-01-02", req.WarrantyEnd); err == nil {
			warranty = &t
		}
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE devices SET
			device_type  = COALESCE(NULLIF($1, ''), device_type),
			sim_no       = COALESCE(NULLIF($2, ''), sim_no),
			sim_operator = COALESCE(NULLIF($3, ''), sim_operator),
			port         = CASE WHEN $4 > 0 THEN $4 ELSE port END,
			status       = COALESCE(NULLIF($5, ''), status),
			firmware_ver = COALESCE(NULLIF($6, ''), firmware_ver),
			warranty_end = COALESCE($7, warranty_end),
			updated_at   = NOW()
		WHERE id = $8 AND company_id = $9
	`, req.Protocol, req.SimNo, req.SimOperator, req.Port, req.Status, req.Firmware, warranty, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device updated"})
}

func deleteDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM devices WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device deleted"})
}

func assignDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}
	var req struct {
		VehicleID  int64  `json:"vehicleId"`
		VehicleReg string `json:"vehicleReg"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	var vehicleID int64
	if req.VehicleID > 0 {
		vehicleID = req.VehicleID
	} else if req.VehicleReg != "" {
		if err := deps.Pool.QueryRow(c.Request.Context(),
			"SELECT id FROM vehicles WHERE reg_number = $1 AND company_id = $2",
			req.VehicleReg, companyID).Scan(&vehicleID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found"})
			return
		}
	} else {
		badRequest(c, "vehicleId or vehicleReg is required")
		return
	}

	ctx := c.Request.Context()
	tx, err := deps.Pool.Begin(ctx)
	if err != nil {
		serverError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, "UPDATE vehicles SET device_id = NULL WHERE device_id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	tag, err := tx.Exec(ctx, "UPDATE vehicles SET device_id = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3", id, vehicleID, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device assigned to vehicle"})
}

func getDeviceConfigHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}

	var (
		port     int
		protocol string
		firmware string
		status   string
	)
	if err := deps.Pool.QueryRow(c.Request.Context(), `
		SELECT COALESCE(port, 0), COALESCE(device_type, ''), COALESCE(firmware_ver, ''), COALESCE(status, '')
		FROM devices WHERE id = $1 AND company_id = $2
	`, id, companyID).Scan(&port, &protocol, &firmware, &status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found for this organization"})
		return
	}

	var (
		idleThreshold, speedThreshold int
		timezone, language            string
	)
	_ = deps.Pool.QueryRow(c.Request.Context(), `
		SELECT COALESCE(idle_threshold_minutes, 0), COALESCE(speed_threshold_kmh, 0),
		       COALESCE(timezone, ''), COALESCE(language, '')
		FROM company_settings WHERE company_id = $1
	`, companyID).Scan(&idleThreshold, &speedThreshold, &timezone, &language)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"id": id, "port": port, "protocol": protocol, "firmware": firmware,
		"status": status,
		"settings": gin.H{
			"idleThresholdMinutes": idleThreshold,
			"speedThresholdKmh":    speedThreshold,
			"timezone":             timezone,
			"language":             language,
		},
	}})
}

func updateDeviceConfigHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}
	var req struct {
		Protocol       string `json:"protocol"`
		Firmware       string `json:"firmware"`
		Port           int    `json:"port"`
		IdleMinutes    int    `json:"idleThresholdMinutes"`
		SpeedThreshold int    `json:"speedThresholdKmh"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	_, err = deps.Pool.Exec(c.Request.Context(), `
		UPDATE devices SET
			device_type  = COALESCE(NULLIF($1, ''), device_type),
			firmware_ver = COALESCE(NULLIF($2, ''), firmware_ver),
			port         = CASE WHEN $3 > 0 THEN $3 ELSE port END,
			updated_at   = NOW()
		WHERE id = $4 AND company_id = $5
	`, req.Protocol, req.Firmware, req.Port, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if req.IdleMinutes > 0 || req.SpeedThreshold > 0 {
		_, _ = deps.Pool.Exec(c.Request.Context(), `
			UPDATE company_settings SET
				idle_threshold_minutes = CASE WHEN $1 > 0 THEN $1 ELSE idle_threshold_minutes END,
				speed_threshold_kmh    = CASE WHEN $2 > 0 THEN $2 ELSE speed_threshold_kmh END,
				updated_at = NOW()
			WHERE company_id = $3
		`, req.IdleMinutes, req.SpeedThreshold, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device configuration updated"})
}

// ─── Vehicle Handlers ────────────────────────────────────

func listVehiclesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	limit := atoiDefault(c.Query("limit"), 500)
	offset := atoiDefault(c.Query("offset"), 0)
	if limit <= 0 || limit > 1000 {
		limit = 500
	}

	vehicles, err := deps.Vehicles.ListByCompany(c.Request.Context(), companyID, limit, offset)
	if err != nil {
		serverError(c, err)
		return
	}
	total, err := deps.Vehicles.CountByCompany(c.Request.Context(), companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if vehicles == nil {
		vehicles = []domain.VehicleWithTelemetry{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"company_id": companyID,
		"total":      total,
		"count":      len(vehicles),
		"data":       vehicles,
	})
}

func getVehicleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid vehicle id")
		return
	}

	v, err := deps.Vehicles.GetByID(c.Request.Context(), id, companyID)
	if err != nil || v == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": v})
}

func createVehicleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	var req struct {
		RegNumber    string  `json:"regNumber"`
		Make         string  `json:"make"`
		Model        string  `json:"model"`
		Variant      string  `json:"variant"`
		BodyType     string  `json:"bodyType"`
		FuelType     string  `json:"fuelType"`
		FuelCapacity float64 `json:"fuelCapacity"`
		MaxSpeed     int     `json:"maxSpeed"`
		Odometer     int64   `json:"odometer"`
		IconType     string  `json:"iconType"`
		DeviceID     int64   `json:"deviceId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.RegNumber) == "" {
		badRequest(c, "regNumber is required")
		return
	}

	query := `
		INSERT INTO vehicles (company_id, reg_number, make, model, variant, body_type, fuel_type, fuel_capacity, max_speed, odometer, icon_type, device_id)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, 0), NULLIF($9, 0), $10, NULLIF($11, ''), NULLIF($12, 0))
		RETURNING id
	`
	var deviceID *int64
	if req.DeviceID > 0 {
		deviceID = &req.DeviceID
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query,
		companyID, req.RegNumber, req.Make, req.Model, req.Variant, req.BodyType, req.FuelType,
		req.FuelCapacity, req.MaxSpeed, req.Odometer, req.IconType, deviceID).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Vehicle created successfully"})
}

func updateVehicleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid vehicle id")
		return
	}

	var req struct {
		RegNumber    string  `json:"regNumber"`
		Make         string  `json:"make"`
		Model        string  `json:"model"`
		Variant      string  `json:"variant"`
		BodyType     string  `json:"bodyType"`
		FuelType     string  `json:"fuelType"`
		FuelCapacity float64 `json:"fuelCapacity"`
		MaxSpeed     int     `json:"maxSpeed"`
		Odometer     int64   `json:"odometer"`
		IconType     string  `json:"iconType"`
		DeviceID     int64   `json:"deviceId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE vehicles SET
			reg_number    = COALESCE(NULLIF($1, ''), reg_number),
			make          = COALESCE(NULLIF($2, ''), make),
			model         = COALESCE(NULLIF($3, ''), model),
			variant       = COALESCE(NULLIF($4, ''), variant),
			body_type     = COALESCE(NULLIF($5, ''), body_type),
			fuel_type     = COALESCE(NULLIF($6, ''), fuel_type),
			fuel_capacity = CASE WHEN $7 > 0 THEN $7 ELSE fuel_capacity END,
			max_speed     = CASE WHEN $8 > 0 THEN $8 ELSE max_speed END,
			odometer      = CASE WHEN $9 > 0 THEN $9 ELSE odometer END,
			icon_type     = COALESCE(NULLIF($10, ''), icon_type),
			device_id     = COALESCE(NULLIF($11, 0), device_id),
			updated_at    = NOW()
		WHERE id = $12 AND company_id = $13
	`, req.RegNumber, req.Make, req.Model, req.Variant, req.BodyType, req.FuelType,
		req.FuelCapacity, req.MaxSpeed, req.Odometer, req.IconType, req.DeviceID, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Vehicle updated"})
}

func updateVehicleConfigHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid vehicle id")
		return
	}
	var req struct {
		MaxSpeed     int     `json:"maxSpeed"`
		FuelCapacity float64 `json:"fuelCapacity"`
		IconType     string  `json:"iconType"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	_, err = deps.Pool.Exec(c.Request.Context(), `
		UPDATE vehicles SET
			max_speed     = CASE WHEN $1 > 0 THEN $1 ELSE max_speed END,
			fuel_capacity = CASE WHEN $2 > 0 THEN $2 ELSE fuel_capacity END,
			icon_type     = COALESCE(NULLIF($3, ''), icon_type),
			updated_at    = NOW()
		WHERE id = $4 AND company_id = $5
	`, req.MaxSpeed, req.FuelCapacity, req.IconType, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Vehicle configuration updated"})
}

// getVehicleLogsHandler returns Teltonika AVL telemetry straight from the
// positions hypertable. Sensor values (fuel, batteries, door) are read from
// the database; nothing is synthesised when a column is NULL.
func getVehicleLogsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	param := c.Param("id")
	limit := atoiDefault(c.Query("limit"), 60)
	if limit <= 0 || limit > 500 {
		limit = 60
	}

	type TeltonikaLogRecord struct {
		ID            int      `json:"id"`
		Time          string   `json:"time"`
		TimeStr       string   `json:"time_str"`
		DateStr       string   `json:"date_str"`
		IntervalStr   string   `json:"interval_str"`
		DeltaSeconds  int64    `json:"delta_seconds"`
		Speed         float64  `json:"speed"`
		Temp          *float64 `json:"temp"`
		FuelPct       *float64 `json:"fuel_pct"`
		FuelLiters    *float64 `json:"fuel_liters"`
		ExtBattery    *float64 `json:"ext_battery"`
		BackupBattery *float64 `json:"backup_battery"`
		Ignition      string   `json:"ignition"`
		Door          string   `json:"door"`
		Lat           float64  `json:"lat"`
		Lng           float64  `json:"lng"`
		Altitude      float64  `json:"altitude"`
		Satellites    int      `json:"satellites"`
		Heading       float64  `json:"heading"`
		Odometer      int64    `json:"odometer"`
		Trigger       string   `json:"trigger"`
		Status        string   `json:"status"`
	}

	// 1. Resolve vehicle and device
	var (
		vehicleID, deviceID       int64
		regNumber, makeStr, model string
		fuelCapacity              float64
		maxSpeed                  int
	)
	vehQuery := `
		SELECT id, COALESCE(device_id, 0), reg_number, COALESCE(make, ''), COALESCE(model, ''),
		       COALESCE(fuel_capacity, 0), COALESCE(max_speed, 0)
		FROM vehicles
		WHERE (id::text = $1 OR reg_number = $1 OR device_id::text = $1) AND company_id = $2
		LIMIT 1
	`
	err := deps.Pool.QueryRow(c.Request.Context(), vehQuery, param, companyID).Scan(
		&vehicleID, &deviceID, &regNumber, &makeStr, &model, &fuelCapacity, &maxSpeed,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found for this organization"})
		return
	}

	// Device metadata for the telematics panel
	deviceInfo := gin.H{}
	if deviceID > 0 {
		var (
			imei, dtype, simNo, simOperator, firmware, status string
			port                                              int
			hb                                                *time.Time
		)
		if err := deps.Pool.QueryRow(c.Request.Context(), `
			SELECT imei, COALESCE(device_type, ''), COALESCE(sim_no, ''), COALESCE(sim_operator, ''),
			       COALESCE(port, 0), COALESCE(firmware_ver, ''), COALESCE(status, ''), last_heartbeat
			FROM devices WHERE id = $1
		`, deviceID).Scan(&imei, &dtype, &simNo, &simOperator, &port, &firmware, &status, &hb); err == nil {
			deviceInfo = gin.H{
				"id": deviceID, "imei": imei, "device_type": dtype, "sim_no": simNo,
				"sim_operator": simOperator, "port": port, "firmware": firmware,
				"status": status, "last_heartbeat": fmtTime(hb, time.RFC3339),
			}
		}
	}

	// Company thresholds are stored configuration
	speedLimit := maxSpeed
	idleMinutes := 0
	var (
		speedThreshold, idleThreshold int
	)
	if err := deps.Pool.QueryRow(c.Request.Context(), `
		SELECT speed_threshold_kmh, idle_threshold_minutes FROM company_settings WHERE company_id = $1
	`, companyID).Scan(&speedThreshold, &idleThreshold); err == nil {
		if speedThreshold > 0 {
			speedLimit = speedThreshold
		}
		idleMinutes = idleThreshold
	}

	records := make([]TeltonikaLogRecord, 0, limit)
	if deviceID > 0 {
		posQuery := `
			SELECT time, ST_Y(location), ST_X(location), COALESCE(speed, 0), COALESCE(heading, 0),
			       COALESCE(altitude, 0), COALESCE(satellites, 0), ignition, voltage, temperature,
			       COALESCE(odometer, 0), fuel_level_pct, backup_battery_v, door_open
			FROM positions
			WHERE device_id = $1
			ORDER BY time DESC
			LIMIT $2
		`
		rows, err := deps.Pool.Query(c.Request.Context(), posQuery, deviceID, limit)
		if err != nil {
			serverError(c, err)
			return
		}
		defer rows.Close()

		idx := 0
		for rows.Next() {
			var (
				t          time.Time
				lat, lng   float64
				speed      float64
				head, alt  float64
				sats       int
				ign        *bool
				volt       *float64
				temp       *float64
				odo        int64
				fuelPct    *float64
				backupBatt *float64
				doorOpen   *bool
			)
			if err := rows.Scan(&t, &lat, &lng, &speed, &head, &alt, &sats, &ign, &volt, &temp,
				&odo, &fuelPct, &backupBatt, &doorOpen); err != nil {
				continue
			}

			ignStr := "OFF"
			if ign != nil && *ign {
				ignStr = "ON"
			}
			doorStr := ""
			if doorOpen != nil {
				if *doorOpen {
					doorStr = "Open"
				} else {
					doorStr = "Closed"
				}
			}

			var fuelLiters *float64
			if fuelPct != nil && fuelCapacity > 0 {
				v := *fuelPct / 100.0 * fuelCapacity
				fuelLiters = &v
			}

			status := "normal"
			trigger := "Periodic AVL Record"
			if speedLimit > 0 && speed > float64(speedLimit) {
				status = "alert"
				trigger = fmt.Sprintf("Overspeed (%.0f km/h > %d km/h)", speed, speedLimit)
			} else if temp != nil && *temp <= 0 {
				trigger = fmt.Sprintf("Reefer Monitoring (%.1f°C)", *temp)
			}

			records = append(records, TeltonikaLogRecord{
				ID: idx, Time: t.Format(time.RFC3339), TimeStr: t.UTC().Format("15:04:05"),
				DateStr: t.UTC().Format("2006-01-02"), Speed: speed, Temp: temp,
				FuelPct: fuelPct, FuelLiters: fuelLiters, ExtBattery: volt, BackupBattery: backupBatt,
				Ignition: ignStr, Door: doorStr, Lat: lat, Lng: lng, Altitude: alt,
				Satellites: sats, Heading: head, Odometer: odo, Trigger: trigger, Status: status,
			})
			idx++
		}
	}

	// Interval deltas and trigger labels are derived from real timestamps.
	for i := range records {
		if i < len(records)-1 {
			ta, _ := time.Parse(time.RFC3339, records[i].Time)
			tb, _ := time.Parse(time.RFC3339, records[i+1].Time)
			diffSec := int64(ta.Sub(tb).Seconds())
			if diffSec < 0 {
				diffSec = -diffSec
			}
			records[i].DeltaSeconds = diffSec

			switch {
			case diffSec == 0:
				records[i].IntervalStr = "0s (Sync)"
			case diffSec < 60:
				records[i].IntervalStr = fmt.Sprintf("+%ds", diffSec)
			case diffSec < 3600:
				records[i].IntervalStr = fmt.Sprintf("+%dm %02ds", diffSec/60, diffSec%60)
			case diffSec < 86400:
				records[i].IntervalStr = fmt.Sprintf("+%dh %02dm", diffSec/3600, (diffSec%3600)/60)
			default:
				records[i].IntervalStr = fmt.Sprintf("+%dd %02dh", diffSec/86400, (diffSec%86400)/3600)
			}
			if i == 0 {
				records[i].IntervalStr = "Latest (" + records[i].IntervalStr + ")"
			}
		} else {
			records[i].DeltaSeconds = 0
			if len(records) == 1 {
				records[i].IntervalStr = "Single Ping"
			} else {
				records[i].IntervalStr = "Base Record"
			}
		}

		if records[i].Status != "alert" {
			if records[i].Speed <= 2 && idleMinutes > 0 && records[i].DeltaSeconds >= int64(idleMinutes)*60 {
				records[i].Trigger = fmt.Sprintf("Idle Stationary Ping (%s)", records[i].IntervalStr)
			} else if records[i].DeltaSeconds > 0 && records[i].DeltaSeconds <= 75 {
				records[i].Trigger = fmt.Sprintf("Periodic AVL Record (%s)", records[i].IntervalStr)
			} else if records[i].DeltaSeconds > 75 {
				records[i].Trigger = fmt.Sprintf("Stationary Ping (%s)", records[i].IntervalStr)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"vehicle_id": vehicleID,
		"device_id":  deviceID,
		"reg_number": regNumber,
		"count":      len(records),
		"vehicle": gin.H{
			"reg_number": regNumber, "make": makeStr, "model": model,
			"fuel_capacity": fuelCapacity, "max_speed": maxSpeed,
		},
		"device": deviceInfo,
		"data":   records,
	})
}
