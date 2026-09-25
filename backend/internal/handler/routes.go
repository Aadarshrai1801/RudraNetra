// Package handler registers all HTTP and WebSocket routes for the API.
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/rudra-netra/backend/internal/handler/middleware"
)

// RegisterRoutes sets up all API route groups on the Gin router.
func RegisterRoutes(router *gin.Engine, d *Dependencies) {
	SetDependencies(d)
	hub := d.Hub
	logger := d.Logger

	// Health check (no auth)
	router.GET("/health", func(c *gin.Context) {
		wsCount := 0
		if hub != nil {
			wsCount = hub.ConnectedCount()
		}
		c.JSON(http.StatusOK, gin.H{
			"status":     "ok",
			"service":    "rudra-api",
			"ws_clients": wsCount,
		})
	})

	// ─── Public Routes ───────────────────────────────────
	auth := router.Group("/api/v1/auth")
	{
		auth.POST("/login", loginHandler)
		auth.POST("/signup", signupHandler)
		auth.POST("/register", signupHandler)
		auth.GET("/companies", listCompaniesHandler)
		auth.POST("/refresh", refreshTokenHandler)
	}

	// ─── Protected Routes (require JWT) ──────────────────
	api := router.Group("/api/v1")
	api.Use(middleware.Auth())
	{
		// Password management
		api.POST("/auth/change-password", changePasswordHandler)

		// ── Tracking ─────────────────────────────────────
		tracking := api.Group("/tracking")
		{
			tracking.GET("/positions", getPositionsHandler)          // all devices current position
			tracking.GET("/positions/:id", getDevicePositionHandler) // single device
			tracking.GET("/history/:id", getHistoryHandler)          // playback data
			tracking.GET("/clusters", getClustersHandler)            // clustered markers
		}

		// ── Devices ──────────────────────────────────────
		devices := api.Group("/devices")
		{
			devices.GET("", listDevicesHandler)
			devices.GET("/:id", getDeviceHandler)
			devices.POST("", createDeviceHandler)
			devices.PUT("/:id", updateDeviceHandler)
			devices.DELETE("/:id", deleteDeviceHandler)
			devices.POST("/:id/assign", assignDeviceHandler)
			devices.GET("/:id/config", getDeviceConfigHandler)
			devices.PUT("/:id/config", updateDeviceConfigHandler)
		}

		// ── Vehicles ─────────────────────────────────────
		vehicles := api.Group("/vehicles")
		{
			vehicles.GET("", listVehiclesHandler)
			vehicles.GET("/:id", getVehicleHandler)
			vehicles.POST("", createVehicleHandler)
			vehicles.PUT("/:id", updateVehicleHandler)
			vehicles.PUT("/:id/config", updateVehicleConfigHandler)
		}

		// ── Drivers ──────────────────────────────────────
		drivers := api.Group("/drivers")
		{
			drivers.GET("", listDriversHandler)
			drivers.GET("/:id", getDriverHandler)
			drivers.POST("", createDriverHandler)
			drivers.PUT("/:id", updateDriverHandler)
			drivers.DELETE("/:id", deleteDriverHandler)
		}

		// ── Geofences ────────────────────────────────────
		geofences := api.Group("/geofences")
		{
			geofences.GET("", listGeofencesHandler)
			geofences.GET("/:id", getGeofenceHandler)
			geofences.POST("", createGeofenceHandler)
			geofences.PUT("/:id", updateGeofenceHandler)
			geofences.DELETE("/:id", deleteGeofenceHandler)
			geofences.POST("/check", checkGeofenceHandler)
		}

		// ── POI ──────────────────────────────────────────
		poi := api.Group("/poi")
		{
			poi.GET("", listPOIHandler)
			poi.POST("", createPOIHandler)
			poi.PUT("/:id", updatePOIHandler)
			poi.DELETE("/:id", deletePOIHandler)
			poi.GET("/nearest", nearestPOIHandler)
		}

		// ── Reminders & Compliance ──────────────────────
		reminders := api.Group("/reminders")
		{
			reminders.GET("", listRemindersHandler)
			reminders.POST("", createReminderHandler)
			reminders.PUT("/:id", updateReminderHandler)
			reminders.DELETE("/:id", deleteReminderHandler)
		}

		// ── Remote Commands & Immobilizer ────────────────
		commands := api.Group("/commands")
		{
			commands.GET("/logs", listAllCommandLogsHandler)
		}
		devices.POST("/:id/commands", sendDeviceCommandHandler)
		devices.GET("/:id/commands", listDeviceCommandsHandler)

		// ── Temporary Guest Sharing ──────────────────────
		tempUsers := api.Group("/temp-users")
		{
			tempUsers.GET("", listTempUsersHandler)
			tempUsers.POST("", createTempUserHandler)
			tempUsers.DELETE("/:id", deleteTempUserHandler)
		}

		// ── Groups ───────────────────────────────────────
		groups := api.Group("/groups")
		{
			groups.GET("", listGroupsHandler)
			groups.POST("", createGroupHandler)
			groups.PUT("/:id", updateGroupHandler)
			groups.DELETE("/:id", deleteGroupHandler)
			groups.POST("/:id/devices", addDevicesToGroupHandler)
		}

		// ── Trips ────────────────────────────────────────
		trips := api.Group("/trips")
		{
			trips.GET("", listTripsHandler)
			trips.GET("/:id", getTripHandler)
			trips.POST("", createTripHandler)
			trips.PUT("/:id", updateTripHandler)
			trips.DELETE("/:id", deleteTripHandler)
			trips.GET("/dashboard", tripDashboardHandler)
		}

		// ── Routes ───────────────────────────────────────
		routes := api.Group("/routes")
		{
			routes.GET("", listRoutesHandler)
			routes.POST("", createRouteHandler)
			routes.PUT("/:id", updateRouteHandler)
			routes.DELETE("/:id", deleteRouteHandler)
		}

		// ── Fleet Operations ─────────────────────────────
		fleet := api.Group("/fleet")
		{
			fleet.GET("/dashboard", fleetDashboardHandler)

			fleet.GET("/parties", listPartiesHandler)
			fleet.POST("/parties", createPartyHandler)
			fleet.PUT("/parties/:id", updatePartyHandler)

			fleet.GET("/lr", listLRHandler)
			fleet.POST("/lr", createLRHandler)
			fleet.PUT("/lr/:id", updateLRHandler)

			fleet.GET("/trips", listFleetTripsHandler)
			fleet.POST("/trips", createFleetTripHandler)
			fleet.PUT("/trips/:id", updateFleetTripHandler)

			fleet.GET("/party-routes", listPartyRoutesHandler)
			fleet.POST("/party-routes", createPartyRouteHandler)

			fleet.GET("/vouchers", listVouchersHandler)
			fleet.POST("/vouchers", createVoucherHandler)

			fleet.GET("/gate-passes", listGatePassesHandler)
			fleet.POST("/gate-passes", createGatePassHandler)

			fleet.GET("/tyres", listTyresHandler)
			fleet.POST("/tyres", createTyreHandler)
			fleet.PUT("/tyres/:id", updateTyreHandler)
			fleet.DELETE("/tyres/:id", deleteTyreHandler)
		}

		// ── Alerts & SMS ─────────────────────────────────
		alerts := api.Group("/alerts")
		{
			alerts.GET("", listAlertsHandler)
			alerts.PUT("/:id/acknowledge", acknowledgeAlertHandler)
			alerts.GET("/rules", listAlertRulesHandler)
			alerts.POST("/rules", createAlertRuleHandler)
			alerts.PUT("/rules/:id", updateAlertRuleHandler)
			alerts.DELETE("/rules/:id", deleteAlertRuleHandler)
			alerts.GET("/sms-config", getSmsConfigHandler)
			alerts.PUT("/sms-config", updateSmsConfigHandler)
		}

		// ── Reports ──────────────────────────────────────
		reports := api.Group("/reports")
		{
			reports.GET("/:type", getReportHandler)
			reports.GET("/export/:type", exportReportHandler)
		}

		// ── Dashboard ────────────────────────────────────
		dashboard := api.Group("/dashboard")
		{
			dashboard.GET("/summary", dashboardSummaryHandler)
			dashboard.GET("/analytics", dashboardAnalyticsHandler)
		}

		// ── RFID ─────────────────────────────────────────
		rfid := api.Group("/rfid")
		{
			rfid.GET("/tags", listRFIDTagsHandler)
			rfid.POST("/tags", createRFIDTagHandler)
			rfid.POST("/assign", assignRFIDHandler)
		}

		// ── Invoices ─────────────────────────────────────
		invoices := api.Group("/invoices")
		{
			invoices.GET("", listInvoicesHandler)
			invoices.GET("/:id", getInvoiceHandler)
			invoices.POST("", createInvoiceHandler)
			invoices.PUT("/:id", updateInvoiceHandler)
			invoices.GET("/:id/pdf", downloadInvoicePDFHandler)
		}

		// ── Complaints ───────────────────────────────────
		complaints := api.Group("/complaints")
		{
			complaints.GET("", listComplaintsHandler)
			complaints.POST("", createComplaintHandler)
			complaints.PUT("/:id", updateComplaintHandler)
		}

		// ── Masters (generic CRUD for lookup tables) ─────
		masters := api.Group("/masters")
		{
			masters.GET("/:type", listMastersHandler)
			masters.POST("/:type", createMasterHandler)
			masters.PUT("/:type/:id", updateMasterHandler)
			masters.DELETE("/:type/:id", deleteMasterHandler)
		}
	}

	// ─── SuperAdmin Routes (require superadmin role only) ───────────────
	admin := router.Group("/api/v1/admin")
	admin.Use(middleware.Auth(), middleware.RequireRole("superadmin"))
	{
		admin.GET("/dashboard", adminDashboardHandler)
		admin.GET("/stats", adminStatsHandler)
		admin.GET("/mis-report", adminMISReportHandler)

		admin.GET("/companies", listCompaniesHandler)
		admin.POST("/companies", createCompanyHandler)
		admin.PUT("/companies/:id", updateCompanyHandler)

		admin.GET("/users", adminListUsersHandler)
		admin.POST("/users", adminCreateUserHandler)
		admin.PUT("/users/:id", adminUpdateUserHandler)

		admin.GET("/devices", adminListDevicesHandler)
		admin.POST("/devices", adminCreateDeviceHandler)
		admin.PUT("/devices/:id", adminUpdateDeviceHandler)

		admin.GET("/extensions", adminListExtensionsHandler)
		admin.POST("/extensions", adminCreateExtensionHandler)

		admin.GET("/warranty", adminListWarrantyHandler)
		admin.POST("/warranty", adminCreateWarrantyHandler)

		admin.GET("/raw-data", adminListRawDataHandler)

		admin.GET("/toll-data", adminListTollDataHandler)
		admin.POST("/toll-data", adminCreateTollDataHandler)

		admin.GET("/roles", listRolesHandler)
		admin.POST("/roles", createRoleHandler)
		admin.PUT("/roles/:id", updateRoleHandler)

		admin.GET("/billing", listBillingHandler)
		admin.POST("/billing", createBillingHandler)

		admin.GET("/masters/:type", adminListMastersHandler)
		admin.POST("/masters/:type", adminCreateMasterHandler)
		admin.PUT("/masters/:type/:id", adminUpdateMasterHandler)
		admin.DELETE("/masters/:type/:id", adminDeleteMasterHandler)
	}

	// ─── WebSocket Endpoint ──────────────────────────────
	router.GET("/ws/tracking", func(c *gin.Context) {
		wsTrackingHandler(c, hub, logger)
	})
}
