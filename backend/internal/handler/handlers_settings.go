package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// getCompanySettingsHandler returns the tenant profile and its stored
// operational settings. Everything comes from PostgreSQL.
func getCompanySettingsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	var (
		id                                   int64
		name, code, contact, email, phone    string
		city, address, apiKey                string
		maxDevices, maxUsers                 int
		siraRelay                            bool
		idleMinutes, speedThreshold          int
		timezone, language                   string
		vatPercent                           float64
		deviceCount, userCount, vehicleCount int64
	)
	err := deps.Pool.QueryRow(ctx, `
		SELECT c.id, c.name, c.code, COALESCE(c.contact_person, ''), COALESCE(c.email, ''),
		       COALESCE(c.phone, ''), COALESCE(c.city, ''), COALESCE(c.address, ''),
		       COALESCE(c.api_key, ''), COALESCE(c.max_devices, 0), COALESCE(c.max_users, 0),
		       COALESCE(c.sira_relay, FALSE),
		       COALESCE(s.idle_threshold_minutes, 0), COALESCE(s.speed_threshold_kmh, 0),
		       COALESCE(s.timezone, ''), COALESCE(s.language, ''), COALESCE(s.vat_percent, 0),
		       (SELECT COUNT(*) FROM devices d WHERE d.company_id = c.id),
		       (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id),
		       (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id)
		FROM companies c
		LEFT JOIN company_settings s ON s.company_id = c.id
		WHERE c.id = $1
	`, companyID).Scan(&id, &name, &code, &contact, &email, &phone, &city, &address,
		&apiKey, &maxDevices, &maxUsers, &siraRelay, &idleMinutes, &speedThreshold,
		&timezone, &language, &vatPercent, &deviceCount, &userCount, &vehicleCount)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "organization not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"company": gin.H{
			"id": id, "name": name, "code": code, "contactPerson": contact,
			"contactEmail": email, "contactPhone": phone, "city": city, "address": address,
			"apiKey": apiKey, "maxDevices": maxDevices, "maxUsers": maxUsers, "siraRelay": siraRelay,
		},
		"settings": gin.H{
			"idleThresholdMinutes": idleMinutes, "speedThresholdKmh": speedThreshold,
			"timezone": timezone, "language": language, "vatPercent": vatPercent,
		},
		"usage": gin.H{"devices": deviceCount, "users": userCount, "vehicles": vehicleCount},
	}})
}

// updateCompanySettingsHandler persists profile and operational settings.
func updateCompanySettingsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	allowed := map[string]bool{"admin": true, "manager": true, "superadmin": true}
	if role, _ := c.Get("role"); !allowed[role.(string)] {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "insufficient permissions to change organization settings"})
		return
	}

	var req struct {
		CompanyName          string  `json:"companyName"`
		ContactPerson        string  `json:"contactPerson"`
		ContactEmail         string  `json:"contactEmail"`
		ContactPhone         string  `json:"contactPhone"`
		City                 string  `json:"city"`
		Address              string  `json:"address"`
		IdleThresholdMinutes int     `json:"idleThresholdMinutes"`
		SpeedThresholdKmh    int     `json:"speedThresholdKmh"`
		Timezone             string  `json:"timezone"`
		Language             string  `json:"language"`
		VATPercent           float64 `json:"vatPercent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	ctx := c.Request.Context()
	if _, err := deps.Pool.Exec(ctx, `
		UPDATE companies SET
			name = COALESCE(NULLIF($1,''), name),
			contact_person = COALESCE(NULLIF($2,''), contact_person),
			email = COALESCE(NULLIF($3,''), email),
			phone = COALESCE(NULLIF($4,''), phone),
			city = COALESCE(NULLIF($5,''), city),
			address = COALESCE(NULLIF($6,''), address),
			updated_at = NOW()
		WHERE id = $7
	`, req.CompanyName, req.ContactPerson, req.ContactEmail, req.ContactPhone, req.City, req.Address, companyID); err != nil {
		serverError(c, err)
		return
	}

	_, err := deps.Pool.Exec(ctx, `
		INSERT INTO company_settings (company_id, idle_threshold_minutes, speed_threshold_kmh, timezone, language, vat_percent, updated_at)
		VALUES ($1, NULLIF($2,0), NULLIF($3,0), NULLIF($4,''), NULLIF($5,''), NULLIF($6,0), NOW())
		ON CONFLICT (company_id) DO UPDATE SET
			idle_threshold_minutes = COALESCE(NULLIF($2,0), company_settings.idle_threshold_minutes),
			speed_threshold_kmh = COALESCE(NULLIF($3,0), company_settings.speed_threshold_kmh),
			timezone = COALESCE(NULLIF($4,''), company_settings.timezone),
			language = COALESCE(NULLIF($5,''), company_settings.language),
			vat_percent = COALESCE(NULLIF($6,0), company_settings.vat_percent),
			updated_at = NOW()
	`, companyID, req.IdleThresholdMinutes, req.SpeedThresholdKmh, req.Timezone, req.Language, req.VATPercent)
	if err != nil {
		serverError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Organization settings saved"})
}
