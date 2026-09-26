package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─────────────────────────────────────────────────────────────
// 1. Reminders & Compliance Handlers
// ─────────────────────────────────────────────────────────────

type ReminderResp struct {
	ID              int64  `json:"id"`
	VehicleID       int64  `json:"vehicleId"`
	VehicleReg      string `json:"vehicleReg"`
	ReminderType    string `json:"reminderType"`
	DueDate         string `json:"dueDate"`
	DueKM           int64  `json:"dueKm"`
	AlertBeforeDays int    `json:"alertBeforeDays"`
	AlertBeforeKM   int    `json:"alertBeforeKm"`
	Notes           string `json:"notes"`
	IsAcknowledged  bool   `json:"isAcknowledged"`
	Status          string `json:"status"`
	DaysRemaining   int    `json:"daysRemaining"`
}

func listRemindersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT r.id, COALESCE(r.vehicle_id, 0), COALESCE(v.reg_number, ''),
		       r.reminder_type, r.due_date, COALESCE(r.due_km, 0),
		       COALESCE(r.alert_before_days, 0), COALESCE(r.alert_before_km, 0),
		       COALESCE(r.notes, ''), COALESCE(r.is_acknowledged, FALSE)
		FROM reminders r
		LEFT JOIN vehicles v ON r.vehicle_id = v.id
		WHERE r.company_id = $1
		ORDER BY r.due_date ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]ReminderResp, 0)
	now := time.Now()
	for rows.Next() {
		var r ReminderResp
		var dueDate time.Time
		if err := rows.Scan(&r.ID, &r.VehicleID, &r.VehicleReg, &r.ReminderType, &dueDate,
			&r.DueKM, &r.AlertBeforeDays, &r.AlertBeforeKM, &r.Notes, &r.IsAcknowledged); err != nil {
			continue
		}
		r.DueDate = dueDate.Format("2006-01-02")
		r.DaysRemaining = int(dueDate.Sub(now).Hours() / 24)
		switch {
		case r.IsAcknowledged:
			r.Status = "Acknowledged"
		case r.DaysRemaining < 0:
			r.Status = "Expired"
		case r.AlertBeforeDays > 0 && r.DaysRemaining <= r.AlertBeforeDays:
			r.Status = "Due Soon"
		default:
			r.Status = "Valid"
		}
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createReminderHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		VehicleID       int64  `json:"vehicleId"`
		ReminderType    string `json:"reminderType"`
		DueDate         string `json:"dueDate"`
		DueKM           int64  `json:"dueKm"`
		AlertBeforeDays int    `json:"alertBeforeDays"`
		AlertBeforeKM   int    `json:"alertBeforeKm"`
		Notes           string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.ReminderType) == "" || req.DueDate == "" {
		badRequest(c, "reminderType and dueDate are required")
		return
	}
	dueTime, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		badRequest(c, "dueDate must be formatted YYYY-MM-DD")
		return
	}

	var newID int64
	err = deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO reminders (company_id, vehicle_id, reminder_type, due_date, due_km, alert_before_days, alert_before_km, notes, created_at, updated_at)
		VALUES ($1, NULLIF($2,0), $3, $4, $5, NULLIF($6,0), $7, NULLIF($8,''), NOW(), NOW())
		RETURNING id
	`, companyID, req.VehicleID, req.ReminderType, dueTime, req.DueKM, req.AlertBeforeDays, req.AlertBeforeKM, req.Notes).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Compliance reminder scheduled successfully"})
}

func updateReminderHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid reminder id")
		return
	}
	var req struct {
		IsAcknowledged  *bool  `json:"isAcknowledged"`
		DueDate         string `json:"dueDate"`
		Notes           string `json:"notes"`
		AlertBeforeDays int    `json:"alertBeforeDays"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	var due *time.Time
	if req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			due = &t
		}
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE reminders SET
			is_acknowledged = COALESCE($1, is_acknowledged),
			due_date = COALESCE($2, due_date),
			notes = COALESCE(NULLIF($3,''), notes),
			alert_before_days = CASE WHEN $4 > 0 THEN $4 ELSE alert_before_days END,
			updated_at = NOW()
		WHERE id = $5 AND company_id = $6
	`, req.IsAcknowledged, due, req.Notes, req.AlertBeforeDays, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "reminder not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Reminder updated"})
}

func deleteReminderHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid reminder id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM reminders WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Reminder removed"})
}

// ─────────────────────────────────────────────────────────────
// 2. Remote Commands & Immobilizer Handlers
// ─────────────────────────────────────────────────────────────

type CommandRecord struct {
	ID          int64  `json:"id"`
	DeviceID    int64  `json:"deviceId"`
	VehicleReg  string `json:"vehicleReg"`
	CommandType string `json:"commandType"`
	CommandStr  string `json:"commandStr"`
	SentBy      string `json:"sentBy"`
	Status      string `json:"status"`
	SentAt      string `json:"sentAt"`
	AckAt       string `json:"ackAt,omitempty"`
}

// commandPayload maps a logical command to its Teltonika/Concox protocol string.
// This is a protocol constant, not stored data.
func commandPayload(commandType string) string {
	switch commandType {
	case "IEngineOff":
		return "setdigout 1"
	case "IEngineOn":
		return "setdigout 0"
	case "IAcOff":
		return "setdigout 01"
	case "IDoorOff":
		return "setdigout 001"
	case "SirenHooter":
		return "setdigout 0001 5"
	case "Reboot":
		return "cpureset"
	default:
		return commandType
	}
}

func sendDeviceCommandHandler(c *gin.Context) {
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

	var req struct {
		CommandType string `json:"commandType"`
		Pin         string `json:"pin"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.CommandType) == "" {
		badRequest(c, "commandType is required")
		return
	}

	// The immobilizer PIN is tenant configuration stored in the database.
	if req.CommandType == "IEngineOff" || req.CommandType == "IDoorOff" {
		var pin string
		if err := deps.Pool.QueryRow(c.Request.Context(),
			"SELECT COALESCE(immobilizer_pin, '') FROM company_settings WHERE company_id = $1",
			companyID).Scan(&pin); err != nil || pin == "" || req.Pin != pin {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid authorization security PIN for immobilizer command"})
			return
		}
	}

	var exists bool
	if err := deps.Pool.QueryRow(c.Request.Context(),
		"SELECT EXISTS(SELECT 1 FROM devices WHERE id = $1 AND company_id = $2)",
		deviceID, companyID).Scan(&exists); err != nil {
		serverError(c, err)
		return
	}
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found for this organization"})
		return
	}

	sentBy, _ := c.Get("username")
	sentByStr, _ := sentBy.(string)
	if sentByStr == "" {
		if emailVal, exists := c.Get("user_email"); exists {
			if s, ok := emailVal.(string); ok {
				sentByStr = s
			}
		}
	}

	rawCmd := commandPayload(req.CommandType)
	var newID int64
	err = deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO device_commands (company_id, device_id, vehicle_id, command_type, command_payload, sent_by, status, sent_at)
		VALUES ($1, $2, (SELECT id FROM vehicles WHERE device_id = $2 AND company_id = $1 LIMIT 1),
		        $3, $4, NULLIF($5,''), 'Sent', NOW())
		RETURNING id
	`, companyID, deviceID, req.CommandType, rawCmd, sentByStr).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"commandId":   newID,
		"commandType": req.CommandType,
		"rawCommand":  rawCmd,
		"status":      "Sent",
		"message":     fmt.Sprintf("Command '%s' queued for delivery to the hardware unit.", req.CommandType),
	})
}

func listDeviceCommandsHandler(c *gin.Context) {
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

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT c.id, c.device_id, COALESCE(v.reg_number, d.imei, ''), c.command_type,
		       COALESCE(c.command_payload, ''), COALESCE(c.sent_by, ''), c.status, c.sent_at
		FROM device_commands c
		LEFT JOIN devices d ON c.device_id = d.id
		LEFT JOIN vehicles v ON v.device_id = d.id
		WHERE c.company_id = $1 AND c.device_id = $2
		ORDER BY c.sent_at DESC
		LIMIT 100
	`, companyID, deviceID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]CommandRecord, 0)
	for rows.Next() {
		var rec CommandRecord
		var sentAt time.Time
		if err := rows.Scan(&rec.ID, &rec.DeviceID, &rec.VehicleReg, &rec.CommandType,
			&rec.CommandStr, &rec.SentBy, &rec.Status, &sentAt); err != nil {
			continue
		}
		rec.SentAt = sentAt.Format("2006-01-02 15:04:05")
		list = append(list, rec)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func listAllCommandLogsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT c.id, c.device_id, COALESCE(v.reg_number, d.imei, ''), c.command_type,
		       COALESCE(c.command_payload, ''), COALESCE(c.sent_by, ''), c.status, c.sent_at
		FROM device_commands c
		LEFT JOIN devices d ON c.device_id = d.id
		LEFT JOIN vehicles v ON v.device_id = d.id
		WHERE c.company_id = $1
		ORDER BY c.sent_at DESC
		LIMIT 200
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]CommandRecord, 0)
	for rows.Next() {
		var rec CommandRecord
		var sentAt time.Time
		if err := rows.Scan(&rec.ID, &rec.DeviceID, &rec.VehicleReg, &rec.CommandType,
			&rec.CommandStr, &rec.SentBy, &rec.Status, &sentAt); err != nil {
			continue
		}
		rec.SentAt = sentAt.Format("2006-01-02 15:04:05")
		list = append(list, rec)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

// ─────────────────────────────────────────────────────────────
// 3. Temporary Guest Sharing Handlers
// ─────────────────────────────────────────────────────────────

type TempUserResp struct {
	ID          int64    `json:"id"`
	GuestName   string   `json:"guestName"`
	ShareLink   string   `json:"shareLink"`
	AccessToken string   `json:"accessToken"`
	VehicleIDs  []string `json:"vehicleIds"`
	ExpiresAt   string   `json:"expiresAt"`
	CreatedAt   string   `json:"createdAt"`
	Status      string   `json:"status"`
}

func listTempUsersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, guest_name, access_token, COALESCE(vehicle_ids, '[]'), expires_at, created_at
		FROM temp_users
		WHERE company_id = $1
		ORDER BY created_at DESC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]TempUserResp, 0)
	now := time.Now()
	for rows.Next() {
		var u TempUserResp
		var exp, cat time.Time
		var vehIDs string
		if err := rows.Scan(&u.ID, &u.GuestName, &u.AccessToken, &vehIDs, &exp, &cat); err != nil {
			continue
		}
		u.ExpiresAt = exp.Format("2006-01-02 15:04")
		u.CreatedAt = cat.Format("2006-01-02 15:04")
		u.ShareLink = fmt.Sprintf("/live?guest_token=%s", u.AccessToken)
		u.VehicleIDs = parseVehicleIDs(vehIDs)
		if now.After(exp) {
			u.Status = "Expired"
		} else {
			u.Status = "Active"
		}
		list = append(list, u)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

// parseVehicleIDs reads the JSON array stored in temp_users.vehicle_ids.
func parseVehicleIDs(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "[")
	trimmed = strings.TrimSuffix(trimmed, "]")
	out := make([]string, 0)
	if strings.TrimSpace(trimmed) == "" {
		return out
	}
	for _, part := range strings.Split(trimmed, ",") {
		v := strings.TrimSpace(part)
		v = strings.Trim(v, "\"")
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func createTempUserHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		GuestName     string   `json:"guestName"`
		DurationHours int      `json:"durationHours"`
		VehicleIDs    []string `json:"vehicleIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.GuestName) == "" {
		badRequest(c, "guestName is required")
		return
	}
	if req.DurationHours <= 0 {
		badRequest(c, "durationHours must be a positive number of hours")
		return
	}

	tokenBytes := make([]byte, 8)
	_, _ = rand.Read(tokenBytes)
	token := "gst_" + hex.EncodeToString(tokenBytes)
	expiresAt := time.Now().Add(time.Duration(req.DurationHours) * time.Hour)

	vehJSON := "[]"
	if len(req.VehicleIDs) > 0 {
		quoted := make([]string, len(req.VehicleIDs))
		for i, v := range req.VehicleIDs {
			quoted[i] = "\"" + strings.ReplaceAll(v, "\"", "") + "\""
		}
		vehJSON = "[" + strings.Join(quoted, ",") + "]"
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO temp_users (company_id, guest_name, access_token, vehicle_ids, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING id
	`, companyID, req.GuestName, token, vehJSON, expiresAt).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":     true,
		"id":          newID,
		"accessToken": token,
		"shareLink":   fmt.Sprintf("/live?guest_token=%s", token),
		"expiresAt":   expiresAt.Format("2006-01-02 15:04:05"),
		"message":     "Temporary guest tracking link created successfully",
	})
}

func deleteTempUserHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid guest id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM temp_users WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Guest access revoked"})
}

// ─────────────────────────────────────────────────────────────
// 4. Fleet Operations (Trips, Party Routes, Vouchers, Tyres)
// ─────────────────────────────────────────────────────────────

type FleetTripResp struct {
	ID             int64   `json:"id"`
	TripNo         string  `json:"tripNo"`
	VehicleID      int64   `json:"vehicleId"`
	VehicleReg     string  `json:"vehicleReg"`
	Driver1        string  `json:"driver1"`
	Driver2        string  `json:"driver2"`
	PartyName      string  `json:"partyName"`
	Source         string  `json:"source"`
	Destination    string  `json:"destination"`
	PlannedStart   string  `json:"plannedStart"`
	PlannedArrival string  `json:"plannedArrival"`
	FreightAmount  float64 `json:"freightAmount"`
	AdvanceAmount  float64 `json:"advanceAmount"`
	ExpenseAmount  float64 `json:"expenseAmount"`
	BalanceAmount  float64 `json:"balanceAmount"`
	Status         string  `json:"status"`
}

func listFleetTripsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT ft.id, ft.trip_no, COALESCE(ft.vehicle_id, 0), COALESCE(v.reg_number, ''),
		       COALESCE(ft.driver1_name, ''), COALESCE(ft.driver2_name, ''),
		       COALESCE(ft.party_name, ''), COALESCE(ft.source, ''), COALESCE(ft.destination, ''),
		       ft.planned_start, ft.planned_arrival,
		       COALESCE(ft.freight_amount, 0)::float8, COALESCE(ft.advance_amount, 0)::float8,
		       COALESCE(ft.expense_amount, 0)::float8, COALESCE(ft.balance_amount, 0)::float8,
		       COALESCE(ft.status, '')
		FROM fleet_trips ft
		LEFT JOIN vehicles v ON ft.vehicle_id = v.id
		WHERE ft.company_id = $1
		ORDER BY ft.id DESC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]FleetTripResp, 0)
	for rows.Next() {
		var t FleetTripResp
		var pStart, pArr *time.Time
		if err := rows.Scan(&t.ID, &t.TripNo, &t.VehicleID, &t.VehicleReg, &t.Driver1, &t.Driver2,
			&t.PartyName, &t.Source, &t.Destination, &pStart, &pArr,
			&t.FreightAmount, &t.AdvanceAmount, &t.ExpenseAmount, &t.BalanceAmount, &t.Status); err != nil {
			continue
		}
		t.PlannedStart = fmtTime(pStart, "2006-01-02 15:04")
		t.PlannedArrival = fmtTime(pArr, "2006-01-02 15:04")
		list = append(list, t)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createFleetTripHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		VehicleID      int64   `json:"vehicleId"`
		Driver1Name    string  `json:"driver1Name"`
		Driver2Name    string  `json:"driver2Name"`
		PartyName      string  `json:"partyName"`
		Source         string  `json:"source"`
		Destination    string  `json:"destination"`
		PlannedStart   string  `json:"plannedStart"`
		PlannedArrival string  `json:"plannedArrival"`
		FreightAmount  float64 `json:"freightAmount"`
		AdvanceAmount  float64 `json:"advanceAmount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	tripNum := fmt.Sprintf("TRP-%d-%04d", time.Now().Year(), time.Now().UnixNano()%10000)
	balance := req.FreightAmount - req.AdvanceAmount

	var pStart, pArr *time.Time
	if t, err := time.Parse("2006-01-02 15:04", req.PlannedStart); err == nil {
		pStart = &t
	}
	if t, err := time.Parse("2006-01-02 15:04", req.PlannedArrival); err == nil {
		pArr = &t
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO fleet_trips (company_id, trip_no, vehicle_id, driver1_name, driver2_name, party_name,
		                         source, destination, planned_start, planned_arrival,
		                         freight_amount, advance_amount, expense_amount, balance_amount, status, created_at, updated_at)
		VALUES ($1,$2,NULLIF($3,0),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),
		        $9,$10,$11,$12,0,$13,'In Transit',NOW(),NOW())
		RETURNING id
	`, companyID, tripNum, req.VehicleID, req.Driver1Name, req.Driver2Name, req.PartyName,
		req.Source, req.Destination, pStart, pArr, req.FreightAmount, req.AdvanceAmount, balance).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "tripNo": tripNum, "message": "Fleet trip dispatched successfully"})
}

