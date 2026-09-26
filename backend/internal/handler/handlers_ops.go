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
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/rudra-netra/backend/internal/handler/middleware"
	ws "github.com/rudra-netra/backend/internal/websocket"
)

// ─── Password helpers ────────────────────────────────────

func hashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(b), err
}

func verifyPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// ─── Driver Handlers ─────────────────────────────────────

func listDriversHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	query := `
		SELECT d.id, d.name, COALESCE(d.phone, ''), COALESCE(d.license_no, ''),
		       COALESCE(d.status, ''), COALESCE(v.reg_number, ''), COALESCE(d.rfid_tag, ''), d.license_expiry
		FROM drivers d
		LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id AND v.company_id = d.company_id
		WHERE d.company_id = $1
		ORDER BY d.name ASC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type DriverResp struct {
		ID              int64  `json:"id"`
		Name            string `json:"name"`
		Phone           string `json:"phone"`
		LicenseNo       string `json:"licenseNo"`
		LicenseExpiry   string `json:"licenseExpiry"`
		Status          string `json:"status"`
		AssignedVehicle string `json:"assignedVehicle"`
		RFIDTag         string `json:"rfidTag"`
	}

	list := make([]DriverResp, 0)
	for rows.Next() {
		var d DriverResp
		var expiry *time.Time
		if err := rows.Scan(&d.ID, &d.Name, &d.Phone, &d.LicenseNo, &d.Status, &d.AssignedVehicle, &d.RFIDTag, &expiry); err != nil {
			continue
		}
		d.LicenseExpiry = fmtTime(expiry, "2006-01-02")
		list = append(list, d)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getDriverHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid driver id")
		return
	}
	var (
		dID, vehicleID       int64
		name, phone, license string
		status, rfid, reg    string
		expiry               *time.Time
	)
	err = deps.Pool.QueryRow(c.Request.Context(), `
		SELECT d.id, d.name, COALESCE(d.phone, ''), COALESCE(d.license_no, ''), COALESCE(d.status, ''),
		       COALESCE(d.rfid_tag, ''), d.license_expiry, COALESCE(v.id, 0), COALESCE(v.reg_number, '')
		FROM drivers d
		LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id AND v.company_id = d.company_id
		WHERE d.id = $1 AND d.company_id = $2
	`, id, companyID).Scan(&dID, &name, &phone, &license, &status, &rfid, &expiry, &vehicleID, &reg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "driver not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"id": dID, "name": name, "phone": phone, "licenseNo": license, "status": status,
		"rfidTag": rfid, "licenseExpiry": fmtTime(expiry, "2006-01-02"),
		"assignedVehicleId": vehicleID, "assignedVehicle": reg,
	}})
}

func createDriverHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	var req struct {
		Name              string `json:"name"`
		Phone             string `json:"phone"`
		LicenseNo         string `json:"licenseNo"`
		LicenseExpiry     string `json:"licenseExpiry"`
		RFIDTag           string `json:"rfidTag"`
		Status            string `json:"status"`
		AssignedVehicle   string `json:"assignedVehicle"`
		AssignedVehicleID int64  `json:"assignedVehicleId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		badRequest(c, "name is required")
		return
	}

	var vID *int64
	if req.AssignedVehicleID > 0 {
		vID = &req.AssignedVehicleID
	} else if req.AssignedVehicle != "" {
		var vid int64
		if err := deps.Pool.QueryRow(c.Request.Context(),
			"SELECT id FROM vehicles WHERE reg_number = $1 AND company_id = $2",
			req.AssignedVehicle, companyID).Scan(&vid); err == nil {
			vID = &vid
		}
	}

	var expiry *time.Time
	if req.LicenseExpiry != "" {
		if t, err := time.Parse("2006-01-02", req.LicenseExpiry); err == nil {
			expiry = &t
		}
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO drivers (company_id, name, phone, license_no, license_expiry, rfid_tag, assigned_vehicle_id, status)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, NULLIF($6, ''), $7, COALESCE(NULLIF($8, ''), 'active'))
		RETURNING id
	`, companyID, req.Name, req.Phone, req.LicenseNo, expiry, req.RFIDTag, vID, req.Status).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Driver added successfully"})
}

func updateDriverHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid driver id")
		return
	}
	var req struct {
		Name              string `json:"name"`
		Phone             string `json:"phone"`
		LicenseNo         string `json:"licenseNo"`
		LicenseExpiry     string `json:"licenseExpiry"`
		RFIDTag           string `json:"rfidTag"`
		Status            string `json:"status"`
		AssignedVehicleID int64  `json:"assignedVehicleId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	var expiry *time.Time
	if req.LicenseExpiry != "" {
		if t, err := time.Parse("2006-01-02", req.LicenseExpiry); err == nil {
			expiry = &t
		}
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE drivers SET
			name = COALESCE(NULLIF($1, ''), name),
			phone = COALESCE(NULLIF($2, ''), phone),
			license_no = COALESCE(NULLIF($3, ''), license_no),
			license_expiry = COALESCE($4, license_expiry),
			rfid_tag = COALESCE(NULLIF($5, ''), rfid_tag),
			status = COALESCE(NULLIF($6, ''), status),
			assigned_vehicle_id = COALESCE(NULLIF($7, 0), assigned_vehicle_id),
			updated_at = NOW()
		WHERE id = $8 AND company_id = $9
	`, req.Name, req.Phone, req.LicenseNo, expiry, req.RFIDTag, req.Status, req.AssignedVehicleID, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "driver not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Driver updated"})
}

func deleteDriverHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid driver id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM drivers WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Driver deleted"})
}

// ─── Geofence Handlers ───────────────────────────────────

func listGeofencesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	query := `
		SELECT g.id, g.company_id, g.name, COALESCE(g.type, ''), COALESCE(g.speed_limit, 0),
		       COALESCE(g.alert_on_enter, FALSE), COALESCE(g.alert_on_exit, FALSE), COALESCE(g.is_active, FALSE),
		       ST_AsGeoJSON(g.geom),
		       COALESCE(ROUND((ST_Area(g.geom::geography) / 1000000.0)::numeric, 2), 0)::float8 AS area_km2,
		       COALESCE(live.active_vehicles, 0)
		FROM geofences g
		LEFT JOIN LATERAL (
			SELECT COUNT(DISTINCT v.id) AS active_vehicles
			FROM vehicles v
			JOIN LATERAL (
				SELECT location FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
			) p ON TRUE
			WHERE v.company_id = g.company_id AND ST_Contains(g.geom, p.location)
		) live ON TRUE
		WHERE g.company_id = $1
		ORDER BY g.id DESC
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID)
	if err != nil {
		serverError(c, err)
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
		ActiveVehicles int64   `json:"activeVehicles"`
		GeoJSON        string  `json:"geoJson,omitempty"`
	}

	list := make([]ZoneResp, 0)
	for rows.Next() {
		var z ZoneResp
		var geoStr *string
		if err := rows.Scan(&z.ID, &z.CompanyID, &z.Name, &z.Type, &z.SpeedLimit,
			&z.AlertOnEnter, &z.AlertOnExit, &z.IsActive, &geoStr, &z.AreaKm2, &z.ActiveVehicles); err != nil {
			continue
		}
		if geoStr != nil {
			z.GeoJSON = *geoStr
		}
		list = append(list, z)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getGeofenceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid zone id")
		return
	}
	var (
		zID, cID                int64
		name, ztype             string
		speed                   int
		onEnter, onExit, active bool
		geoStr                  *string
	)
	err = deps.Pool.QueryRow(c.Request.Context(), `
		SELECT id, company_id, name, COALESCE(type, ''), COALESCE(speed_limit, 0),
		       COALESCE(alert_on_enter, FALSE), COALESCE(alert_on_exit, FALSE), COALESCE(is_active, FALSE),
		       ST_AsGeoJSON(geom)
		FROM geofences WHERE id = $1 AND company_id = $2
	`, id, companyID).Scan(&zID, &cID, &name, &ztype, &speed, &onEnter, &onExit, &active, &geoStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "zone not found for this organization"})
		return
	}
	out := gin.H{"id": zID, "company_id": cID, "name": name, "type": ztype, "speedLimit": speed,
		"alertOnEnter": onEnter, "alertOnExit": onExit, "isActive": active}
	if geoStr != nil {
		out["geoJson"] = *geoStr
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// parseGeofenceGeometry accepts a GeoJSON polygon (object or string) or a
// coordinates array and returns WGS84 GeoJSON text. No default shape is used.
func parseGeofenceGeometry(geoJSON string, coordinates [][2]float64) (string, error) {
	if geoJSON != "" {
		var obj map[string]interface{}
		if err := json.Unmarshal([]byte(geoJSON), &obj); err != nil {
			return "", fmt.Errorf("geoJson must be a valid GeoJSON polygon")
		}
		if t, _ := obj["type"].(string); t == "Feature" {
			if geom, ok := obj["geometry"].(map[string]interface{}); ok {
				b, err := json.Marshal(geom)
				if err != nil {
					return "", err
				}
				return string(b), nil
			}
			return "", fmt.Errorf("geoJson feature has no geometry")
		}
		if t, _ := obj["type"].(string); t != "Polygon" && t != "MultiPolygon" {
			return "", fmt.Errorf("geoJson must be a Polygon")
		}
		return geoJSON, nil
	}
	if len(coordinates) >= 3 {
		b, err := json.Marshal(map[string]interface{}{"type": "Polygon", "coordinates": [][][2]float64{coordinates}})
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
	return "", fmt.Errorf("geoJson polygon or coordinates array is required")
}

func createGeofenceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	var req struct {
		Name         string       `json:"name"`
		Type         string       `json:"type"`
		SpeedLimit   int          `json:"speedLimit"`
		AlertOnEnter *bool        `json:"alertOnEnter"`
		AlertOnExit  *bool        `json:"alertOnExit"`
		IsActive     *bool        `json:"isActive"`
		GeoJSON      string       `json:"geoJson"`
		Coordinates  [][2]float64 `json:"coordinates"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		badRequest(c, "name is required")
		return
	}
	geom, err := parseGeofenceGeometry(req.GeoJSON, req.Coordinates)
	if err != nil {
		badRequest(c, err.Error())
		return
	}

	var newID int64
	err = deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO geofences (company_id, name, type, speed_limit, alert_on_enter, alert_on_exit, is_active, geom)
		VALUES ($1, $2, COALESCE(NULLIF($3, ''), 'zone'),
		        NULLIF($4, 0), COALESCE($5, TRUE), COALESCE($6, TRUE), COALESCE($7, TRUE),
		        ST_SetSRID(ST_GeomFromGeoJSON($8), 4326))
		RETURNING id
	`, companyID, req.Name, req.Type, req.SpeedLimit, req.AlertOnEnter, req.AlertOnExit, req.IsActive, geom).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Zone created successfully"})
}

func updateGeofenceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid zone id")
		return
	}
	var req struct {
		Name         string       `json:"name"`
		Type         string       `json:"type"`
		SpeedLimit   int          `json:"speedLimit"`
		AlertOnEnter *bool        `json:"alertOnEnter"`
		AlertOnExit  *bool        `json:"alertOnExit"`
		IsActive     *bool        `json:"isActive"`
		GeoJSON      string       `json:"geoJson"`
		Coordinates  [][2]float64 `json:"coordinates"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	var geom *string
	if req.GeoJSON != "" || len(req.Coordinates) >= 3 {
		g, err := parseGeofenceGeometry(req.GeoJSON, req.Coordinates)
		if err != nil {
			badRequest(c, err.Error())
			return
		}
		geom = &g
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE geofences SET
			name = COALESCE(NULLIF($1, ''), name),
			type = COALESCE(NULLIF($2, ''), type),
			speed_limit = CASE WHEN $3 > 0 THEN $3 ELSE speed_limit END,
			alert_on_enter = COALESCE($4, alert_on_enter),
			alert_on_exit = COALESCE($5, alert_on_exit),
			is_active = COALESCE($6, is_active),
			geom = COALESCE(ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), geom),
			updated_at = NOW()
		WHERE id = $8 AND company_id = $9
	`, req.Name, req.Type, req.SpeedLimit, req.AlertOnEnter, req.AlertOnExit, req.IsActive, geom, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "zone not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Zone updated"})
}

func deleteGeofenceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid zone id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM geofences WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Zone deleted"})
}

func checkGeofenceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Lat == 0 && req.Lng == 0) {
		badRequest(c, "lat and lng are required")
		return
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(speed_limit, 0)
		FROM geofences
		WHERE company_id = $1 AND is_active = TRUE
		  AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326))
	`, companyID, req.Lng, req.Lat)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type ZoneHit struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		SpeedLimit int    `json:"speedLimit"`
	}
	zones := make([]ZoneHit, 0)
	for rows.Next() {
		var z ZoneHit
		if err := rows.Scan(&z.ID, &z.Name, &z.SpeedLimit); err == nil {
			zones = append(zones, z)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"is_inside": len(zones) > 0,
		"zones":     zones,
	}})
}

// ─── POI Handlers ────────────────────────────────────────

func listPOIHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(category, ''), COALESCE(address, ''), COALESCE(phone, ''),
		       ST_Y(location), ST_X(location)
		FROM poi WHERE company_id = $1 ORDER BY id ASC LIMIT 500
	`, companyID)
	if err != nil {
		serverError(c, err)
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
	list := make([]POIResp, 0)
	for rows.Next() {
		var p POIResp
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Address, &p.Phone, &p.Lat, &p.Lng); err == nil {
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createPOIHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Address  string  `json:"address"`
		Phone    string  `json:"phone"`
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if req.Name == "" || (req.Lat == 0 && req.Lng == 0) {
		badRequest(c, "name, lat and lng are required")
		return
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO poi (company_id, name, category, address, phone, location)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), ST_SetSRID(ST_MakePoint($6, $7), 4326))
		RETURNING id
	`, companyID, req.Name, req.Category, req.Address, req.Phone, req.Lng, req.Lat).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "POI created"})
}

func updatePOIHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid POI id")
		return
	}
	var req struct {
		Name     string  `json:"name"`
		Category string  `json:"category"`
		Address  string  `json:"address"`
		Phone    string  `json:"phone"`
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE poi SET
			name = COALESCE(NULLIF($1, ''), name),
			category = COALESCE(NULLIF($2, ''), category),
			address = COALESCE(NULLIF($3, ''), address),
			phone = COALESCE(NULLIF($4, ''), phone),
			location = CASE WHEN $5 <> 0 AND $6 <> 0 THEN ST_SetSRID(ST_MakePoint($6, $5), 4326) ELSE location END
		WHERE id = $7 AND company_id = $8
	`, req.Name, req.Category, req.Address, req.Phone, req.Lat, req.Lng, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "POI not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "POI updated"})
}

func deletePOIHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid POI id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM poi WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "POI deleted"})
}

// ─── Group Handlers ──────────────────────────────────────

func listGroupsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT g.id, g.name, COALESCE(g.description, ''),
		       COALESCE(array_agg(m.vehicle_id) FILTER (WHERE m.vehicle_id IS NOT NULL), '{}')
		FROM vehicle_groups g
		LEFT JOIN vehicle_group_members m ON m.group_id = g.id
		WHERE g.company_id = $1
		GROUP BY g.id, g.name, g.description
		ORDER BY g.id ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type GroupResp struct {
		ID          int64   `json:"id"`
		Name        string  `json:"name"`
		Description string  `json:"description"`
		VehicleIDs  []int64 `json:"vehicleIds"`
	}
	list := make([]GroupResp, 0)
	for rows.Next() {
		var g GroupResp
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.VehicleIDs); err == nil {
			if g.VehicleIDs == nil {
				g.VehicleIDs = []int64{}
			}
			list = append(list, g)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createGroupHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		VehicleIDs  []int64 `json:"vehicleIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		badRequest(c, "name is required")
		return
	}
	ctx := c.Request.Context()
	tx, err := deps.Pool.Begin(ctx)
	if err != nil {
		serverError(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var newID int64
	if err := tx.QueryRow(ctx, "INSERT INTO vehicle_groups (company_id, name, description) VALUES ($1,$2,NULLIF($3,'')) RETURNING id",
		companyID, req.Name, req.Description).Scan(&newID); err != nil {
		serverError(c, err)
		return
	}
	for _, vid := range req.VehicleIDs {
		_, _ = tx.Exec(ctx, "INSERT INTO vehicle_group_members (group_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", newID, vid)
	}
	if err := tx.Commit(ctx); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Group created"})
}

func updateGroupHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid group id")
		return
	}
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		VehicleIDs  *[]int64 `json:"vehicleIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	ctx := c.Request.Context()
	if _, err := deps.Pool.Exec(ctx, `
		UPDATE vehicle_groups SET name = COALESCE(NULLIF($1,''), name),
		       description = COALESCE(NULLIF($2,''), description), updated_at = NOW()
		WHERE id = $3 AND company_id = $4
	`, req.Name, req.Description, id, companyID); err != nil {
		serverError(c, err)
		return
	}
	if req.VehicleIDs != nil {
		if _, err := deps.Pool.Exec(ctx, "DELETE FROM vehicle_group_members WHERE group_id = $1", id); err != nil {
			serverError(c, err)
			return
		}
		for _, vid := range *req.VehicleIDs {
			_, _ = deps.Pool.Exec(ctx, "INSERT INTO vehicle_group_members (group_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", id, vid)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Group updated"})
}

func deleteGroupHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid group id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM vehicle_groups WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Group deleted"})
}

func addDevicesToGroupHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid group id")
		return
	}
	var req struct {
		VehicleIDs []int64 `json:"vehicleIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	for _, vid := range req.VehicleIDs {
		_, _ = deps.Pool.Exec(c.Request.Context(), `
			INSERT INTO vehicle_group_members (group_id, vehicle_id)
			SELECT $1, v.id FROM vehicles v WHERE v.id = $2 AND v.company_id = $3
			ON CONFLICT DO NOTHING
		`, id, vid, companyID)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Vehicles added to group"})
}

// ─── Trip Handlers ───────────────────────────────────────

func listTripsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT t.id, COALESCE(t.vehicle_id, 0), COALESCE(v.reg_number, ''),
		       COALESCE(t.driver_id, 0), COALESCE(dr.name, ''),
		       ST_Y(t.start_location), ST_X(t.start_location),
		       ST_Y(t.end_location), ST_X(t.end_location),
		       t.start_time, t.end_time, COALESCE(t.distance_km, 0), COALESCE(t.status, '')
		FROM trips t
		LEFT JOIN vehicles v ON t.vehicle_id = v.id
		LEFT JOIN drivers dr ON t.driver_id = dr.id
		WHERE t.company_id = $1
		ORDER BY t.id DESC
		LIMIT 100
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type TripResp struct {
		ID         int64    `json:"id"`
		VehicleID  int64    `json:"vehicle_id"`
		VehicleReg string   `json:"vehicle_reg"`
		DriverID   int64    `json:"driver_id"`
		DriverName string   `json:"driver_name"`
		StartLat   *float64 `json:"start_lat"`
		StartLng   *float64 `json:"start_lng"`
		EndLat     *float64 `json:"end_lat"`
		EndLng     *float64 `json:"end_lng"`
		StartTime  string   `json:"start_time"`
		EndTime    string   `json:"end_time"`
		DistanceKM float64  `json:"distance_km"`
		Status     string   `json:"status"`
	}
	list := make([]TripResp, 0)
	for rows.Next() {
		var t TripResp
		var st, et *time.Time
		if err := rows.Scan(&t.ID, &t.VehicleID, &t.VehicleReg, &t.DriverID, &t.DriverName,
			&t.StartLat, &t.StartLng, &t.EndLat, &t.EndLng, &st, &et, &t.DistanceKM, &t.Status); err != nil {
			continue
		}
		t.StartTime = fmtTime(st, time.RFC3339)
		t.EndTime = fmtTime(et, time.RFC3339)
		list = append(list, t)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func getTripHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid trip id")
		return
	}
	var (
		tid, vehicleID, driverID           int64
		reg, driver, status                string
		startLat, startLng, endLat, endLng *float64
		distance                           float64
		st, et                             *time.Time
	)
	err = deps.Pool.QueryRow(c.Request.Context(), `
		SELECT t.id, COALESCE(t.vehicle_id,0), COALESCE(v.reg_number,''), COALESCE(t.driver_id,0), COALESCE(dr.name,''),
		       ST_Y(t.start_location), ST_X(t.start_location), ST_Y(t.end_location), ST_X(t.end_location),
		       t.start_time, t.end_time, COALESCE(t.distance_km,0), COALESCE(t.status,'')
		FROM trips t
		LEFT JOIN vehicles v ON t.vehicle_id = v.id
		LEFT JOIN drivers dr ON t.driver_id = dr.id
		WHERE t.id = $1 AND t.company_id = $2
	`, id, companyID).Scan(&tid, &vehicleID, &reg, &driverID, &driver, &startLat, &startLng, &endLat, &endLng, &st, &et, &distance, &status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "trip not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"id": tid, "vehicle_id": vehicleID, "vehicle_reg": reg, "driver_id": driverID, "driver_name": driver,
		"start_lat": startLat, "start_lng": startLng, "end_lat": endLat, "end_lng": endLng,
		"start_time": fmtTime(st, time.RFC3339), "end_time": fmtTime(et, time.RFC3339),
		"distance_km": distance, "status": status,
	}})
}

func createTripHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		VehicleID  int64   `json:"vehicleId"`
		DriverID   int64   `json:"driverId"`
		StartLat   float64 `json:"startLat"`
		StartLng   float64 `json:"startLng"`
		EndLat     float64 `json:"endLat"`
		EndLng     float64 `json:"endLng"`
		StartTime  string  `json:"startTime"`
		EndTime    string  `json:"endTime"`
		DistanceKm float64 `json:"distanceKm"`
		Status     string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	var st, et *time.Time
	if t, err := time.Parse(time.RFC3339, req.StartTime); err == nil {
		st = &t
	}
	if t, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
		et = &t
	}
	var startPoint, endPoint *string
	if req.StartLat != 0 || req.StartLng != 0 {
		s := fmt.Sprintf("SRID=4326;POINT(%f %f)", req.StartLng, req.StartLat)
		startPoint = &s
	}
	if req.EndLat != 0 || req.EndLng != 0 {
		e := fmt.Sprintf("SRID=4326;POINT(%f %f)", req.EndLng, req.EndLat)
		endPoint = &e
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO trips (company_id, vehicle_id, driver_id, start_location, end_location, start_time, end_time, distance_km, status)
		VALUES ($1, NULLIF($2,0), NULLIF($3,0),
		        CASE WHEN $4::text IS NOT NULL THEN ST_GeomFromEWKT($4::text) END,
		        CASE WHEN $5::text IS NOT NULL THEN ST_GeomFromEWKT($5::text) END,
		        $6, $7, $8, COALESCE(NULLIF($9,''), 'planned'))
		RETURNING id
	`, companyID, req.VehicleID, req.DriverID, startPoint, endPoint, st, et, req.DistanceKm, req.Status).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Trip created"})
}

func updateTripHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid trip id")
		return
	}
	var req struct {
		VehicleID  int64   `json:"vehicleId"`
		DriverID   int64   `json:"driverId"`
		DistanceKm float64 `json:"distanceKm"`
		Status     string  `json:"status"`
		EndTime    string  `json:"endTime"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	var et *time.Time
	if t, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
		et = &t
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE trips SET
			vehicle_id = COALESCE(NULLIF($1,0), vehicle_id),
			driver_id = COALESCE(NULLIF($2,0), driver_id),
			distance_km = CASE WHEN $3 > 0 THEN $3 ELSE distance_km END,
			status = COALESCE(NULLIF($4,''), status),
			end_time = COALESCE($5, end_time)
		WHERE id = $6 AND company_id = $7
	`, req.VehicleID, req.DriverID, req.DistanceKm, req.Status, et, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "trip not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Trip updated"})
}

func deleteTripHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid trip id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM trips WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Trip deleted"})
}

func tripDashboardHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var total, planned, inProgress, completed, cancelled int64
	var totalKm float64
	ctx := c.Request.Context()
	_ = deps.Pool.QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE status = 'planned'),
		       COUNT(*) FILTER (WHERE status = 'in_progress'),
		       COUNT(*) FILTER (WHERE status = 'completed'),
		       COUNT(*) FILTER (WHERE status = 'cancelled'),
		       COALESCE(SUM(distance_km), 0)
		FROM trips WHERE company_id = $1
	`, companyID).Scan(&total, &planned, &inProgress, &completed, &cancelled, &totalKm)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"totalTrips": total, "planned": planned, "inProgress": inProgress,
		"completed": completed, "cancelled": cancelled, "totalDistanceKm": totalKm,
	}})
}

// ─── Route Handlers ──────────────────────────────────────

func listRoutesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(source, ''), COALESCE(destination, ''), COALESCE(distance_km, 0),
		       COALESCE(estimated_minutes, 0), COALESCE(is_active, FALSE)
		FROM routes WHERE company_id = $1 ORDER BY id ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type RouteResp struct {
		ID               int64   `json:"id"`
		Name             string  `json:"name"`
		Source           string  `json:"source"`
		Destination      string  `json:"destination"`
		DistanceKm       float64 `json:"distanceKm"`
		EstimatedMinutes int     `json:"estimatedMinutes"`
		IsActive         bool    `json:"isActive"`
	}
	list := make([]RouteResp, 0)
	for rows.Next() {
		var r RouteResp
		if err := rows.Scan(&r.ID, &r.Name, &r.Source, &r.Destination, &r.DistanceKm, &r.EstimatedMinutes, &r.IsActive); err == nil {
			list = append(list, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createRouteHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Name             string  `json:"name"`
		Source           string  `json:"source"`
		Destination      string  `json:"destination"`
		DistanceKm       float64 `json:"distanceKm"`
		EstimatedMinutes int     `json:"estimatedMinutes"`
		IsActive         *bool   `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		badRequest(c, "name is required")
		return
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO routes (company_id, name, source, destination, distance_km, estimated_minutes, is_active)
		VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), $5, $6, COALESCE($7, TRUE))
		RETURNING id
	`, companyID, req.Name, req.Source, req.Destination, req.DistanceKm, req.EstimatedMinutes, req.IsActive).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Route created"})
}

func updateRouteHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid route id")
		return
	}
	var req struct {
		Name             string  `json:"name"`
		Source           string  `json:"source"`
		Destination      string  `json:"destination"`
		DistanceKm       float64 `json:"distanceKm"`
		EstimatedMinutes int     `json:"estimatedMinutes"`
		IsActive         *bool   `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE routes SET
			name = COALESCE(NULLIF($1,''), name),
			source = COALESCE(NULLIF($2,''), source),
			destination = COALESCE(NULLIF($3,''), destination),
			distance_km = CASE WHEN $4 > 0 THEN $4 ELSE distance_km END,
			estimated_minutes = CASE WHEN $5 > 0 THEN $5 ELSE estimated_minutes END,
			is_active = COALESCE($6, is_active),
			updated_at = NOW()
		WHERE id = $7 AND company_id = $8
	`, req.Name, req.Source, req.Destination, req.DistanceKm, req.EstimatedMinutes, req.IsActive, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "route not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Route updated"})
}

func deleteRouteHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid route id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM routes WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Route deleted"})
}

// ─── Fleet Handlers ──────────────────────────────────────

func fleetDashboardHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	var (
		vehicles, devices, activeTrips, pendingLR       int64
		openGatePasses, pendingReminders, unackedAlerts int64
		tyresInUse, tyresScrap                          int64
	)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM vehicles WHERE company_id = $1", companyID).Scan(&vehicles)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices WHERE company_id = $1", companyID).Scan(&devices)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM fleet_trips WHERE company_id = $1 AND status = 'In Transit'", companyID).Scan(&activeTrips)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM loading_receipts WHERE company_id = $1 AND status <> 'Completed'", companyID).Scan(&pendingLR)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM gate_passes WHERE company_id = $1 AND status = 'In Transit'", companyID).Scan(&openGatePasses)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM reminders WHERE company_id = $1 AND is_acknowledged = FALSE AND due_date <= CURRENT_DATE + 30", companyID).Scan(&pendingReminders)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts WHERE company_id = $1 AND acknowledged = FALSE", companyID).Scan(&unackedAlerts)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FILTER (WHERE status = 'In Use'), COUNT(*) FILTER (WHERE status = 'Scrap') FROM tyre_records WHERE company_id = $1", companyID).Scan(&tyresInUse, &tyresScrap)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"totalVehicles": vehicles, "totalDevices": devices, "activeTrips": activeTrips,
		"pendingLoadingReceipts": pendingLR, "openGatePasses": openGatePasses,
		"pendingReminders": pendingReminders, "unacknowledgedAlerts": unackedAlerts,
		"tyresInUse": tyresInUse, "tyresScrapped": tyresScrap,
	}})
}

func listPartiesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(phone, ''), COALESCE(email, ''), COALESCE(address, ''), COALESCE(contact, '')
		FROM fleet_parties WHERE company_id = $1 ORDER BY name ASC LIMIT 500
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type PartyResp struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
		Address string `json:"address"`
		Contact string `json:"contact"`
	}
	list := make([]PartyResp, 0)
	for rows.Next() {
		var p PartyResp
		if err := rows.Scan(&p.ID, &p.Name, &p.Phone, &p.Email, &p.Address, &p.Contact); err == nil {
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createPartyHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Name    string `json:"name"`
		Contact string `json:"contact"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
		Address string `json:"address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		badRequest(c, "name is required")
		return
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO fleet_parties (company_id, name, contact, phone, email, address)
		VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''))
		RETURNING id
	`, companyID, req.Name, req.Contact, req.Phone, req.Email, req.Address).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Party created"})
}

func updatePartyHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid party id")
		return
	}
	var req struct {
		Name    string `json:"name"`
		Contact string `json:"contact"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
		Address string `json:"address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE fleet_parties SET
			name = COALESCE(NULLIF($1,''), name),
			contact = COALESCE(NULLIF($2,''), contact),
			phone = COALESCE(NULLIF($3,''), phone),
			email = COALESCE(NULLIF($4,''), email),
			address = COALESCE(NULLIF($5,''), address)
		WHERE id = $6 AND company_id = $7
	`, req.Name, req.Contact, req.Phone, req.Email, req.Address, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "party not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Party updated"})
}

func listLRHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT lr.id, lr.lr_number, COALESCE(p.name, ''), COALESCE(v.reg_number, ''),
		       COALESCE(lr.weight_kg, 0)::float8, COALESCE(lr.freight_amt, 0)::float8,
		       COALESCE(lr.advance_amt, 0)::float8, COALESCE(lr.status, '')
		FROM loading_receipts lr
		LEFT JOIN fleet_parties p ON lr.party_id = p.id
		LEFT JOIN vehicles v ON lr.vehicle_id = v.id
		WHERE lr.company_id = $1
		ORDER BY lr.id DESC LIMIT 100
	`, companyID)
	if err != nil {
		serverError(c, err)
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
	list := make([]LRResp, 0)
	for rows.Next() {
		var l LRResp
		if err := rows.Scan(&l.ID, &l.LRNo, &l.Party, &l.Vehicle, &l.WeightKg, &l.FreightAmt, &l.AdvanceAmt, &l.Status); err == nil {
			list = append(list, l)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createLRHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
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
		badRequest(c, err.Error())
		return
	}
	var vID *int64
	var pID *int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM vehicles WHERE reg_number = $1 AND company_id = $2 LIMIT 1", req.Vehicle, companyID).Scan(&vID)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM fleet_parties WHERE name ILIKE $1 AND company_id = $2 LIMIT 1", "%"+req.Party+"%", companyID).Scan(&pID)

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO loading_receipts (company_id, party_id, vehicle_id, lr_number, weight_kg, freight_amt, advance_amt, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
		RETURNING id
	`, companyID, pID, vID, req.LRNo, req.WeightKg, req.FreightAmt, req.AdvanceAmt).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	if req.LRNo == "" {
		lrNo := fmt.Sprintf("LR-%d", newID)
		_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE loading_receipts SET lr_number = $1 WHERE id = $2", lrNo, newID)
		req.LRNo = lrNo
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "lrNo": req.LRNo, "message": "Loading receipt created successfully"})
}

func updateLRHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid LR id")
		return
	}
	var req struct {
		Status     string  `json:"status"`
		WeightKg   float64 `json:"weightKg"`
		FreightAmt float64 `json:"freightAmt"`
		AdvanceAmt float64 `json:"advanceAmt"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE loading_receipts SET
			status = COALESCE(NULLIF($1,''), status),
			weight_kg = CASE WHEN $2 > 0 THEN $2 ELSE weight_kg END,
			freight_amt = CASE WHEN $3 > 0 THEN $3 ELSE freight_amt END,
			advance_amt = CASE WHEN $4 > 0 THEN $4 ELSE advance_amt END
		WHERE id = $5 AND company_id = $6
	`, req.Status, req.WeightKg, req.FreightAmt, req.AdvanceAmt, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "loading receipt not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Loading receipt updated"})
}

func listGatePassesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT gp.id, gp.pass_number, COALESCE(v.reg_number, ''), COALESCE(dr.name, ''),
		       COALESCE(gp.destination, ''), gp.issued_at, COALESCE(gp.status, '')
		FROM gate_passes gp
		LEFT JOIN vehicles v ON gp.vehicle_id = v.id
		LEFT JOIN drivers dr ON gp.driver_id = dr.id
		WHERE gp.company_id = $1
		ORDER BY gp.issued_at DESC LIMIT 100
	`, companyID)
	if err != nil {
		serverError(c, err)
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
	list := make([]GPResp, 0)
	for rows.Next() {
		var g GPResp
		var issued *time.Time
		if err := rows.Scan(&g.ID, &g.PassNo, &g.Vehicle, &g.Driver, &g.Destination, &issued, &g.Status); err == nil {
			g.IssuedAt = fmtTime(issued, "2006-01-02 15:04")
			list = append(list, g)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createGatePassHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Vehicle     string `json:"vehicle"`
		Driver      string `json:"driver"`
		Destination string `json:"destination"`
		Purpose     string `json:"purpose"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	var vID, dID *int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM vehicles WHERE (reg_number = $1 OR id::text = $1) AND company_id = $2 LIMIT 1", req.Vehicle, companyID).Scan(&vID)
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT id FROM drivers WHERE (name ILIKE $1 OR id::text = $1) AND company_id = $2 LIMIT 1", "%"+req.Driver+"%", companyID).Scan(&dID)

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO gate_passes (company_id, vehicle_id, driver_id, pass_number, destination, purpose, status, issued_at)
		VALUES ($1, $2, $3, '', NULLIF($4,''), NULLIF($5,''), 'issued', NOW())
		RETURNING id
	`, companyID, vID, dID, req.Destination, req.Purpose).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	passNum := fmt.Sprintf("GP-%d-%04d", time.Now().Year(), newID%10000)
	_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE gate_passes SET pass_number = $1 WHERE id = $2", passNum, newID)

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "passNo": passNum, "message": "Gate pass created successfully"})
}

