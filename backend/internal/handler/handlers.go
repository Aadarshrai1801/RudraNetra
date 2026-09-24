package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
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
}

var deps *Dependencies

// SetDependencies sets the global handler dependencies.
func SetDependencies(d *Dependencies) {
	deps = d
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
	if deps == nil || deps.Companies == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": []gin.H{
				{"id": 1, "name": "Allied Transport UAE", "code": "COMP_1"},
				{"id": 2, "name": "EKSC Logistics Dubai", "code": "EKSC"},
			},
		})
		return
	}

	companies, err := deps.Companies.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    companies,
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
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "get history", "id": c.Param("id")})
}

func getClustersHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "get clusters"})
}

// ─── Device Handlers ─────────────────────────────────────

func listDevicesHandler(c *gin.Context)       { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func getDeviceHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createDeviceHandler(c *gin.Context)      { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateDeviceHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteDeviceHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
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

func listDriversHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func getDriverHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createDriverHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateDriverHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteDriverHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Geofence Handlers ──────────────────────────────────

func listGeofencesHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func getGeofenceHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createGeofenceHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateGeofenceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteGeofenceHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true}) }
func checkGeofenceHandler(c *gin.Context)  { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── POI Handlers ────────────────────────────────────────

func listPOIHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
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

func listTripsHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
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
func listPartiesHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createPartyHandler(c *gin.Context)    { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updatePartyHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listLRHandler(c *gin.Context)         { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createLRHandler(c *gin.Context)       { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateLRHandler(c *gin.Context)       { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listVouchersHandler(c *gin.Context)   { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createVoucherHandler(c *gin.Context)  { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func listGatePassesHandler(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createGatePassHandler(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func listTyresHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createTyreHandler(c *gin.Context)     { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateTyreHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Alert Handlers ──────────────────────────────────────

func listAlertsHandler(c *gin.Context)          { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func acknowledgeAlertHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true}) }
func listAlertRulesHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true, "data": []string{}}) }
func createAlertRuleHandler(c *gin.Context)     { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateAlertRuleHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }
func deleteAlertRuleHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }
func getSmsConfigHandler(c *gin.Context)        { c.JSON(http.StatusOK, gin.H{"success": true}) }
func updateSmsConfigHandler(c *gin.Context)     { c.JSON(http.StatusOK, gin.H{"success": true}) }

// ─── Report Handlers ─────────────────────────────────────

func getReportHandler(c *gin.Context)    { c.JSON(http.StatusOK, gin.H{"success": true, "type": c.Param("type")}) }
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

func adminDashboardHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func adminStatsHandler(c *gin.Context)          { c.JSON(http.StatusOK, gin.H{"success": true}) }
func adminMISReportHandler(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"success": true}) }
func createCompanyHandler(c *gin.Context)       { c.JSON(http.StatusCreated, gin.H{"success": true}) }
func updateCompanyHandler(c *gin.Context)       { c.JSON(http.StatusOK, gin.H{"success": true}) }
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