func updateFleetTripHandler(c *gin.Context) {
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
		Status        string  `json:"status"`
		ExpenseAmount float64 `json:"expenseAmount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE fleet_trips SET
			status = COALESCE(NULLIF($1, ''), status),
			expense_amount = CASE WHEN $2 > 0 THEN $2 ELSE expense_amount END,
			balance_amount = CASE WHEN $2 > 0 THEN freight_amount - advance_amount - $2 ELSE balance_amount END,
			updated_at = NOW()
		WHERE id = $3 AND company_id = $4
	`, req.Status, req.ExpenseAmount, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "trip not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Fleet trip updated"})
}

type PartyRouteResp struct {
	ID           int64   `json:"id"`
	PartyName    string  `json:"partyName"`
	Source       string  `json:"source"`
	Destination  string  `json:"destination"`
	StandardKM   float64 `json:"standardKm"`
	StandardRate float64 `json:"standardRate"`
	BillingRate  float64 `json:"billingRate"`
}

func listPartyRoutesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, party_name, source, destination, COALESCE(standard_km,0)::float8,
		       COALESCE(standard_rate,0)::float8, COALESCE(billing_rate,0)::float8
		FROM party_routes WHERE company_id = $1 ORDER BY party_name ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]PartyRouteResp, 0)
	for rows.Next() {
		var p PartyRouteResp
		if err := rows.Scan(&p.ID, &p.PartyName, &p.Source, &p.Destination, &p.StandardKM, &p.StandardRate, &p.BillingRate); err == nil {
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createPartyRouteHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		PartyName    string  `json:"partyName"`
		Source       string  `json:"source"`
		Destination  string  `json:"destination"`
		StandardKM   float64 `json:"standardKm"`
		StandardRate float64 `json:"standardRate"`
		BillingRate  float64 `json:"billingRate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.PartyName) == "" {
		badRequest(c, "partyName is required")
		return
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO party_routes (company_id, party_name, source, destination, standard_km, standard_rate, billing_rate, created_at)
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),$5,$6,$7,NOW())
		RETURNING id
	`, companyID, req.PartyName, req.Source, req.Destination, req.StandardKM, req.StandardRate, req.BillingRate).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Party route contract registered"})
}

type VoucherResp struct {
	ID          int64   `json:"id"`
	TripID      int64   `json:"tripId"`
	TripNo      string  `json:"tripNo"`
	VoucherType string  `json:"voucherType"`
	Amount      float64 `json:"amount"`
	BillNo      string  `json:"billNo"`
	ReceiptURL  string  `json:"receiptUrl"`
	Notes       string  `json:"notes"`
	Date        string  `json:"date"`
}

func listVouchersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT tv.id, COALESCE(tv.trip_id,0), COALESCE(ft.trip_no,''), tv.voucher_type,
		       COALESCE(tv.amount,0)::float8, COALESCE(tv.bill_no,''), COALESCE(tv.receipt_url,''),
		       COALESCE(tv.notes,''), tv.created_at
		FROM trip_vouchers tv
		LEFT JOIN fleet_trips ft ON tv.trip_id = ft.id
		WHERE tv.company_id = $1
		ORDER BY tv.created_at DESC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]VoucherResp, 0)
	for rows.Next() {
		var v VoucherResp
		var cat time.Time
		if err := rows.Scan(&v.ID, &v.TripID, &v.TripNo, &v.VoucherType, &v.Amount,
			&v.BillNo, &v.ReceiptURL, &v.Notes, &cat); err == nil {
			v.Date = cat.Format("2006-01-02")
			list = append(list, v)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createVoucherHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		TripID      int64   `json:"tripId"`
		VoucherType string  `json:"voucherType"`
		Amount      float64 `json:"amount"`
		BillNo      string  `json:"billNo"`
		ReceiptURL  string  `json:"receiptUrl"`
		Notes       string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.TripID <= 0 || strings.TrimSpace(req.VoucherType) == "" || req.Amount <= 0 {
		badRequest(c, "tripId, voucherType and amount are required")
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
	if err := tx.QueryRow(ctx, `
		INSERT INTO trip_vouchers (company_id, trip_id, voucher_type, amount, bill_no, receipt_url, notes, created_at)
		VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NOW())
		RETURNING id
	`, companyID, req.TripID, req.VoucherType, req.Amount, req.BillNo, req.ReceiptURL, req.Notes).Scan(&newID); err != nil {
		serverError(c, err)
		return
	}
	if _, err := tx.Exec(ctx, `
		UPDATE fleet_trips SET
			expense_amount = expense_amount + $1,
			balance_amount = freight_amount - advance_amount - (expense_amount + $1),
			updated_at = NOW()
		WHERE id = $2 AND company_id = $3
	`, req.Amount, req.TripID, companyID); err != nil {
		serverError(c, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Expense voucher recorded and deducted from trip ledger"})
}

type TyreResp struct {
	ID              int64   `json:"id"`
	VehicleID       int64   `json:"vehicleId"`
	VehicleReg      string  `json:"vehicleReg"`
	TyreNumber      string  `json:"tyreNumber"`
	AxlePosition    string  `json:"axlePosition"`
	Brand           string  `json:"brand"`
	Model           string  `json:"model"`
	Size            string  `json:"size"`
	TreadDepthMM    float64 `json:"treadDepthMm"`
	PlyRating       int     `json:"plyRating"`
	Status          string  `json:"status"`
	OpeningKM       int64   `json:"openingKm"`
	CurrentKM       int64   `json:"currentKm"`
	LifeKMLimit     int64   `json:"lifeKmLimit"`
	RetreadingCount int     `json:"retreadingCount"`
	HealthPct       int     `json:"healthPct"`
}

func listTyresHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT tr.id, COALESCE(tr.vehicle_id,0), COALESCE(v.reg_number, ''),
		       COALESCE(tr.tyre_number, tr.serial_number), COALESCE(tr.axle_position, COALESCE(tr.position,'')),
		       COALESCE(tr.brand, ''), COALESCE(tr.model, ''), COALESCE(tr.size, ''),
		       COALESCE(tr.tread_depth_mm, 0)::float8, COALESCE(tr.ply_rating, 0), COALESCE(tr.status, ''),
		       COALESCE(tr.opening_km, 0), COALESCE(tr.current_km, 0), COALESCE(tr.life_km_limit, 0),
		       COALESCE(tr.retreading_count, 0)
		FROM tyre_records tr
		LEFT JOIN vehicles v ON tr.vehicle_id = v.id
		WHERE tr.company_id = $1
		ORDER BY tr.id ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]TyreResp, 0)
	for rows.Next() {
		var t TyreResp
		if err := rows.Scan(&t.ID, &t.VehicleID, &t.VehicleReg, &t.TyreNumber, &t.AxlePosition,
			&t.Brand, &t.Model, &t.Size, &t.TreadDepthMM, &t.PlyRating, &t.Status,
			&t.OpeningKM, &t.CurrentKM, &t.LifeKMLimit, &t.RetreadingCount); err != nil {
			continue
		}
		// Health is derived from the stored tread depth against the new-tread reference.
		t.HealthPct = tyreHealthPct(t.TreadDepthMM)
		list = append(list, t)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

// tyreHealthPct maps tread depth to a percentage of the 16 mm new-tread depth.
func tyreHealthPct(treadMM float64) int {
	if treadMM <= 0 {
		return 0
	}
	if treadMM >= 16.0 {
		return 100
	}
	health := int(treadMM / 16.0 * 100)
	if health < 1 {
		health = 1
	}
	return health
}

func createTyreHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		VehicleID       int64   `json:"vehicleId"`
		TyreNumber      string  `json:"tyreNumber"`
		AxlePosition    string  `json:"axlePosition"`
		Brand           string  `json:"brand"`
		Model           string  `json:"model"`
		Size            string  `json:"size"`
		TreadDepthMM    float64 `json:"treadDepthMm"`
		PlyRating       int     `json:"plyRating"`
		Status          string  `json:"status"`
		OpeningKM       int64   `json:"openingKm"`
		LifeKMLimit     int64   `json:"lifeKmLimit"`
		RetreadingCount int     `json:"retreadingCount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TyreNumber) == "" {
		badRequest(c, "tyreNumber is required")
		return
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO tyre_records (company_id, vehicle_id, serial_number, tyre_number, position, axle_position,
		                          brand, model, size, tread_depth_mm, ply_rating, status,
		                          opening_km, current_km, life_km_limit, retreading_count, created_at, updated_at)
		VALUES ($1, NULLIF($2,0), $3, $3, NULLIF($4,''), NULLIF($4,''),
		        NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,0), NULLIF($9,0), COALESCE(NULLIF($10,''),'In Use'),
		        $11, $11, NULLIF($12,0), $13, NOW(), NOW())
		RETURNING id
	`, companyID, req.VehicleID, req.TyreNumber, req.AxlePosition, req.Brand, req.Model, req.Size,
		req.TreadDepthMM, req.PlyRating, req.Status, req.OpeningKM, req.LifeKMLimit, req.RetreadingCount).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Tyre serial asset registered in fleet registry"})
}

func updateTyreHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid tyre id")
		return
	}
	var req struct {
		AxlePosition    string  `json:"axlePosition"`
		TreadDepthMM    float64 `json:"treadDepthMm"`
		Status          string  `json:"status"`
		RetreadingCount int     `json:"retreadingCount"`
		CurrentKM       int64   `json:"currentKm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE tyre_records SET
			axle_position = COALESCE(NULLIF($1,''), axle_position),
			tread_depth_mm = CASE WHEN $2 > 0 THEN $2 ELSE tread_depth_mm END,
			status = COALESCE(NULLIF($3,''), status),
			retreading_count = CASE WHEN $4 >= 0 THEN $4 ELSE retreading_count END,
			current_km = CASE WHEN $5 > 0 THEN $5 ELSE current_km END,
			updated_at = NOW()
		WHERE id = $6 AND company_id = $7
	`, req.AxlePosition, req.TreadDepthMM, req.Status, req.RetreadingCount, req.CurrentKM, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "tyre not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Tyre inspection update saved"})
}

func deleteTyreHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid tyre id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM tyre_records WHERE id = $1 AND company_id = $2", id, companyID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Tyre scrapped and removed"})
}

// ─────────────────────────────────────────────────────────────
// 5. Customer Complaints & Support Register
// ─────────────────────────────────────────────────────────────

type ComplaintResp struct {
	ID                 int64  `json:"id"`
	TicketNo           string `json:"ticketNo"`
	VehicleReg         string `json:"vehicleReg"`
	Title              string `json:"title"`
	Category           string `json:"category"`
	Priority           string `json:"priority"`
	Status             string `json:"status"`
	TechnicianAssigned string `json:"technicianAssigned"`
	ResolutionNotes    string `json:"resolutionNotes"`
	CreatedAt          string `json:"createdAt"`
}

func listComplaintsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT c.id, c.ticket_no, COALESCE(v.reg_number, ''), c.title, c.category, c.priority, c.status,
		       COALESCE(c.technician_assigned, ''), COALESCE(c.resolution_notes, ''), c.created_at
		FROM complaints c
		LEFT JOIN vehicles v ON c.vehicle_id = v.id
		WHERE c.company_id = $1
		ORDER BY c.created_at DESC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]ComplaintResp, 0)
	for rows.Next() {
		var cp ComplaintResp
		var cat time.Time
		if err := rows.Scan(&cp.ID, &cp.TicketNo, &cp.VehicleReg, &cp.Title, &cp.Category, &cp.Priority,
			&cp.Status, &cp.TechnicianAssigned, &cp.ResolutionNotes, &cat); err == nil {
			cp.CreatedAt = cat.Format("2006-01-02 15:04")
			list = append(list, cp)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createComplaintHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		VehicleID int64  `json:"vehicleId"`
		Title     string `json:"title"`
		Category  string `json:"category"`
		Priority  string `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Category) == "" {
		badRequest(c, "title and category are required")
		return
	}
	ticketNo := fmt.Sprintf("TCK-%d", time.Now().UnixNano()%1000000)

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO complaints (company_id, ticket_no, vehicle_id, title, category, priority, status, created_at, updated_at)
		VALUES ($1,$2,NULLIF($3,0),$4,$5,COALESCE(NULLIF($6,''),'Medium'),'Open',NOW(),NOW())
		RETURNING id
	`, companyID, ticketNo, req.VehicleID, req.Title, req.Category, req.Priority).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "ticketNo": ticketNo, "message": "Support ticket created. Support team will inspect within SLA."})
}

func updateComplaintHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid ticket id")
		return
	}
	var req struct {
		Status             string `json:"status"`
		TechnicianAssigned string `json:"technicianAssigned"`
		ResolutionNotes    string `json:"resolutionNotes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE complaints SET
			status = COALESCE(NULLIF($1,''), status),
			technician_assigned = COALESCE(NULLIF($2,''), technician_assigned),
			resolution_notes = COALESCE(NULLIF($3,''), resolution_notes),
			updated_at = NOW()
		WHERE id = $4 AND company_id = $5
	`, req.Status, req.TechnicianAssigned, req.ResolutionNotes, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "ticket not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Support ticket updated"})
}

// ─────────────────────────────────────────────────────────────
// 6. SuperAdmin: Extensions, Warranty, Raw Data, Toll, Devices, Roles, Billing
// ─────────────────────────────────────────────────────────────

type ExtensionRecord struct {
	ID            int64   `json:"id"`
	CompanyID     int64   `json:"companyId"`
	CompanyName   string  `json:"companyName"`
	DeviceID      int64   `json:"deviceId,omitempty"`
	DeviceIMEI    string  `json:"deviceImei,omitempty"`
	ExtensionType string  `json:"extensionType"`
	OldExpiryDate string  `json:"oldExpiryDate"`
	NewExpiryDate string  `json:"newExpiryDate"`
	StartDate     string  `json:"startDate"`
	EndDate       string  `json:"endDate"`
	ExtendedBy    string  `json:"extendedBy"`
	Reason        string  `json:"reason"`
	AmountPaid    float64 `json:"amountPaid"`
	CreatedAt     string  `json:"createdAt"`
}

func adminListExtensionsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT e.id, e.company_id, c.name, COALESCE(e.vehicle_id,0), COALESCE(d.imei,''),
		       COALESCE(e.extension_type,''), e.start_date, e.end_date, e.months_extended,
		       COALESCE(e.amount_paid,0)::float8, e.approved_by, COALESCE(e.reason,''), e.created_at
		FROM subscription_extensions e
		JOIN companies c ON e.company_id = c.id
		LEFT JOIN devices d ON e.vehicle_id = d.id
		ORDER BY e.id DESC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]ExtensionRecord, 0)
	for rows.Next() {
		var rec ExtensionRecord
		var start, end time.Time
		var months int
		var created time.Time
		if err := rows.Scan(&rec.ID, &rec.CompanyID, &rec.CompanyName, &rec.DeviceID, &rec.DeviceIMEI,
			&rec.ExtensionType, &start, &end, &months, &rec.AmountPaid, &rec.ExtendedBy, &rec.Reason, &created); err != nil {
			continue
		}
		rec.StartDate = start.Format("2006-01-02")
		rec.EndDate = end.Format("2006-01-02")
		rec.NewExpiryDate = rec.EndDate
		rec.OldExpiryDate = start.AddDate(0, 0, -1).Format("2006-01-02")
		rec.CreatedAt = created.Format("2006-01-02 15:04")
		list = append(list, rec)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func adminCreateExtensionHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		CompanyID     int64   `json:"companyId"`
		DeviceID      int64   `json:"deviceId"`
		ExtensionType string  `json:"extensionType"`
		Months        int     `json:"months"`
		Reason        string  `json:"reason"`
		AmountPaid    float64 `json:"amountPaid"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if req.CompanyID <= 0 {
		badRequest(c, "companyId is required")
		return
	}
	if req.Months <= 0 {
		badRequest(c, "months must be a positive number")
		return
	}

	approvedBy, _ := c.Get("username")
	approvedByStr, _ := approvedBy.(string)

	var start, end time.Time
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO subscription_extensions (company_id, vehicle_id, extension_type, start_date, end_date,
		                                     months_extended, amount_paid, approved_by, reason)
		VALUES ($1, NULLIF($2,0), COALESCE(NULLIF($3,''),'Company Subscription'),
		        CURRENT_DATE, CURRENT_DATE + make_interval(months => $4), $4, $5, COALESCE(NULLIF($6,''),'console'), NULLIF($7,''))
		RETURNING start_date, end_date
	`, req.CompanyID, req.DeviceID, req.ExtensionType, req.Months, req.AmountPaid, approvedByStr, req.Reason).Scan(&start, &end)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"success":       true,
		"startDate":     start.Format("2006-01-02"),
		"newExpiryDate": end.Format("2006-01-02"),
		"message":       fmt.Sprintf("Subscription extended by %d months. New validity until %s.", req.Months, end.Format("2006-01-02")),
	})
}

type WarrantyRecord struct {
	ID            int64  `json:"id"`
	DeviceIMEI    string `json:"deviceImei"`
	DeviceModel   string `json:"deviceModel"`
	CompanyName   string `json:"companyName"`
	PurchaseDate  string `json:"purchaseDate"`
	WarrantyEnd   string `json:"warrantyEnd"`
	AMCStartDate  string `json:"amcStartDate"`
	AMCEndDate    string `json:"amcEndDate"`
	AMCStatus     string `json:"amcStatus"`
	VendorContact string `json:"vendorContact"`
}

func adminListWarrantyHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT w.id, COALESCE(d.imei,''), COALESCE(d.device_type,''), COALESCE(c.name,''),
		       w.start_date, w.end_date, w.amc_expiry, COALESCE(w.amc_active, FALSE),
		       COALESCE(w.vendor_name,''), COALESCE(w.warranty_period,'')
		FROM warranty_records w
		LEFT JOIN devices d ON w.device_id = d.id
		LEFT JOIN companies c ON w.company_id = c.id
		ORDER BY w.id DESC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]WarrantyRecord, 0)
	now := time.Now()
	for rows.Next() {
		var rec WarrantyRecord
		var start, end, amcExpiry *time.Time
		var amcActive bool
		var vendor, period string
		if err := rows.Scan(&rec.ID, &rec.DeviceIMEI, &rec.DeviceModel, &rec.CompanyName,
			&start, &end, &amcExpiry, &amcActive, &vendor, &period); err != nil {
			continue
		}
		rec.PurchaseDate = fmtTime(start, "2006-01-02")
		rec.WarrantyEnd = fmtTime(end, "2006-01-02")
		rec.AMCStartDate = fmtTime(end, "2006-01-02")
		rec.AMCEndDate = fmtTime(amcExpiry, "2006-01-02")
		rec.VendorContact = vendor
		switch {
		case end != nil && now.Before(*end):
			rec.AMCStatus = "Under Warranty"
		case amcActive && amcExpiry != nil && now.Before(*amcExpiry):
			rec.AMCStatus = "Active AMC"
		default:
			rec.AMCStatus = "Expired AMC"
		}
		list = append(list, rec)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func adminCreateWarrantyHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		DeviceID       int64  `json:"deviceId"`
		CompanyID      int64  `json:"companyId"`
		WarrantyPeriod string `json:"warrantyPeriod"`
		VendorName     string `json:"vendorName"`
		StartDate      string `json:"startDate"`
		EndDate        string `json:"endDate"`
		AMCActive      *bool  `json:"amcActive"`
		AMCExpiry      string `json:"amcExpiry"`
		Remarks        string `json:"remarks"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.DeviceID <= 0 {
		badRequest(c, "deviceId is required")
		return
	}
	var start, end, amcExpiry *time.Time
	if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
		start = &t
	}
	if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
		end = &t
	}
	if t, err := time.Parse("2006-01-02", req.AMCExpiry); err == nil {
		amcExpiry = &t
	}

	ctx := c.Request.Context()
	companyID := req.CompanyID
	if companyID <= 0 {
		_ = deps.Pool.QueryRow(ctx, "SELECT COALESCE(company_id, 0) FROM devices WHERE id = $1", req.DeviceID).Scan(&companyID)
	}
	if companyID <= 0 {
		badRequest(c, "unable to resolve tenant for the device")
		return
	}

	var newID int64
	err := deps.Pool.QueryRow(ctx, `
		INSERT INTO warranty_records (company_id, device_id, warranty_period, vendor_name, start_date, end_date, amc_active, amc_expiry, remarks)
		VALUES ($1,$2,COALESCE(NULLIF($3,''),'1 Year'),NULLIF($4,''),$5,$6,COALESCE($7,FALSE),$8,NULLIF($9,''))
		RETURNING id
	`, companyID, req.DeviceID, req.WarrantyPeriod, req.VendorName, start, end, req.AMCActive, amcExpiry, req.Remarks).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Hardware warranty & AMC contract registered"})
}

type RawDataPacket struct {
	ID        int64  `json:"id"`
	IMEI      string `json:"imei"`
	Protocol  string `json:"protocol"`
	Length    int    `json:"length"`
	HexPacket string `json:"hexPacket"`
	DecodedAt string `json:"decodedAt"`
	SourceIP  string `json:"sourceIp"`
	Status    string `json:"status"`
}

func adminListRawDataHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	limit := atoiDefault(c.Query("limit"), 100)
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, device_imei, COALESCE(protocol,''), COALESCE(payload_length,0), hex_data,
		       COALESCE(source_ip,''), COALESCE(status,''), created_at
		FROM raw_packets
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]RawDataPacket, 0)
	for rows.Next() {
		var p RawDataPacket
		var created time.Time
		if err := rows.Scan(&p.ID, &p.IMEI, &p.Protocol, &p.Length, &p.HexPacket, &p.SourceIP, &p.Status, &created); err == nil {
			p.DecodedAt = created.Format("2006-01-02 15:04:05")
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

type TollDataResp struct {
	ID           int64   `json:"id"`
	TollName     string  `json:"tollName"`
	SystemType   string  `json:"systemType"`
	RateStandard float64 `json:"rateStandard"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	City         string  `json:"city"`
	Status       string  `json:"status"`
}

func adminListTollDataHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(system_type,''), COALESCE(rate_standard,0)::float8,
		       COALESCE(latitude,0), COALESCE(longitude,0), COALESCE(city,'')
		FROM toll_plazas ORDER BY id ASC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]TollDataResp, 0)
	for rows.Next() {
		var t TollDataResp
		if err := rows.Scan(&t.ID, &t.TollName, &t.SystemType, &t.RateStandard, &t.Latitude, &t.Longitude, &t.City); err == nil {
			t.Status = "Active"
			list = append(list, t)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func adminCreateTollDataHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		TollName     string  `json:"tollName"`
		SystemType   string  `json:"systemType"`
		RateStandard float64 `json:"rateStandard"`
		Latitude     float64 `json:"latitude"`
		Longitude    float64 `json:"longitude"`
		City         string  `json:"city"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.TollName) == "" {
		badRequest(c, "tollName is required")
		return
	}
	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO toll_plazas (name, system_type, rate_standard, latitude, longitude, city)
		VALUES ($1, NULLIF($2,''), NULLIF($3,0), NULLIF($4,0), NULLIF($5,0), NULLIF($6,''))
		RETURNING id
	`, req.TollName, req.SystemType, req.RateStandard, req.Latitude, req.Longitude, req.City).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Toll plaza checkpoint mapped"})
}

// ─── Admin Hardware Device Inventory ─────────────────────

type AdminDeviceResp struct {
	ID             int64  `json:"id"`
	IMEI           string `json:"imei"`
	SIMCardNo      string `json:"simCardNo"`
	Operator       string `json:"operator"`
	Model          string `json:"model"`
	Protocol       string `json:"protocol"`
	Firmware       string `json:"firmware"`
	AssignedTenant string `json:"assignedTenant"`
	VehicleReg     string `json:"vehicleReg"`
	LastPing       string `json:"lastPing"`
	Status         string `json:"status"`
}

// formatDeviceModel renders a stored device_type for display.
func formatDeviceModel(model string) string {
	m := strings.ReplaceAll(model, "_", " ")
	upper := strings.ToUpper(m)
	if strings.HasPrefix(upper, "TELTONIKA") {
		return "Teltonika " + strings.TrimSpace(m[len("TELTONIKA"):])
	}
	if strings.HasPrefix(upper, "CONCOX") {
		return "Concox " + strings.TrimSpace(m[len("CONCOX"):])
	}
	return m
}

func adminListDevicesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT d.id, d.imei, COALESCE(d.sim_no,''), COALESCE(d.sim_operator,''), COALESCE(d.device_type,''),
		       COALESCE(d.firmware_ver,''), COALESCE(c.name,''), COALESCE(v.reg_number,''),
		       COALESCE(d.status,''), d.last_heartbeat, COALESCE(d.port,0)
		FROM devices d
		LEFT JOIN companies c ON d.company_id = c.id
		LEFT JOIN vehicles v ON v.device_id = d.id
		ORDER BY d.id ASC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]AdminDeviceResp, 0)
	for rows.Next() {
		var dev AdminDeviceResp
		var model, rawStatus string
		var lastHeartbeat *time.Time
		var port int
		if err := rows.Scan(&dev.ID, &dev.IMEI, &dev.SIMCardNo, &dev.Operator, &model, &dev.Firmware,
			&dev.AssignedTenant, &dev.VehicleReg, &rawStatus, &lastHeartbeat, &port); err != nil {
			continue
		}
		dev.Model = formatDeviceModel(model)
		dev.Protocol = fmt.Sprintf("TCP/%d", port)
		dev.LastPing = fmtTime(lastHeartbeat, "2006-01-02 15:04")

		switch {
		case dev.VehicleReg == "" && dev.AssignedTenant == "":
			dev.Status = "Unassigned"
		case lastHeartbeat != nil && time.Since(*lastHeartbeat) < 15*time.Minute:
			dev.Status = "Online"
		case rawStatus == "active":
			dev.Status = "Offline"
		default:
			dev.Status = rawStatus
		}
		list = append(list, dev)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func adminCreateDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var body struct {
		IMEI        string `json:"imei"`
		SIMCardNo   string `json:"simCardNo"`
		Operator    string `json:"operator"`
		Model       string `json:"model"`
		Protocol    string `json:"protocol"`
		Firmware    string `json:"firmware"`
		CompanyName string `json:"companyName"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.IMEI) == "" {
		badRequest(c, "imei is required")
		return
	}

	ctx := c.Request.Context()
	var companyID *int64
	if body.CompanyName != "" {
		var cid int64
		if err := deps.Pool.QueryRow(ctx, "SELECT id FROM companies WHERE name ILIKE $1 LIMIT 1", "%"+body.CompanyName+"%").Scan(&cid); err == nil {
			companyID = &cid
		}
	}

	// Ports are parsed from the protocol string when provided (e.g. "TCP/5040").
	var port *int
	if body.Protocol != "" {
		if p, err := strconv.Atoi(strings.TrimPrefix(body.Protocol, "TCP/")); err == nil && p > 0 {
			port = &p
		}
	}

	var newID int64
	err := deps.Pool.QueryRow(ctx, `
		INSERT INTO devices (imei, sim_no, sim_operator, device_type, firmware_ver, company_id, status, port, created_at, updated_at)
		VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), $6, 'active', COALESCE($7, 5040), NOW(), NOW())
		ON CONFLICT (imei) DO UPDATE SET
			sim_no = COALESCE(EXCLUDED.sim_no, devices.sim_no),
			sim_operator = COALESCE(EXCLUDED.sim_operator, devices.sim_operator),
			device_type = COALESCE(EXCLUDED.device_type, devices.device_type),
			firmware_ver = COALESCE(EXCLUDED.firmware_ver, devices.firmware_ver),
			company_id = COALESCE(EXCLUDED.company_id, devices.company_id),
			port = COALESCE(EXCLUDED.port, devices.port),
			updated_at = NOW()
		RETURNING id
	`, body.IMEI, body.SIMCardNo, body.Operator, body.Model, body.Firmware, companyID, port).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Hardware tracker provisioned"})
}

func adminUpdateDeviceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid device id")
		return
	}
	var body struct {
		SIMCardNo string `json:"simCardNo"`
		Operator  string `json:"operator"`
		Firmware  string `json:"firmware"`
		Status    string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		badRequest(c, err.Error())
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE devices SET
			sim_no = COALESCE(NULLIF($1,''), sim_no),
			sim_operator = COALESCE(NULLIF($2,''), sim_operator),
			firmware_ver = COALESCE(NULLIF($3,''), firmware_ver),
			status = COALESCE(NULLIF(LOWER($4),''), status),
			updated_at = NOW()
		WHERE id = $5
	`, body.SIMCardNo, body.Operator, body.Firmware, body.Status, id)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "device not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Device configuration updated"})
}

// ─── Roles & Permissions ─────────────────────────────────

type RoleWithRights struct {
	ID          int64          `json:"id"`
	RoleName    string         `json:"roleName"`
	Description string         `json:"description"`
	Permissions map[string]int `json:"permissions"`
}

func listRolesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	ctx := c.Request.Context()

	rows, err := deps.Pool.Query(ctx, `
		SELECT r.id, r.role_name, COALESCE(r.description,''), COALESCE(r.permission_mask,0),
		       COALESCE(m.module_name,''), COALESCE(m.permission_mask,0)
		FROM roles r
		LEFT JOIN module_permissions m ON m.role_name = r.role_name
		ORDER BY r.id ASC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	byID := map[int64]*RoleWithRights{}
	order := []int64{}
	for rows.Next() {
		var id int64
		var roleName, description, module string
		var mask, moduleMask int
		if err := rows.Scan(&id, &roleName, &description, &mask, &module, &moduleMask); err != nil {
			continue
		}
		role, exists := byID[id]
		if !exists {
			role = &RoleWithRights{ID: id, RoleName: roleName, Description: description, Permissions: map[string]int{}}
			byID[id] = role
			order = append(order, id)
		}
		if module != "" {
			role.Permissions[module] = moduleMask
		}
	}
	list := make([]*RoleWithRights, 0, len(order))
	for _, id := range order {
		list = append(list, byID[id])
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func createRoleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		RoleName    string         `json:"roleName"`
		Description string         `json:"description"`
		Permissions map[string]int `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.RoleName) == "" {
		badRequest(c, "roleName is required")
		return
	}
	ctx := c.Request.Context()
	var newID int64
	if err := deps.Pool.QueryRow(ctx, `
		INSERT INTO roles (role_name, description, permission_mask, is_system)
		VALUES ($1, NULLIF($2,''), 0, FALSE) RETURNING id
	`, req.RoleName, req.Description).Scan(&newID); err != nil {
		serverError(c, err)
		return
	}
	for module, mask := range req.Permissions {
		_, _ = deps.Pool.Exec(ctx, `
			INSERT INTO module_permissions (role_name, module_name, permission_mask)
			VALUES ($1,$2,$3)
			ON CONFLICT (role_name, module_name) DO UPDATE SET permission_mask = EXCLUDED.permission_mask
		`, req.RoleName, module, mask)
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Role created with permission vector"})
}

func updateRoleHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid role id")
		return
	}
	var req struct {
		RoleName    string         `json:"roleName"`
		Description string         `json:"description"`
		Permissions map[string]int `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	ctx := c.Request.Context()
	var roleName string
	if err := deps.Pool.QueryRow(ctx, "SELECT role_name FROM roles WHERE id = $1", id).Scan(&roleName); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "role not found"})
		return
	}
	if req.RoleName != "" {
		if _, err := deps.Pool.Exec(ctx, "UPDATE roles SET role_name = $1 WHERE id = $2", req.RoleName, id); err != nil {
			serverError(c, err)
			return
		}
		_, _ = deps.Pool.Exec(ctx, "UPDATE module_permissions SET role_name = $1 WHERE role_name = $2", req.RoleName, roleName)
		roleName = req.RoleName
	}
	if req.Description != "" {
		_, _ = deps.Pool.Exec(ctx, "UPDATE roles SET description = $1 WHERE id = $2", req.Description, id)
	}
	for module, mask := range req.Permissions {
		_, _ = deps.Pool.Exec(ctx, `
			INSERT INTO module_permissions (role_name, module_name, permission_mask)
			VALUES ($1,$2,$3)
			ON CONFLICT (role_name, module_name) DO UPDATE SET permission_mask = EXCLUDED.permission_mask
		`, roleName, module, mask)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Role rights matrix updated"})
}

// ─── Billing Master ──────────────────────────────────────

func listBillingHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT i.id, i.inv_number, COALESCE(c.name,''), COALESCE(i.plan,''), COALESCE(i.device_count,0),
		       COALESCE(i.amount,0)::float8, COALESCE(i.tax_amount,0)::float8, COALESCE(i.total_amount,0)::float8,
		       CASE
		           WHEN LOWER(COALESCE(i.status,'')) = 'paid' THEN 'Paid'
		           WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE THEN 'Overdue'
		           ELSE 'Unpaid'
		       END,
		       i.due_date
		FROM invoices i
		LEFT JOIN companies c ON i.company_id = c.id
		ORDER BY i.id DESC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type BillingRecord struct {
		ID          int64   `json:"id"`
		InvoiceNo   string  `json:"invoiceNo"`
		CompanyName string  `json:"companyName"`
		BillingPlan string  `json:"billingPlan"`
		DeviceCount int     `json:"deviceCount"`
		SubTotal    float64 `json:"subTotal"`
		TaxVAT      float64 `json:"taxVat"`
		TotalAmount float64 `json:"totalAmount"`
		Status      string  `json:"status"`
		DueDate     string  `json:"dueDate"`
		PaidAt      string  `json:"paidAt,omitempty"`
	}
	list := make([]BillingRecord, 0)
	for rows.Next() {
		var b BillingRecord
		var due *time.Time
		if err := rows.Scan(&b.ID, &b.InvoiceNo, &b.CompanyName, &b.BillingPlan, &b.DeviceCount,
			&b.SubTotal, &b.TaxVAT, &b.TotalAmount, &b.Status, &due); err == nil {
			b.DueDate = fmtTime(due, "2006-01-02")
			list = append(list, b)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func createBillingHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		CompanyID     int64   `json:"companyId"`
		CompanyName   string  `json:"companyName"`
		BillingPlan   string  `json:"billingPlan"`
		DeviceCount   int     `json:"deviceCount"`
		RatePerDevice float64 `json:"ratePerDevice"`
		DueDate       string  `json:"dueDate"`
		Notes         string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if req.DeviceCount <= 0 || req.RatePerDevice <= 0 {
		badRequest(c, "deviceCount and ratePerDevice are required")
		return
	}

	ctx := c.Request.Context()
	companyID := req.CompanyID
	if companyID <= 0 && req.CompanyName != "" {
		_ = deps.Pool.QueryRow(ctx, "SELECT id FROM companies WHERE name ILIKE $1 LIMIT 1", "%"+req.CompanyName+"%").Scan(&companyID)
	}
	if companyID <= 0 {
		badRequest(c, "companyId or a matching companyName is required")
		return
	}

	var vat float64
	_ = deps.Pool.QueryRow(ctx, "SELECT COALESCE(vat_percent,0) FROM company_settings WHERE company_id = $1", companyID).Scan(&vat)

	amount := float64(req.DeviceCount) * req.RatePerDevice
	tax := amount * vat / 100.0
	total := amount + tax

	var due *time.Time
	if req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			due = &t
		}
	}

	var nextID int64
	_ = deps.Pool.QueryRow(ctx, "SELECT COALESCE(MAX(id),0) + 1 FROM invoices").Scan(&nextID)
	invNumber := fmt.Sprintf("INV-%d-%04d", time.Now().Year(), nextID)

	var newID int64
	err := deps.Pool.QueryRow(ctx, `
		INSERT INTO invoices (company_id, inv_number, inv_date, amount, tax_amount, total_amount, paid_amount,
		                      status, due_date, plan, device_count, rate_per_device, notes)
		VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,0,'unpaid',$6,NULLIF($7,''),$8,$9,NULLIF($10,''))
		RETURNING id
	`, companyID, invNumber, amount, tax, total, due, req.BillingPlan, req.DeviceCount, req.RatePerDevice, req.Notes).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "invoiceNo": invNumber, "message": "Tax invoice generated"})
}

// ─── Master Lookups ──────────────────────────────────────

type MasterItem struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
}

func listMastersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	mType := c.Param("type")
	companyID := getEffectiveCompanyID(c)

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, category, code, name, COALESCE(is_default, FALSE)
		FROM lookup_masters
		WHERE category = $1 AND (company_id IS NULL OR company_id = $2)
		ORDER BY is_default DESC, name ASC
	`, mType, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	list := make([]MasterItem, 0)
	for rows.Next() {
		var m MasterItem
		if err := rows.Scan(&m.ID, &m.Type, &m.Code, &m.Name, &m.IsDefault); err == nil {
			list = append(list, m)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "type": mType, "data": list})
}

func createMasterHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	mType := c.Param("type")
	companyID := getEffectiveCompanyID(c)
	var req struct {
		Code      string `json:"code"`
		Name      string `json:"name"`
		IsDefault bool   `json:"isDefault"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Code) == "" || strings.TrimSpace(req.Name) == "" {
		badRequest(c, "code and name are required")
		return
	}
	if req.IsDefault {
		_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE lookup_masters SET is_default = FALSE WHERE category = $1", mType)
	}
	var newID int64
	var owner *int64
	if companyID > 0 {
		owner = &companyID
	}
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO lookup_masters (company_id, category, code, name, is_default)
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, owner, mType, req.Code, req.Name, req.IsDefault).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "Master record created"})
}

func updateMasterHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid master id")
		return
	}
	var req struct {
		Code      string `json:"code"`
		Name      string `json:"name"`
		IsDefault *bool  `json:"isDefault"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	ctx := c.Request.Context()
	if req.IsDefault != nil && *req.IsDefault {
		var category string
		if err := deps.Pool.QueryRow(ctx, "SELECT category FROM lookup_masters WHERE id = $1", id).Scan(&category); err == nil {
			_, _ = deps.Pool.Exec(ctx, "UPDATE lookup_masters SET is_default = FALSE WHERE category = $1", category)
		}
	}
	tag, err := deps.Pool.Exec(ctx, `
		UPDATE lookup_masters SET
			code = COALESCE(NULLIF($1,''), code),
			name = COALESCE(NULLIF($2,''), name),
			is_default = COALESCE($3, is_default)
		WHERE id = $4
	`, req.Code, req.Name, req.IsDefault, id)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "master record not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Master record updated"})
}

func deleteMasterHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid master id")
		return
	}
	if _, err := deps.Pool.Exec(c.Request.Context(), "DELETE FROM lookup_masters WHERE id = $1", id); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Master record deleted"})
}

func adminListMastersHandler(c *gin.Context)  { listMastersHandler(c) }
func adminCreateMasterHandler(c *gin.Context) { createMasterHandler(c) }
func adminUpdateMasterHandler(c *gin.Context) { updateMasterHandler(c) }
func adminDeleteMasterHandler(c *gin.Context) { deleteMasterHandler(c) }