// ─── Alert Handlers ──────────────────────────────────────

func listAlertsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT a.id, a.type, COALESCE(a.severity, 'info'), a.message, a.acknowledged, a.created_at,
		       COALESCE(v.reg_number, d.imei, '') AS vehicle,
		       COALESCE(dr.name, '') AS driver,
		       COALESCE(dr.phone, '') AS driver_phone,
		       ST_Y(a.location)::float8, ST_X(a.location)::float8
		FROM alerts a
		LEFT JOIN devices d ON a.device_id = d.id
		LEFT JOIN LATERAL (
			SELECT vv.id, vv.reg_number
			FROM vehicles vv
			WHERE vv.company_id = a.company_id
			  AND (vv.device_id = a.device_id OR vv.id = a.device_id)
			ORDER BY (vv.device_id = a.device_id) DESC, vv.id ASC
			LIMIT 1
		) v ON TRUE
		LEFT JOIN LATERAL (
			SELECT dd.name, dd.phone
			FROM drivers dd
			WHERE dd.company_id = a.company_id AND dd.assigned_vehicle_id = v.id
			ORDER BY dd.id ASC
			LIMIT 1
		) dr ON TRUE
		WHERE a.company_id = $1
		ORDER BY a.created_at DESC
		LIMIT 200
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type AlertResp struct {
		ID           int64    `json:"id"`
		Type         string   `json:"type"`
		Severity     string   `json:"severity"`
		Vehicle      string   `json:"vehicle"`
		Driver       string   `json:"driver"`
		DriverPhone  string   `json:"driverPhone"`
		Message      string   `json:"message"`
		Time         string   `json:"time"`
		Timestamp    string   `json:"timestamp"`
		Acknowledged bool     `json:"acknowledged"`
		Lat          *float64 `json:"lat,omitempty"`
		Lng          *float64 `json:"lng,omitempty"`
	}

	list := make([]AlertResp, 0)
	for rows.Next() {
		var a AlertResp
		var createdAt time.Time
		if err := rows.Scan(&a.ID, &a.Type, &a.Severity, &a.Message, &a.Acknowledged, &createdAt,
			&a.Vehicle, &a.Driver, &a.DriverPhone, &a.Lat, &a.Lng); err != nil {
			continue
		}
		a.Time = createdAt.Format("03:04 pm")
		a.Timestamp = createdAt.Format(time.RFC3339)
		list = append(list, a)
	}
	var total int64
	_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM alerts WHERE company_id = $1", companyID).Scan(&total)
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "total": total, "count": len(list), "data": list})
}

func acknowledgeAlertHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid alert id")
		return
	}
	userID := c.GetInt64("user_id")
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE alerts SET acknowledged = TRUE, acknowledged_by = NULLIF($1, 0)
		WHERE id = $2 AND company_id = $3
	`, userID, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "alert not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert acknowledged"})
}

// acknowledgeAllAlertsHandler marks every unacknowledged alert of the tenant as
// acknowledged. This backs the notification bell's "Mark all read" action so it
// persists across refreshes instead of only clearing the visible page.
func acknowledgeAllAlertsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	userID := c.GetInt64("user_id")
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE alerts SET acknowledged = TRUE, acknowledged_by = NULLIF($1, 0)
		WHERE company_id = $2 AND acknowledged = FALSE
	`, userID, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"acknowledged": tag.RowsAffected(),
		"message":      "All alerts acknowledged",
	})
}

func listAlertRulesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, type, COALESCE(description, ''), COALESCE(sms_enabled, FALSE),
		       COALESCE(email_enabled, FALSE), COALESCE(sms_template, ''), COALESCE(config, '{}'), COALESCE(is_active, FALSE)
		FROM alert_rules WHERE company_id = $1 ORDER BY id ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type RuleResp struct {
		ID           int64       `json:"id"`
		Name         string      `json:"name"`
		Type         string      `json:"type"`
		Description  string      `json:"description"`
		SMSEnabled   bool        `json:"smsEnabled"`
		EmailEnabled bool        `json:"emailEnabled"`
		SMSTemplate  string      `json:"smsTemplate"`
		Config       interface{} `json:"config"`
		IsActive     bool        `json:"isActive"`
	}
	list := make([]RuleResp, 0)
	for rows.Next() {
		var r RuleResp
		var configJSON []byte
		if err := rows.Scan(&r.ID, &r.Name, &r.Type, &r.Description, &r.SMSEnabled, &r.EmailEnabled,
			&r.SMSTemplate, &configJSON, &r.IsActive); err != nil {
			continue
		}
		if len(configJSON) > 0 {
			var cfg interface{}
			if err := json.Unmarshal(configJSON, &cfg); err == nil {
				r.Config = cfg
			}
		}
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createAlertRuleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Name         string      `json:"name"`
		Type         string      `json:"type"`
		Description  string      `json:"description"`
		Config       interface{} `json:"config"`
		SMSEnabled   bool        `json:"smsEnabled"`
		EmailEnabled bool        `json:"emailEnabled"`
		SMSTemplate  string      `json:"smsTemplate"`
		IsActive     *bool       `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Type) == "" {
		badRequest(c, "name and type are required")
		return
	}
	configBytes, _ := json.Marshal(req.Config)
	if len(configBytes) == 0 {
		configBytes = []byte("{}")
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO alert_rules (company_id, name, type, description, config, sms_enabled, email_enabled, sms_template, is_active)
		VALUES ($1,$2,$3,NULLIF($4,''),$5,$6,$7,NULLIF($8,''),COALESCE($9,TRUE))
		RETURNING id
	`, companyID, req.Name, req.Type, req.Description, configBytes, req.SMSEnabled, req.EmailEnabled, req.SMSTemplate, req.IsActive).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Alert rule created"})
}

func updateAlertRuleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid rule id")
		return
	}
	var req struct {
		Name         string      `json:"name"`
		Description  string      `json:"description"`
		Config       interface{} `json:"config"`
		SMSEnabled   *bool       `json:"smsEnabled"`
		EmailEnabled *bool       `json:"emailEnabled"`
		SMSTemplate  string      `json:"smsTemplate"`
		IsActive     *bool       `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	var configBytes []byte
	if req.Config != nil {
		configBytes, _ = json.Marshal(req.Config)
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE alert_rules SET
			name = COALESCE(NULLIF($1,''), name),
			description = COALESCE(NULLIF($2,''), description),
			config = COALESCE($3, config),
			sms_enabled = COALESCE($4, sms_enabled),
			email_enabled = COALESCE($5, email_enabled),
			sms_template = COALESCE(NULLIF($6,''), sms_template),
			is_active = COALESCE($7, is_active)
		WHERE id = $8 AND company_id = $9
	`, req.Name, req.Description, configBytes, req.SMSEnabled, req.EmailEnabled, req.SMSTemplate, req.IsActive, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "rule not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert rule updated"})
}

func deleteAlertRuleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid rule id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM alert_rules WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert rule deleted"})
}

func getSmsConfigHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var provider, senderID, apiKey string
	var enabled bool
	err := deps.Pool.QueryRow(c.Request.Context(), `
		SELECT COALESCE(provider, ''), COALESCE(sender_id, ''), COALESCE(api_key, ''), COALESCE(enabled, FALSE)
		FROM sms_config WHERE company_id = $1
	`, companyID).Scan(&provider, &senderID, &apiKey, &enabled)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
			"provider": "", "senderId": "", "apiKey": "", "enabled": false,
		}})
		return
	}
	// Mask the stored key; the raw secret stays in the database.
	masked := ""
	if len(apiKey) > 4 {
		masked = strings.Repeat("*", len(apiKey)-4) + apiKey[len(apiKey)-4:]
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"provider": provider, "senderId": senderID, "apiKey": masked, "enabled": enabled,
	}})
}

func updateSmsConfigHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		Provider string `json:"provider"`
		SenderID string `json:"senderId"`
		APIKey   string `json:"apiKey"`
		Enabled  *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	_, err := deps.Pool.Exec(c.Request.Context(), `
		INSERT INTO sms_config (company_id, provider, sender_id, api_key, enabled, updated_at)
		VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), COALESCE($5, FALSE), NOW())
		ON CONFLICT (company_id) DO UPDATE SET
			provider = COALESCE(NULLIF($2,''), sms_config.provider),
			sender_id = COALESCE(NULLIF($3,''), sms_config.sender_id),
			api_key = CASE WHEN $4 <> '' AND $4 NOT LIKE '%****%' THEN $4 ELSE sms_config.api_key END,
			enabled = COALESCE($5, sms_config.enabled),
			updated_at = NOW()
	`, companyID, req.Provider, req.SenderID, req.APIKey, req.Enabled)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "SMS gateway configuration updated"})
}

// ─── WebSocket Handler ───────────────────────────────────

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// The hub only broadcasts tenant-scoped data to authenticated clients.
		return true
	},
}

// wsTrackingHandler upgrades the connection and streams positions for the
// tenant encoded in the JWT. Unauthenticated sockets are rejected.
func wsTrackingHandler(c *gin.Context, hub *ws.Hub, logger *zap.Logger) {
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "token query parameter is required"})
		return
	}
	token, err := jwt.ParseWithClaims(tokenStr, &middleware.JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid or expired token"})
		return
	}
	claims, ok := token.Claims.(*middleware.JWTClaims)
	if !ok || claims.CompanyID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "token has no tenant scope"})
		return
	}
	companyID := claims.CompanyID

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Warn("failed to upgrade websocket connection", zap.Error(err))
		return
	}

	client := ws.NewClient(fmt.Sprintf("client-%d", time.Now().UnixNano()), companyID)
	hub.Register <- client

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
