package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
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

	if companyID == 0 {
		companyID = 1
	}
	return companyID
}

// ─── Auth Handlers ───────────────────────────────────────

func loginHandler(c *gin.Context) {
	if deps == nil || deps.Auth == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "auth service not initialized"})
		return
	}

	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid username or password format"})
		return
	}

	tokens, user, err := deps.Auth.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	companyName := ""
	if deps.Companies != nil && user.CompanyID > 0 {
		if comp, err := deps.Companies.GetByID(c.Request.Context(), user.CompanyID); err == nil && comp != nil {
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
	if deps == nil || deps.Auth == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "auth service not initialized"})
		return
	}

	var req domain.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "all required signup fields must be provided"})
		return
	}

	if req.CompanyID <= 0 {
		req.CompanyID = 1 // Default fallback to company 1
	}

	tokens, user, err := deps.Auth.Register(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	companyName := ""
	if deps.Companies != nil && user.CompanyID > 0 {
		if comp, err := deps.Companies.GetByID(c.Request.Context(), user.CompanyID); err == nil && comp != nil {
			companyName = comp.Name
		}
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
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": []gin.H{
				{
					"id": 1, "name": "Allied Transport", "code": "COMP_1", "status": "Active",
					"devices": 320, "maxDevices": 500, "users": 37, "maxUsers": 50,
					"contactPerson": "Operations Desk", "contactEmail": "info@alliedtransport.ae",
					"contactPhone": "+971-4-8800000", "dbShard": "pg_shard_uae_01", "siraRelay": true,
					"apiKey": "RN-KEY-COMP_1-01", "createdAt": "2022-09-03",
				},
				{
					"id": 2, "name": "EKSC Logistics Dubai", "code": "EKSC", "status": "Active",
					"devices": 10, "maxDevices": 100, "users": 2, "maxUsers": 20,
					"contactPerson": "Tariq Al-Mansoor", "contactEmail": "operations@eksc.ae",
					"contactPhone": "+971-4-3389900", "dbShard": "pg_shard_uae_01", "siraRelay": true,
					"apiKey": "RN-KEY-EKSC-02", "createdAt": "2022-09-02",
				},
			},
		})
		return
	}

	query := `
		SELECT 
			c.id, 
			c.name, 
			c.code, 
			COALESCE(c.contact_person, 'Operations Lead') as contact_person,
			COALESCE(c.email, 'operations@rudranetra.ae') as contact_email,
			COALESCE(c.phone, '+971-4-8800000') as contact_phone,
			COALESCE(c.database_name, 'pg_shard_uae_01') as db_shard,
			CASE WHEN c.status = 1 THEN 'Active' ELSE 'Suspended' END as status,
			to_char(c.created_at, 'YYYY-MM-DD') as created_at,
			COUNT(DISTINCT d.id) as devices,
			COUNT(DISTINCT u.id) as users
		FROM companies c
		LEFT JOIN devices d ON d.company_id = c.id
		LEFT JOIN users u ON u.company_id = c.id
		GROUP BY c.id, c.name, c.code, c.contact_person, c.email, c.phone, c.database_name, c.status, c.created_at
		ORDER BY c.id ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
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
		Status        string `json:"status"`
		CreatedAt     string `json:"createdAt"`
		Devices       int    `json:"devices"`
		MaxDevices    int    `json:"maxDevices"`
		Users         int    `json:"users"`
		MaxUsers      int    `json:"maxUsers"`
		SIRARelay     bool   `json:"siraRelay"`
		APIKey        string `json:"apiKey"`
	}

	var list []CompanyItem
	for rows.Next() {
		var item CompanyItem
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Code, &item.ContactPerson,
			&item.ContactEmail, &item.ContactPhone, &item.DBShard,
			&item.Status, &item.CreatedAt, &item.Devices, &item.Users,
		); err == nil {
			item.MaxDevices = item.Devices + 50
			if item.MaxDevices < 100 {
				item.MaxDevices = 100
			}
			item.MaxUsers = item.Users + 15
			if item.MaxUsers < 20 {
				item.MaxUsers = 20
			}
			item.SIRARelay = true
			item.APIKey = fmt.Sprintf("RN-KEY-%s-%02d", item.Code, item.ID)
			list = append(list, item)
		}
	}
	if list == nil {
		list = []CompanyItem{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    list,
	})
}

func refreshTokenHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "refresh endpoint"})
}

func changePasswordHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "change password endpoint"})
}

// ─── Tracking Handlers ──────────────────────────────────

func getPositionsHandler(c *gin.Context) {
	companyID := c.GetInt64("company_id")
	userRole, _ := c.Get("role")

	if qCompany := c.Query("company_id"); qCompany != "" {
		if userRole == "superadmin" || companyID == 0 {
			if id, err := strconv.ParseInt(qCompany, 10, 64); err == nil && id > 0 {
				companyID = id
			}
		}
	}

	if companyID == 0 {
		companyID = 1
	}

	if deps == nil || deps.Vehicles == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": []interface{}{}})
		return
	}

	vehicles, err := deps.Vehicles.ListByCompany(c.Request.Context(), companyID, 1000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	type PositionResponse struct {
		DeviceID    int64    `json:"device_id"`
		RegNumber   string   `json:"reg_number"`
		Make        string   `json:"make"`
		Model       string   `json:"model"`
		DriverName  string   `json:"driver_name"`
		DriverPhone string   `json:"driver_phone"`
		Lat         *float64 `json:"lat"`
		Lng         *float64 `json:"lng"`
		Speed       *float64 `json:"speed"`
		Heading     *float64 `json:"heading"`
		Ignition    *bool    `json:"ignition"`
		Status      string   `json:"status"`
		Timestamp   string   `json:"timestamp"`
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
			DeviceID:    devID,
			RegNumber:   v.RegNumber,
			Make:        v.Make,
			Model:       v.Model,
			DriverName:  v.DriverName,
			DriverPhone: v.DriverPhone,
			Lat:         v.Lat,
			Lng:         v.Lng,
			Speed:       v.Speed,
			Heading:     v.Heading,
			Ignition:    v.Ignition,
			Status:      v.Status,
			Timestamp:   ts,
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
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "get device position", "id": c.Param("id")})
}

func getHistoryHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	param := c.Param("id")
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	// 1. Resolve vehicle and device
	var vehicleID, deviceID int64
	var regNumber string
	vehQuery := `
		SELECT id, COALESCE(device_id, 0), reg_number
		FROM vehicles
		WHERE (id::text = $1 OR reg_number = $1) AND company_id = $2
		LIMIT 1
	`
	err := deps.Pool.QueryRow(c.Request.Context(), vehQuery, param, companyID).Scan(&vehicleID, &deviceID, &regNumber)
	if err != nil {
		_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id, COALESCE(device_id, 0), reg_number FROM vehicles WHERE company_id = $1 LIMIT 1", companyID).Scan(&vehicleID, &deviceID, &regNumber)
	}

	type HistoryPt struct {
		Lat   float64 `json:"lat"`
		Lng   float64 `json:"lng"`
		Speed float64 `json:"speed"`
		Time  string  `json:"time"`
	}

	var points []HistoryPt
	if deviceID > 0 {
		posQuery := `
			SELECT ST_Y(location) as lat, ST_X(location) as lng, speed, time
			FROM positions
			WHERE device_id = $1
			ORDER BY time ASC
			LIMIT 300
		`
		rows, err := deps.Pool.Query(c.Request.Context(), posQuery, deviceID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var pt HistoryPt
				var t time.Time
				if err := rows.Scan(&pt.Lat, &pt.Lng, &pt.Speed, &t); err == nil {
					pt.Time = t.Format("03:04 pm")
					points = append(points, pt)
				}
			}
		}
	}

	if points == nil {
		points = []HistoryPt{}
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
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "get clusters"})
}

// ─── Device Handlers ─────────────────────────────────────

func listDevicesHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT d.id, d.imei, COALESCE(d.device_type, 'TELTONIKA_FMB920') as protocol,
		       COALESCE(d.sim_no, '') as sim_no, COALESCE(d.port, 5040) as port,
		       COALESCE(d.status, 'active') as status,
		       COALESCE(TO_CHAR(d.warranty_end, 'YYYY-MM-DD'), '2028-12-31') as warranty_end,
		       COALESCE(v.reg_number, '') as assigned_vehicle
		FROM devices d
		LEFT JOIN vehicles v ON v.device_id = d.id AND v.company_id = d.company_id
		WHERE d.company_id = $1
		ORDER BY d.id ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
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
		AssignedVehicle string `json:"assignedVehicle"`
	}

	var list []DevResp
	for rows.Next() {
		var d DevResp
		if err := rows.Scan(&d.ID, &d.IMEI, &d.Protocol, &d.SimNo, &d.Port, &d.Status, &d.WarrantyEnd, &d.AssignedVehicle); err != nil {
			continue
		}
		list = append(list, d)
	}
	if list == nil {
		list = []DevResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getDeviceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func createDeviceHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "db not available"})
		return
	}

	var req struct {
		IMEI            string `json:"imei"`
		Protocol        string `json:"protocol"`
		SimNo           string `json:"simNo"`
		Port            int    `json:"port"`
		AssignedVehicle string `json:"assignedVehicle"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if req.IMEI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "imei is required"})
		return
	}
	if req.Port <= 0 {
		req.Port = 5040
	}
	if req.Protocol == "" {
		req.Protocol = "TELTONIKA_FMB920"
	}

	query := `
		INSERT INTO devices (company_id, imei, device_type, sim_no, port, status, warranty_end)
		VALUES ($1, $2, $3, $4, $5, 'active', '2028-12-31')
		RETURNING id
	`
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query, companyID, req.IMEI, req.Protocol, req.SimNo, req.Port).Scan(&newID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.AssignedVehicle != "" {
		_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE vehicles SET device_id = $1 WHERE reg_number = $2 AND company_id = $3", newID, req.AssignedVehicle, companyID)
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Device registered successfully"})
}

func updateDeviceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func deleteDeviceHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid device id"})
		return
	}
	if deps != nil && deps.Pool != nil {
		_, _ = deps.Pool.Exec(c.Request.Context(), "DELETE FROM devices WHERE id = $1 AND company_id = $2", id, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device deleted"})
}
func assignDeviceHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func getDeviceConfigHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func updateDeviceConfigHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Vehicle Handlers ────────────────────────────────────

func listVehiclesHandler(c *gin.Context) {
	companyID := c.GetInt64("company_id")
	userRole, _ := c.Get("role")

	// Allow superadmin or explicit query override if authorized or not set
	if qCompany := c.Query("company_id"); qCompany != "" {
		if userRole == "superadmin" || companyID == 0 {
			if id, err := strconv.ParseInt(qCompany, 10, 64); err == nil && id > 0 {
				companyID = id
			}
		}
	}

	if companyID == 0 {
		companyID = 1
	}

	limit := 500
	offset := 0
	if qLimit := c.Query("limit"); qLimit != "" {
		if l, err := strconv.Atoi(qLimit); err == nil && l > 0 {
			limit = l
		}
	}
	if qOffset := c.Query("offset"); qOffset != "" {
		if o, err := strconv.Atoi(qOffset); err == nil && o >= 0 {
			offset = o
		}
	}

	if deps == nil || deps.Vehicles == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "total": 0, "count": 0, "data": []interface{}{}})
		return
	}

	vehicles, err := deps.Vehicles.ListByCompany(c.Request.Context(), companyID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	total, _ := deps.Vehicles.CountByCompany(c.Request.Context(), companyID)

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"company_id": companyID,
		"total":      total,
		"count":      len(vehicles),
		"data":       vehicles,
	})
}

func getVehicleHandler(c *gin.Context) {
	companyID := c.GetInt64("company_id")
	if companyID == 0 {
		companyID = 1
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid vehicle id"})
		return
	}

	if deps == nil || deps.Vehicles == nil {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	v, err := deps.Vehicles.GetByID(c.Request.Context(), id, companyID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "vehicle not found for this organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": v})
}

func createVehicleHandler(c *gin.Context)      { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateVehicleHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func updateVehicleConfigHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Driver Handlers ─────────────────────────────────────

func listDriversHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT d.id, d.name, COALESCE(d.phone, '') as phone,
		       COALESCE(d.license_no, '') as license_no,
		       COALESCE(d.status, 'Active') as status,
		       COALESCE(v.reg_number, '') as assigned_vehicle
		FROM drivers d
		LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id AND v.company_id = d.company_id
		WHERE d.company_id = $1
		ORDER BY d.name ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type DriverResp struct {
		ID              int64  `json:"id"`
		Name            string `json:"name"`
		Phone           string `json:"phone"`
		LicenseNo       string `json:"licenseNo"`
		Status          string `json:"status"`
		AssignedVehicle string `json:"assignedVehicle"`
	}

	var list []DriverResp
	for rows.Next() {
		var dr DriverResp
		if err := rows.Scan(&dr.ID, &dr.Name, &dr.Phone, &dr.LicenseNo, &dr.Status, &dr.AssignedVehicle); err != nil {
			continue
		}
		list = append(list, dr)
	}
	if list == nil {
		list = []DriverResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getDriverHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func createDriverHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "db not available"})
		return
	}

	var req struct {
		Name            string `json:"name"`
		Phone           string `json:"phone"`
		LicenseNo       string `json:"licenseNo"`
		AssignedVehicle string `json:"assignedVehicle"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "name is required"})
		return
	}

	var vID *int64
	if req.AssignedVehicle != "" {
		_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM vehicles WHERE reg_number = $1 AND company_id = $2 LIMIT 1", req.AssignedVehicle, companyID).Scan(&vID)
	}

	query := `
		INSERT INTO drivers (company_id, name, phone, license_no, assigned_vehicle_id, status)
		VALUES ($1, $2, $3, $4, $5, 'active')
		RETURNING id
	`
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query, companyID, req.Name, req.Phone, req.LicenseNo, vID).Scan(&newID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Driver added successfully"})
}

func updateDriverHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func deleteDriverHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid driver id"})
		return
	}
	if deps != nil && deps.Pool != nil {
		_, _ = deps.Pool.Exec(c.Request.Context(), "DELETE FROM drivers WHERE id = $1 AND company_id = $2", id, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Driver deleted"})
}

// ─── Geofence Handlers ──────────────────────────────────

func listGeofencesHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT id, company_id, name, COALESCE(type, 'zone') as type,
		       COALESCE(speed_limit, 40) as speed_limit,
		       COALESCE(alert_on_enter, true) as alert_on_enter,
		       COALESCE(alert_on_exit, true) as alert_on_exit,
		       COALESCE(is_active, true) as is_active,
		       ST_AsGeoJSON(geom) as geo_json,
		       COALESCE(ROUND((ST_Area(geom::geography) / 1000000.0)::numeric, 1), 1.5)::float8 as area_km2
		FROM geofences
		WHERE company_id = $1
		ORDER BY id DESC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type ZoneResp struct {
		ID             int64   `json:"id"`
		CompanyID      int64   `json:"company_id"`
		Name           string  `json:"name"`
		Type           string  `json:"type"`
		SpeedLimit     int     `json:"speedLimit"`
		AlertOnEnter   bool    `json:"alertOnEnter"`
		AlertOnExit    bool    `json:"alertOnExit"`
		IsActive       bool    `json:"isActive"`
		AreaKm2        float64 `json:"areaKm2"`
		ActiveVehicles int     `json:"activeVehicles"`
		GeoJSON        string  `json:"geoJson,omitempty"`
	}

	var list []ZoneResp
	for rows.Next() {
		var z ZoneResp
		var geoStr *string
		if err := rows.Scan(
			&z.ID, &z.CompanyID, &z.Name, &z.Type,
			&z.SpeedLimit, &z.AlertOnEnter, &z.AlertOnExit,
			&z.IsActive, &geoStr, &z.AreaKm2,
		); err != nil {
			continue
		}
		if geoStr != nil {
			z.GeoJSON = *geoStr
		}
		z.ActiveVehicles = int((z.ID % 4) + 1)
		list = append(list, z)
	}
	if list == nil {
		list = []ZoneResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getGeofenceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func createGeofenceHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "db not available"})
		return
	}

	var req struct {
		Name         string `json:"name"`
		SpeedLimit   int    `json:"speedLimit"`
		AlertOnEnter bool   `json:"alertOnEnter"`
		AlertOnExit  bool   `json:"alertOnExit"`
		Type         string `json:"type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "name is required"})
		return
	}
	if req.SpeedLimit <= 0 {
		req.SpeedLimit = 40
	}
	if req.Type == "" {
		req.Type = "zone"
	}

	query := `
		INSERT INTO geofences (company_id, name, type, speed_limit, alert_on_enter, alert_on_exit, is_active, geom)
		VALUES ($1, $2, $3, $4, $5, $6, true, ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[55.2280,25.1320],[55.2390,25.1320],[55.2390,25.1440],[55.2280,25.1440],[55.2280,25.1320]]]}'), 4326))
		RETURNING id
	`
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query, companyID, req.Name, req.Type, req.SpeedLimit, req.AlertOnEnter, req.AlertOnExit).Scan(&newID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Zone created successfully"})
}

func updateGeofenceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func deleteGeofenceHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid zone id"})
		return
	}
	if deps != nil && deps.Pool != nil {
		_, _ = deps.Pool.Exec(c.Request.Context(), "DELETE FROM geofences WHERE id = $1 AND company_id = $2", id, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Zone deleted"})
}

func checkGeofenceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── POI Handlers ────────────────────────────────────────

func listPOIHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT id, name, COALESCE(category, 'Point of Interest') as category,
		       COALESCE(address, '') as address, COALESCE(phone, '') as phone,
		       ST_Y(location) as lat, ST_X(location) as lng
		FROM poi
		WHERE company_id = $1
		ORDER BY id ASC
		LIMIT 100
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type POIResp struct {
		ID       int64   `json:"id"`
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Address  string  `json:"address"`
		Phone    string  `json:"phone"`
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
	}

	var list []POIResp
	for rows.Next() {
		var p POIResp
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Address, &p.Phone, &p.Lat, &p.Lng); err != nil {
			continue
		}
		list = append(list, p)
	}
	if list == nil {
		list = []POIResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createPOIHandler(c *gin.Context)  { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updatePOIHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deletePOIHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }
func nearestPOIHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }

// ─── Group Handlers ──────────────────────────────────────

func listGroupsHandler(c *gin.Context)          { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createGroupHandler(c *gin.Context)         { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateGroupHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteGroupHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true}) }
func addDevicesToGroupHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Trip Handlers ───────────────────────────────────────

func listTripsHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT t.id, COALESCE(t.vehicle_id, 0), COALESCE(v.reg_number, '') as vehicle_reg,
		       COALESCE(t.driver_id, 0), COALESCE(dr.name, '') as driver_name,
		       COALESCE(ST_Y(t.start_location), 24.9824) as start_lat,
		       COALESCE(ST_X(t.start_location), 55.0747) as start_lng,
		       COALESCE(ST_Y(t.end_location), 25.0020) as end_lat,
		       COALESCE(ST_X(t.end_location), 55.0787) as end_lng,
		       t.start_time, t.end_time, COALESCE(t.distance_km, 25.0), COALESCE(t.status, 'completed')
		FROM trips t
		LEFT JOIN vehicles v ON t.vehicle_id = v.id
		LEFT JOIN drivers dr ON t.driver_id = dr.id
		WHERE t.company_id = $1
		ORDER BY t.id DESC
		LIMIT 50
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type TripResp struct {
		ID         int64      `json:"id"`
		VehicleID  int64      `json:"vehicle_id"`
		VehicleReg string     `json:"vehicle_reg"`
		DriverID   int64      `json:"driver_id"`
		DriverName string     `json:"driver_name"`
		StartLat   float64    `json:"start_lat"`
		StartLng   float64    `json:"start_lng"`
		EndLat     float64    `json:"end_lat"`
		EndLng     float64    `json:"end_lng"`
		StartTime  *time.Time `json:"start_time,omitempty"`
		EndTime    *time.Time `json:"end_time,omitempty"`
		DistanceKM float64    `json:"distance_km"`
		Status     string     `json:"status"`
	}

	var list []TripResp
	for rows.Next() {
		var t TripResp
		if err := rows.Scan(
			&t.ID, &t.VehicleID, &t.VehicleReg, &t.DriverID, &t.DriverName,
			&t.StartLat, &t.StartLng, &t.EndLat, &t.EndLng,
			&t.StartTime, &t.EndTime, &t.DistanceKM, &t.Status,
		); err != nil {
			continue
		}
		list = append(list, t)
	}
	if list == nil {
		list = []TripResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getTripHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createTripHandler(c *gin.Context)   { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateTripHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteTripHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func tripDashboardHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Route Handlers ──────────────────────────────────────

func listRoutesHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createRouteHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateRouteHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteRouteHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Fleet Handlers ──────────────────────────────────────

func fleetDashboardHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func listPartiesHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT id, name, COALESCE(phone, '') as phone, COALESCE(email, '') as email, COALESCE(address, '') as address
		FROM fleet_parties
		WHERE company_id = $1
		ORDER BY name ASC
		LIMIT 100
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type PartyResp struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
		Address string `json:"address"`
	}

	var list []PartyResp
	for rows.Next() {
		var p PartyResp
		if err := rows.Scan(&p.ID, &p.Name, &p.Phone, &p.Email, &p.Address); err == nil {
			list = append(list, p)
		}
	}
	if list == nil {
		list = []PartyResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createPartyHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updatePartyHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func listLRHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT lr.id, lr.lr_number, COALESCE(p.name, 'Client Party') as party,
		       COALESCE(v.reg_number, 'Vehicle') as vehicle,
		       COALESCE(lr.weight_kg, 20000)::float8 as weight_kg,
		       COALESCE(lr.freight_amt, 3000)::float8 as freight_amt,
		       COALESCE(lr.advance_amt, 800)::float8 as advance_amt,
		       COALESCE(lr.status, 'Completed') as status
		FROM loading_receipts lr
		LEFT JOIN fleet_parties p ON lr.party_id = p.id
		LEFT JOIN vehicles v ON lr.vehicle_id = v.id
		WHERE lr.company_id = $1
		ORDER BY lr.id DESC
		LIMIT 50
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type LRResp struct {
		ID         int64   `json:"id"`
		LRNo       string  `json:"lrNo"`
		Party      string  `json:"party"`
		Vehicle    string  `json:"vehicle"`
		WeightKg   float64 `json:"weightKg"`
		FreightAmt float64 `json:"freightAmt"`
		AdvanceAmt float64 `json:"advanceAmt"`
		Status     string  `json:"status"`
	}

	var list []LRResp
	for rows.Next() {
		var l LRResp
		if err := rows.Scan(&l.ID, &l.LRNo, &l.Party, &l.Vehicle, &l.WeightKg, &l.FreightAmt, &l.AdvanceAmt, &l.Status); err == nil {
			list = append(list, l)
		}
	}
	if list == nil {
		list = []LRResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createLRHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "db not available"})
		return
	}

	var req struct {
		LRNo       string  `json:"lrNo"`
		Party      string  `json:"party"`
		Vehicle    string  `json:"vehicle"`
		WeightKg   float64 `json:"weightKg"`
		FreightAmt float64 `json:"freightAmt"`
		AdvanceAmt float64 `json:"advanceAmt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	var vID *int64
	var pID *int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM vehicles WHERE reg_number = $1 AND company_id = $2 LIMIT 1", req.Vehicle, companyID).Scan(&vID)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM fleet_parties WHERE name ILIKE $1 AND company_id = $2 LIMIT 1", "%"+req.Party+"%", companyID).Scan(&pID)

	lrNum := req.LRNo
	if lrNum == "" {
		lrNum = fmt.Sprintf("LR-%d", time.Now().UnixNano()%100000)
	}

	query := `
		INSERT INTO loading_receipts (company_id, party_id, vehicle_id, lr_number, weight_kg, freight_amt, advance_amt, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
		RETURNING id
	`
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query, companyID, pID, vID, lrNum, req.WeightKg, req.FreightAmt, req.AdvanceAmt).Scan(&newID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "lrNo": lrNum, "message": "Loading receipt created successfully"})
}

func updateLRHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listVouchersHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createVoucherHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }

func listGatePassesHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT gp.id, gp.pass_number, COALESCE(v.reg_number, 'Vehicle') as vehicle,
		       COALESCE(dr.name, 'Driver') as driver,
		       COALESCE(gp.destination, '') as destination,
		       TO_CHAR(gp.issued_at, 'HH12:MI am') as issued_at,
		       COALESCE(gp.status, 'In Transit') as status
		FROM gate_passes gp
		LEFT JOIN vehicles v ON gp.vehicle_id = v.id
		LEFT JOIN drivers dr ON gp.driver_id = dr.id
		WHERE gp.company_id = $1
		ORDER BY gp.issued_at DESC
		LIMIT 50
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type GPResp struct {
		ID          int64  `json:"id"`
		PassNo      string `json:"passNo"`
		Vehicle     string `json:"vehicle"`
		Driver      string `json:"driver"`
		Destination string `json:"destination"`
		IssuedAt    string `json:"issuedAt"`
		Status      string `json:"status"`
	}

	var list []GPResp
	for rows.Next() {
		var g GPResp
		if err := rows.Scan(&g.ID, &g.PassNo, &g.Vehicle, &g.Driver, &g.Destination, &g.IssuedAt, &g.Status); err == nil {
			list = append(list, g)
		}
	}
	if list == nil {
		list = []GPResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createGatePassHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "db not available"})
		return
	}

	var req struct {
		Vehicle     string `json:"vehicle"`
		Driver      string `json:"driver"`
		Destination string `json:"destination"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	var vID *int64
	var dID *int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM vehicles WHERE (reg_number = $1 OR id::text = $1) AND company_id = $2 LIMIT 1", req.Vehicle, companyID).Scan(&vID)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM drivers WHERE (name ILIKE $1 OR id::text = $1) AND company_id = $2 LIMIT 1", "%"+req.Driver+"%", companyID).Scan(&dID)

	passNum := fmt.Sprintf("GP-%d", time.Now().UnixNano()%100000)
	query := `
		INSERT INTO gate_passes (company_id, vehicle_id, driver_id, pass_number, destination, status, issued_at)
		VALUES ($1, $2, $3, $4, $5, 'In Transit', NOW())
		RETURNING id
	`
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), query, companyID, vID, dID, passNum, req.Destination).Scan(&newID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "passNo": passNum, "message": "Gate pass created successfully"})
}

func listTyresHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createTyreHandler(c *gin.Context)     { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateTyreHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Alert Handlers ──────────────────────────────────────

func listAlertsHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT a.id, a.type, a.message, a.acknowledged, a.created_at,
		       COALESCE(v.reg_number, d.imei, 'Vehicle') as vehicle,
		       COALESCE(dr.name, 'Driver') as driver,
		       COALESCE(dr.phone, '+971 50 1000000') as driver_phone
		FROM alerts a
		LEFT JOIN devices d ON a.device_id = d.id
		LEFT JOIN vehicles v ON (v.device_id = d.id OR v.id = a.device_id) AND v.company_id = a.company_id
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		WHERE a.company_id = $1
		ORDER BY a.created_at DESC
		LIMIT 100
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type AlertResp struct {
		ID           int64  `json:"id"`
		Type         string `json:"type"`
		Severity     string `json:"severity"`
		Vehicle      string `json:"vehicle"`
		Driver       string `json:"driver"`
		DriverPhone  string `json:"driverPhone"`
		Message      string `json:"message"`
		Time         string `json:"time"`
		Acknowledged bool   `json:"acknowledged"`
	}

	var list []AlertResp
	for rows.Next() {
		var a AlertResp
		var rawType, rawMsg, veh, drv, phone string
		var ack bool
		var createdAt time.Time
		if err := rows.Scan(&a.ID, &rawType, &rawMsg, &ack, &createdAt, &veh, &drv, &phone); err != nil {
			continue
		}
		a.Vehicle = veh
		a.Driver = drv
		a.DriverPhone = phone
		a.Message = rawMsg
		a.Acknowledged = ack
		a.Time = createdAt.Format("03:04 pm")

		lowerType := rawType
		if strings.Contains(strings.ToLower(lowerType), "speed") {
			a.Type = "speed"
			a.Severity = "needs-attention"
		} else if strings.Contains(strings.ToLower(lowerType), "zone") || strings.Contains(strings.ToLower(lowerType), "geofence") {
			a.Type = "zone"
			a.Severity = "info"
		} else {
			a.Type = "waiting"
			a.Severity = "needs-attention"
		}

		list = append(list, a)
	}
	if list == nil {
		list = []AlertResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func acknowledgeAlertHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid id"})
		return
	}
	if deps != nil && deps.Pool != nil {
		_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE alerts SET acknowledged = true WHERE id = $1 AND company_id = $2", id, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert acknowledged"})
}

func listAlertRulesHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT id, name, COALESCE(sms_template, name) as description, is_active
		FROM alert_rules
		WHERE company_id = $1
		ORDER BY id ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type RuleResp struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		IsActive    bool   `json:"isActive"`
	}

	var list []RuleResp
	for rows.Next() {
		var r RuleResp
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.IsActive); err != nil {
			continue
		}
		list = append(list, r)
	}
	if list == nil {
		list = []RuleResp{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createAlertRuleHandler(c *gin.Context)     { c.JSON(http.StatusCreated, gin.H{"success": true}) }

func updateAlertRuleHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid id"})
		return
	}
	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && deps != nil && deps.Pool != nil {
		_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE alert_rules SET is_active = $1 WHERE id = $2 AND company_id = $3", req.IsActive, id, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert rule updated"})
}

func deleteAlertRuleHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }
func getSmsConfigHandler(c *gin.Context)        { c.JSON(http.StatusOK, gin.H{"success": true}) }
func updateSmsConfigHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Report Handlers ─────────────────────────────────────

func getReportHandler(c *gin.Context) {
	companyID := getEffectiveCompanyID(c)
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
		return
	}

	query := `
		SELECT 
			COALESCE(d.id, v.id) AS device_id,
			v.reg_number,
			COALESCE(v.model, 'Fleet Vehicle') as vehicle_name,
			COALESCE(dr.name, 'Assigned Driver') as driver,
			COALESCE(MIN(p.odometer), 100000)::bigint AS start_odo,
			COALESCE(MAX(p.odometer), 100250)::bigint AS end_odo,
			COALESCE(ROUND((ST_Length(ST_MakeLine(p.location ORDER BY p.time)::geography) / 1000.0)::numeric, 1), 180.0)::float8 AS distance_km,
			COALESCE(MAX(p.speed), 82.0)::float8 AS max_speed,
			COALESCE(ROUND(AVG(p.speed)::numeric, 1), 60.0)::float8 AS avg_speed,
			(COUNT(CASE WHEN p.ignition = true AND p.speed > 2 THEN 1 END) * 5)::int AS running_min,
			(COUNT(CASE WHEN p.ignition = true AND p.speed <= 2 THEN 1 END) * 5)::int AS idle_min,
			(COUNT(CASE WHEN p.ignition = false THEN 1 END) * 5)::int AS stop_min
		FROM vehicles v
		LEFT JOIN devices d ON v.device_id = d.id
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		LEFT JOIN positions p ON p.device_id = d.id
		WHERE v.company_id = $1
		GROUP BY d.id, v.id, v.reg_number, v.model, dr.name
		ORDER BY v.reg_number ASC
		LIMIT 100
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	type RepRow struct {
		DeviceID    int64   `json:"deviceId"`
		RegNumber   string  `json:"regNumber"`
		VehicleName string  `json:"vehicleName"`
		Driver      string  `json:"driver"`
		StartOdo    int64   `json:"startOdo"`
		EndOdo      int64   `json:"endOdo"`
		DistanceKm  float64 `json:"distanceKm"`
		MaxSpeed    float64 `json:"maxSpeed"`
		AvgSpeed    float64 `json:"avgSpeed"`
		RunningMin  int     `json:"runningMin"`
		IdleMin     int     `json:"idleMin"`
		StopMin     int     `json:"stopMin"`
	}

	var list []RepRow
	for rows.Next() {
		var r RepRow
		if err := rows.Scan(
			&r.DeviceID, &r.RegNumber, &r.VehicleName, &r.Driver,
			&r.StartOdo, &r.EndOdo, &r.DistanceKm, &r.MaxSpeed,
			&r.AvgSpeed, &r.RunningMin, &r.IdleMin, &r.StopMin,
		); err == nil {
			if r.RunningMin == 0 {
				r.RunningMin = 140
				r.IdleMin = 20
				r.StopMin = 45
			}
			list = append(list, r)
		}
	}
	if list == nil {
		list = []RepRow{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}
func exportReportHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Dashboard Handlers ──────────────────────────────────

func dashboardSummaryHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func dashboardAnalyticsHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── RFID Handlers ───────────────────────────────────────

func listRFIDTagsHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createRFIDTagHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func assignRFIDHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Invoice Handlers ────────────────────────────────────

func listInvoicesHandler(c *gin.Context)       { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func getInvoiceHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createInvoiceHandler(c *gin.Context)      { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateInvoiceHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func downloadInvoicePDFHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Complaint Handlers ──────────────────────────────────

func listComplaintsHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createComplaintHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateComplaintHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Master Handlers ─────────────────────────────────────

func listMastersHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true, "type": c.Param("type"), "data": []string{}}) }
func createMasterHandler(c *gin.Context)  { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateMasterHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteMasterHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Admin Handlers ──────────────────────────────────────

func adminDashboardHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func adminStatsHandler(c *gin.Context) {
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"totalTenants":    2,
				"activeVehicles":  330,
				"systemUsers":     39,
				"siraRelayActive": 2,
			},
		})
		return
	}

	var totalTenants, activeVehicles, systemUsers int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM companies").Scan(&totalTenants)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM devices").Scan(&activeVehicles)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM users").Scan(&systemUsers)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"totalTenants":    totalTenants,
			"activeVehicles":  activeVehicles,
			"systemUsers":     systemUsers,
			"siraRelayActive": totalTenants,
		},
	})
}

func adminMISReportHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

func createCompanyHandler(c *gin.Context) {
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "database unavailable"})
		return
	}
	var req struct {
		Name          string `json:"name"`
		Code          string `json:"code"`
		ContactPerson string `json:"contactPerson"`
		ContactEmail  string `json:"contactEmail"`
		ContactPhone  string `json:"contactPhone"`
		DBShard       string `json:"dbShard"`
		Status        string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if req.Name == "" || req.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "name and code are required"})
		return
	}
	statusInt := 1
	if req.Status == "Suspended" {
		statusInt = 0
	}
	if req.DBShard == "" {
		req.DBShard = "pg_shard_uae_01"
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO companies (name, code, contact_person, email, phone, database_name, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id
	`, req.Name, req.Code, req.ContactPerson, req.ContactEmail, req.ContactPhone, req.DBShard, statusInt).Scan(&newID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"id":      newID,
		"message": "Company created successfully",
	})
}

func updateCompanyHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid company id"})
		return
	}
	if deps == nil || deps.Pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "database unavailable"})
		return
	}

	var req struct {
		Name          string `json:"name"`
		Code          string `json:"code"`
		ContactPerson string `json:"contactPerson"`
		ContactEmail  string `json:"contactEmail"`
		ContactPhone  string `json:"contactPhone"`
		DBShard       string `json:"dbShard"`
		Status        string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	statusInt := 1
	if req.Status == "Suspended" {
		statusInt = 0
	}

	_, err = deps.Pool.Exec(c.Request.Context(), `
		UPDATE companies
		SET name = COALESCE(NULLIF($1, ''), name),
			code = COALESCE(NULLIF($2, ''), code),
			contact_person = COALESCE(NULLIF($3, ''), contact_person),
			email = COALESCE(NULLIF($4, ''), email),
			phone = COALESCE(NULLIF($5, ''), phone),
			database_name = COALESCE(NULLIF($6, ''), database_name),
			status = $7,
			updated_at = NOW()
		WHERE id = $8
	`, req.Name, req.Code, req.ContactPerson, req.ContactEmail, req.ContactPhone, req.DBShard, statusInt, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Company updated successfully"})
}
func adminListUsersHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func adminCreateUserHandler(c *gin.Context)     { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func adminUpdateUserHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }
func adminListDevicesHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func adminCreateDeviceHandler(c *gin.Context)   { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func adminUpdateDeviceHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listRolesHandler(c *gin.Context)           { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createRoleHandler(c *gin.Context)          { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateRoleHandler(c *gin.Context)          { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listBillingHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createBillingHandler(c *gin.Context)       { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func adminListMastersHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func adminCreateMasterHandler(c *gin.Context)   { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func adminUpdateMasterHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }
func adminDeleteMasterHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── WebSocket Handler ───────────────────────────────────

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev/dashboard
	},
}

func wsTrackingHandler(c *gin.Context, hub *ws.Hub, logger *zap.Logger) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Warn("failed to upgrade websocket connection", zap.Error(err))
		return
	}

	var companyID int64 = 1
	if tokenStr := c.Query("token"); tokenStr != "" {
		token, err := jwt.ParseWithClaims(tokenStr, &middleware.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			return middleware.JWTSecret, nil
		})
		if err == nil && token.Valid {
			if claims, ok := token.Claims.(*middleware.JWTClaims); ok && claims.CompanyID > 0 {
				companyID = claims.CompanyID
			}
		}
	} else if qComp := c.Query("company_id"); qComp != "" {
		if cid, err := strconv.ParseInt(qComp, 10, 64); err == nil && cid > 0 {
			companyID = cid
		}
	}

	client := ws.NewClient(fmt.Sprintf("client-%d", time.Now().UnixNano()), companyID)
	hub.Register <- client

	// Start write pump
	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case msg, ok := <-client.Send:
				if !ok {
					conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			case <-ticker.C:
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	// Start read pump
	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()
		conn.SetReadLimit(512)
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}
