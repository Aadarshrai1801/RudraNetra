package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Reports ─────────────────────────────────────────────
//
// Every report is computed with SQL over positions / alerts / fleet tables.
// Missing data returns empty rows — never placeholder values.

type reportColumn struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

type reportResult struct {
	Columns []reportColumn
	Rows    []map[string]interface{}
}

const (
	reportWindowHours = 24
	maxReportRows     = 500
)

// reportWindow describes the time window a report should cover, expressed
// relative to each device's LAST recorded position so reports always work on
// the last known data, however old it is.
type reportWindow struct {
	hours  int
	offset int
}

// reportWindowFrom maps the UI range selector onto a relative window:
//
//	today     → last 24h of recorded data
//	yesterday → the 24h before that
//	week      → last 7 days of data
//	month     → last 31 days of data
//	default   → last 24h of recorded data
func reportWindowFrom(c *gin.Context) reportWindow {
	switch strings.ToLower(c.Query("range")) {
	case "yesterday":
		return reportWindow{hours: 24, offset: 24}
	case "week":
		return reportWindow{hours: 24 * 7}
	case "month":
		return reportWindow{hours: 24 * 31}
	default:
		return reportWindow{hours: 24}
	}
}

func getReportHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	repType := c.Param("type")

	res, err := buildReport(c, companyID, repType)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"company_id": companyID,
		"type":       repType,
		"count":      len(res.Rows),
		"columns":    res.Columns,
		"data":       res.Rows,
	})
}

func exportReportHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	repType := c.Param("type")

	res, err := buildReport(c, companyID, repType)
	if err != nil {
		serverError(c, err)
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"report-%s-%s.csv\"", repType, time.Now().Format("20060102")))
	c.Header("Content-Type", "text/csv; charset=utf-8")

	var sb strings.Builder
	headers := make([]string, len(res.Columns))
	for i, col := range res.Columns {
		headers[i] = col.Label
	}
	sb.WriteString(strings.Join(headers, ","))
	sb.WriteString("\n")
	for _, row := range res.Rows {
		vals := make([]string, len(res.Columns))
		for i, col := range res.Columns {
			v := row[col.Key]
			s := fmt.Sprintf("%v", v)
			if strings.ContainsAny(s, ",\"\n") {
				s = "\"" + strings.ReplaceAll(s, "\"", "\"\"") + "\""
			}
			vals[i] = s
		}
		sb.WriteString(strings.Join(vals, ","))
		sb.WriteString("\n")
	}
	c.String(http.StatusOK, sb.String())
}

// buildReport dispatches to the SQL builder for the requested report type.
func buildReport(c *gin.Context, companyID int64, repType string) (*reportResult, error) {
	switch repType {
	case "distance", "mileage", "daily-distance":
		return reportDistance(c, companyID)
	case "idling", "idle", "idling-waste":
		return reportIdle(c, companyID)
	case "overspeed", "overspeeding":
		return reportOverspeed(c, companyID)
	case "temperature", "reefer":
		return reportTemperature(c, companyID)
	case "distance-matrix", "matrix":
		return reportDistanceMatrix(c, companyID)
	case "trips", "trip":
		return reportTrips(c, companyID)
	case "fuel", "fuel-consumption":
		return reportFuel(c, companyID)
	case "driver", "drivers":
		return reportDrivers(c, companyID)
	case "reminders", "maintenance", "compliance":
		return reportReminders(c, companyID)
	case "stoppage", "stoppages":
		return reportStoppage(c, companyID)
	case "geofence", "geofences", "zone":
		return reportGeofences(c, companyID)
	case "summary", "fleet":
		return reportSummary(c, companyID)
	default:
		return reportFleetOverview(c, companyID)
	}
}

func reportDistance(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		),
		pts AS (
			SELECT p.device_id, v.id AS vehicle_id, v.reg_number, p.time, p.speed, p.ignition,
			       p.odometer, p.location,
			       LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_time,
			       LAG(p.location) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_location
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			JOIN anchors a ON a.device_id = p.device_id
			WHERE v.company_id = $1
			  AND p.time >= a.anchor - make_interval(hours => ($2::int + $3::int))
			  AND p.time <= a.anchor - make_interval(hours => $3)
		)
		SELECT pts.vehicle_id, pts.reg_number, COALESCE(dr.name, ''),
		       COALESCE(MIN(pts.odometer), 0), COALESCE(MAX(pts.odometer), 0),
		       COALESCE(ROUND((SUM(CASE
		           WHEN pts.prev_time IS NOT NULL AND pts.time - pts.prev_time <= INTERVAL '2 hours'
		           THEN ST_Distance(pts.location::geography, pts.prev_location::geography)
		           ELSE 0 END) / 1000.0)::numeric, 1), 0)::float8,
		       COALESCE(MAX(pts.speed), 0)::float8,
		       COALESCE(ROUND(AVG(pts.speed)::numeric, 1), 0)::float8,
		       COALESCE((SUM(EXTRACT(EPOCH FROM (pts.time - pts.prev_time)) / 60) FILTER (WHERE pts.prev_time IS NOT NULL AND pts.time - pts.prev_time <= INTERVAL '2 hours' AND pts.ignition AND pts.speed > 2)), 0)::int,
		       COALESCE((SUM(EXTRACT(EPOCH FROM (pts.time - pts.prev_time)) / 60) FILTER (WHERE pts.prev_time IS NOT NULL AND pts.time - pts.prev_time <= INTERVAL '2 hours' AND pts.ignition AND pts.speed <= 2)), 0)::int,
		       COALESCE((SUM(EXTRACT(EPOCH FROM (pts.time - pts.prev_time)) / 60) FILTER (WHERE pts.prev_time IS NOT NULL AND pts.time - pts.prev_time <= INTERVAL '2 hours' AND NOT pts.ignition)), 0)::int
		FROM pts
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = pts.vehicle_id
		GROUP BY pts.vehicle_id, pts.reg_number, dr.name
		ORDER BY pts.reg_number ASC
		LIMIT $4
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, win.hours, win.offset, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"driver", "Driver"}, {"startOdo", "Start KM"}, {"endOdo", "End KM"},
		{"distanceKm", "Total KM"}, {"maxSpeed", "Max Speed"}, {"avgSpeed", "Avg Speed"},
		{"runningMin", "Running (Min)"}, {"idleMin", "Idle (Min)"}, {"stopMin", "Stop (Min)"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var (
			vehicleID                    int64
			reg, driver                  string
			startOdo, endOdo             int64
			distance, maxSpeed, avgSpeed float64
			running, idle, stop          int
		)
		if err := rows.Scan(&vehicleID, &reg, &driver, &startOdo, &endOdo, &distance, &maxSpeed, &avgSpeed,
			&running, &idle, &stop); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"vehicleId": vehicleID, "regNumber": reg, "driver": driver,
			"startOdo": startOdo, "endOdo": endOdo, "distanceKm": distance,
			"maxSpeed": maxSpeed, "avgSpeed": avgSpeed,
			"runningMin": running, "idleMin": idle, "stopMin": stop,
		})
	}
	return res, rows.Err()
}

func reportIdle(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		),
		pts AS (
			SELECT p.device_id, p.time, p.speed, p.ignition,
			       LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_time
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			JOIN anchors a ON a.device_id = p.device_id
			WHERE v.company_id = $1
			  AND p.time >= a.anchor - make_interval(hours => ($2::int + $3::int))
			  AND p.time <= a.anchor - make_interval(hours => $3)
		)
		SELECT v.reg_number, COALESCE(dr.name, ''), pts.prev_time, pts.time,
		       ROUND(EXTRACT(EPOCH FROM (pts.time - pts.prev_time)) / 60)::int AS idle_min
		FROM pts
		JOIN vehicles v ON v.device_id = pts.device_id
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		WHERE pts.prev_time IS NOT NULL AND pts.ignition AND pts.speed <= 2
		  AND pts.time - pts.prev_time > INTERVAL '2 minutes'
		  AND pts.time - pts.prev_time <= INTERVAL '2 hours'
		ORDER BY idle_min DESC
		LIMIT $4
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, win.hours, win.offset, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"driver", "Driver"}, {"from", "Idle From"}, {"to", "Idle To"}, {"idleMinutes", "Duration (Min)"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg, driver string
		var from, to time.Time
		var idleMin int
		if err := rows.Scan(&reg, &driver, &from, &to, &idleMin); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "driver": driver,
			"from": from.Format("2006-01-02 15:04"), "to": to.Format("2006-01-02 15:04"),
			"idleMinutes": idleMin,
		})
	}
	return res, rows.Err()
}

func reportOverspeed(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	limit := companySpeedThreshold(c, companyID)
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		)
		SELECT v.reg_number, COALESCE(dr.name, ''), p.time, p.speed, $4::int AS speed_limit
		FROM positions p
		JOIN vehicles v ON v.device_id = p.device_id
		JOIN anchors a ON a.device_id = p.device_id
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		WHERE v.company_id = $1
		  AND p.time >= a.anchor - make_interval(hours => ($2::int + $3::int))
		  AND p.time <= a.anchor - make_interval(hours => $3)
		  AND p.speed > $4
		ORDER BY p.speed DESC, p.time DESC
		LIMIT $5
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, win.hours, win.offset, limit, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"driver", "Driver"}, {"time", "Time"},
		{"speed", "Speed"}, {"speedLimit", "Limit"}, {"exceedBy", "Excess"},
	}, Rows: []map[string]interface{}{}}
	if limit <= 0 {
		return res, nil
	}

	for rows.Next() {
		var reg, driver string
		var ts time.Time
		var speed float64
		var speedLimit int
		if err := rows.Scan(&reg, &driver, &ts, &speed, &speedLimit); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "driver": driver, "time": ts.Format("2006-01-02 15:04"),
			"speed": speed, "speedLimit": speedLimit, "exceedBy": speed - float64(speedLimit),
		})
	}
	return res, rows.Err()
}

func reportTemperature(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		)
		SELECT v.reg_number, COALESCE(MIN(p.temperature), 0)::float8, COALESCE(MAX(p.temperature), 0)::float8,
		       COALESCE(ROUND(AVG(p.temperature)::numeric, 1), 0)::float8, COUNT(*)
		FROM positions p
		JOIN vehicles v ON v.device_id = p.device_id
		JOIN anchors a ON a.device_id = p.device_id
		WHERE v.company_id = $1
		  AND p.time >= a.anchor - make_interval(hours => ($2::int + $3::int))
		  AND p.time <= a.anchor - make_interval(hours => $3)
		  AND p.temperature IS NOT NULL AND p.temperature <> 0
		GROUP BY v.reg_number
		ORDER BY MIN(p.temperature) ASC
		LIMIT $4
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, win.hours, win.offset, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"minTemp", "Min °C"}, {"maxTemp", "Max °C"},
		{"avgTemp", "Avg °C"}, {"readings", "Readings"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg string
		var minT, maxT, avgT float64
		var readings int64
		if err := rows.Scan(&reg, &minT, &maxT, &avgT, &readings); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "minTemp": minT, "maxTemp": maxT, "avgTemp": avgT, "readings": readings,
		})
	}
	return res, rows.Err()
}

func reportDistanceMatrix(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	hours := win.hours
	if qDays := c.Query("days"); qDays != "" {
		hours = atoiDefault(qDays, 31) * 24
	}
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		),
		legs AS (
			SELECT p.device_id, p.time::date AS day,
			       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap,
			       ST_Distance(p.location::geography,
			                   LAG(p.location) OVER (PARTITION BY p.device_id ORDER BY p.time)::geography) AS meters
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			JOIN anchors a ON a.device_id = p.device_id
			WHERE v.company_id = $1 AND p.time >= a.anchor - make_interval(hours => $2)
		)
		SELECT v.reg_number, TO_CHAR(legs.day, 'YYYY-MM-DD'),
		       COALESCE(ROUND((SUM(legs.meters) / 1000.0)::numeric, 1), 0)::float8
		FROM legs
		JOIN vehicles v ON v.device_id = legs.device_id
		WHERE legs.meters IS NOT NULL
		  AND legs.gap <= INTERVAL '2 hours'
		GROUP BY v.reg_number, legs.day
		ORDER BY legs.day DESC, v.reg_number ASC
		LIMIT $3
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, hours, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"day", "Date"}, {"distanceKm", "Distance KM"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg, day string
		var km float64
		if err := rows.Scan(&reg, &day, &km); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{"regNumber": reg, "day": day, "distanceKm": km})
	}
	return res, rows.Err()
}

func reportTrips(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT ft.trip_no, COALESCE(v.reg_number, ''), COALESCE(ft.driver1_name, ''), COALESCE(ft.party_name, ''),
		       COALESCE(ft.source, ''), COALESCE(ft.destination, ''), COALESCE(ft.freight_amount, 0)::float8,
		       COALESCE(ft.advance_amount, 0)::float8, COALESCE(ft.expense_amount, 0)::float8,
		       COALESCE(ft.balance_amount, 0)::float8, COALESCE(ft.status, ''), ft.planned_start
		FROM fleet_trips ft
		LEFT JOIN vehicles v ON ft.vehicle_id = v.id
		WHERE ft.company_id = $1
		ORDER BY ft.id DESC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"tripNo", "Trip"}, {"vehicleReg", "Vehicle"}, {"driver", "Driver"}, {"party", "Party"},
		{"source", "Source"}, {"destination", "Destination"}, {"freight", "Freight"},
		{"advance", "Advance"}, {"expense", "Expense"}, {"balance", "Balance"}, {"status", "Status"}, {"plannedStart", "Planned Start"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var tripNo, reg, driver, party, source, dest, status string
		var freight, advance, expense, balance float64
		var planned *time.Time
		if err := rows.Scan(&tripNo, &reg, &driver, &party, &source, &dest, &freight, &advance, &expense, &balance, &status, &planned); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"tripNo": tripNo, "vehicleReg": reg, "driver": driver, "party": party,
			"source": source, "destination": dest, "freight": freight, "advance": advance,
			"expense": expense, "balance": balance, "status": status,
			"plannedStart": fmtTime(planned, "2006-01-02 15:04"),
		})
	}
	return res, rows.Err()
}

func reportFuel(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT v.reg_number, COALESCE(SUM(fr.liters), 0)::float8, COALESCE(SUM(fr.cost), 0)::float8,
		       COALESCE(MAX(fr.odometer), 0), COUNT(*)
		FROM fuel_records fr
		JOIN vehicles v ON fr.vehicle_id = v.id
		WHERE fr.company_id = $1 AND fr.fuel_date >= NOW() - INTERVAL '31 days'
		GROUP BY v.reg_number
		ORDER BY SUM(fr.liters) DESC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"liters", "Liters"}, {"cost", "Cost"},
		{"lastOdometer", "Last Odometer"}, {"receipts", "Receipts"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg string
		var liters, cost float64
		var odo int64
		var receipts int64
		if err := rows.Scan(&reg, &liters, &cost, &odo, &receipts); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "liters": liters, "cost": cost, "lastOdometer": odo, "receipts": receipts,
		})
	}
	return res, rows.Err()
}

func reportDrivers(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT d.name, COALESCE(d.phone, ''), COALESCE(d.license_no, ''), COALESCE(v.reg_number, ''),
		       COALESCE(d.status, ''), (SELECT COUNT(*) FROM fleet_trips ft WHERE ft.company_id = d.company_id AND ft.driver1_name = d.name)
		FROM drivers d
		LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
		WHERE d.company_id = $1
		ORDER BY d.name ASC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"name", "Driver"}, {"phone", "Phone"}, {"licenseNo", "License"},
		{"assignedVehicle", "Vehicle"}, {"status", "Status"}, {"tripCount", "Trips"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var name, phone, license, reg, status string
		var tripCount int64
		if err := rows.Scan(&name, &phone, &license, &reg, &status, &tripCount); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"name": name, "phone": phone, "licenseNo": license,
			"assignedVehicle": reg, "status": status, "tripCount": tripCount,
		})
	}
	return res, rows.Err()
}

func reportReminders(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT COALESCE(v.reg_number, ''), r.reminder_type, r.due_date,
		       (r.due_date - CURRENT_DATE)::int AS days_remaining, r.is_acknowledged
		FROM reminders r
		LEFT JOIN vehicles v ON r.vehicle_id = v.id
		WHERE r.company_id = $1
		ORDER BY r.due_date ASC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"vehicleReg", "Vehicle"}, {"reminderType", "Reminder"}, {"dueDate", "Due Date"},
		{"daysRemaining", "Days"}, {"status", "Status"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg, rtype string
		var due time.Time
		var days int
		var ack bool
		if err := rows.Scan(&reg, &rtype, &due, &days, &ack); err != nil {
			continue
		}
		status := "Valid"
		if days < 0 {
			status = "Expired"
		} else if days <= 15 {
			status = "Due Soon"
		}
		if ack {
			status = "Acknowledged"
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"vehicleReg": reg, "reminderType": rtype, "dueDate": due.Format("2006-01-02"),
			"daysRemaining": days, "status": status,
		})
	}
	return res, rows.Err()
}

func reportStoppage(c *gin.Context, companyID int64) (*reportResult, error) {
	win := reportWindowFrom(c)
	query := `
		WITH anchors AS (
			SELECT device_id, MAX(time) AS anchor
			FROM (
				SELECT p.device_id, p.time,
				       p.time - LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS gap
				FROM positions p
				JOIN vehicles v ON v.device_id = p.device_id
				WHERE v.company_id = $1
			) x
			WHERE gap IS NULL OR gap <= INTERVAL '2 hours'
			GROUP BY device_id
		),
		pts AS (
			SELECT p.device_id, p.time, p.ignition, p.speed,
			       LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_time
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			JOIN anchors a ON a.device_id = p.device_id
			WHERE v.company_id = $1
			  AND p.time >= a.anchor - make_interval(hours => ($2::int + $3::int))
			  AND p.time <= a.anchor - make_interval(hours => $3)
		)
		SELECT v.reg_number, COALESCE(dr.name, ''), pts.prev_time, pts.time,
		       ROUND(EXTRACT(EPOCH FROM (pts.time - pts.prev_time)) / 60)::int
		FROM pts
		JOIN vehicles v ON v.device_id = pts.device_id
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		WHERE pts.prev_time IS NOT NULL AND NOT pts.ignition
		  AND pts.time - pts.prev_time > INTERVAL '5 minutes'
		  AND pts.time - pts.prev_time <= INTERVAL '2 hours'
		ORDER BY 5 DESC
		LIMIT $4
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, win.hours, win.offset, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"driver", "Driver"}, {"from", "Stopped From"}, {"to", "Stopped To"}, {"stopMinutes", "Duration (Min)"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg, driver string
		var from, to time.Time
		var mins int
		if err := rows.Scan(&reg, &driver, &from, &to, &mins); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "driver": driver,
			"from": from.Format("2006-01-02 15:04"), "to": to.Format("2006-01-02 15:04"), "stopMinutes": mins,
		})
	}
	return res, rows.Err()
}

func reportGeofences(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT g.name, COALESCE(g.type, ''), COALESCE(ROUND((ST_Area(g.geom::geography) / 1000000.0)::numeric, 2), 0)::float8,
		       COALESCE(live.active_vehicles, 0)
		FROM geofences g
		LEFT JOIN LATERAL (
			SELECT COUNT(DISTINCT v.id) AS active_vehicles
			FROM vehicles v
			JOIN LATERAL (SELECT location FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1) p ON TRUE
			WHERE v.company_id = g.company_id AND ST_Contains(g.geom, p.location)
		) live ON TRUE
		WHERE g.company_id = $1
		ORDER BY g.id DESC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"name", "Zone"}, {"type", "Type"}, {"areaKm2", "Area (km²)"}, {"activeVehicles", "Vehicles Inside"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var name, ztype string
		var area float64
		var active int64
		if err := rows.Scan(&name, &ztype, &area, &active); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"name": name, "type": ztype, "areaKm2": area, "activeVehicles": active,
		})
	}
	return res, rows.Err()
}

func reportSummary(c *gin.Context, companyID int64) (*reportResult, error) {
	ctx := c.Request.Context()
	res := &reportResult{Columns: []reportColumn{
		{"metric", "Metric"}, {"value", "Value"},
	}, Rows: []map[string]interface{}{}}

	var totalVehicles, moving, idle, stopped, offline, devices, alerts int64
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM vehicles WHERE company_id = $1", companyID).Scan(&totalVehicles)
	_ = deps.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE v.status <> 'offline' AND p.speed > 2),
			COUNT(*) FILTER (WHERE v.status <> 'offline' AND p.speed <= 2 AND p.ignition),
			COUNT(*) FILTER (WHERE v.status <> 'offline' AND p.speed <= 2 AND NOT p.ignition),
			COUNT(*) FILTER (WHERE p.time IS NULL)
		FROM vehicles v
		LEFT JOIN LATERAL (SELECT speed, ignition, time FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1) p ON TRUE
		WHERE v.company_id = $1
	`, companyID).Scan(&moving, &idle, &stopped, &offline)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices WHERE company_id = $1", companyID).Scan(&devices)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts WHERE company_id = $1 AND acknowledged = FALSE", companyID).Scan(&alerts)

	metrics := []map[string]interface{}{
		{"metric": "Total Vehicles", "value": totalVehicles},
		{"metric": "Moving", "value": moving},
		{"metric": "Idle", "value": idle},
		{"metric": "Stopped", "value": stopped},
		{"metric": "Offline", "value": offline},
		{"metric": "Devices", "value": devices},
		{"metric": "Unacknowledged Alerts", "value": alerts},
	}
	res.Rows = append(res.Rows, metrics...)
	return res, nil
}

func reportFleetOverview(c *gin.Context, companyID int64) (*reportResult, error) {
	query := `
		SELECT v.reg_number, COALESCE(v.make, ''), COALESCE(v.model, ''), COALESCE(dr.name, ''),
		       COALESCE(p.speed, 0)::float8, COALESCE(p.temperature, 0)::float8, p.time, COALESCE(v.odometer, 0)
		FROM vehicles v
		LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
		LEFT JOIN LATERAL (
			SELECT speed, temperature, time FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
		) p ON TRUE
		WHERE v.company_id = $1
		ORDER BY v.reg_number ASC
		LIMIT $2
	`
	rows, err := deps.Pool.Query(c.Request.Context(), query, companyID, maxReportRows)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := &reportResult{Columns: []reportColumn{
		{"regNumber", "Vehicle"}, {"make", "Make"}, {"model", "Model"}, {"driver", "Driver"},
		{"speed", "Speed"}, {"temperature", "Temp"}, {"lastUpdate", "Last Update"}, {"odometer", "Odometer"},
	}, Rows: []map[string]interface{}{}}

	for rows.Next() {
		var reg, make, model, driver string
		var speed, temp float64
		var ts *time.Time
		var odo int64
		if err := rows.Scan(&reg, &make, &model, &driver, &speed, &temp, &ts, &odo); err != nil {
			continue
		}
		res.Rows = append(res.Rows, map[string]interface{}{
			"regNumber": reg, "make": make, "model": model, "driver": driver,
			"speed": speed, "temperature": temp, "lastUpdate": fmtTime(ts, time.RFC3339), "odometer": odo,
		})
	}
	return res, rows.Err()
}

func companySpeedThreshold(c *gin.Context, companyID int64) int {
	var limit int
	if err := deps.Pool.QueryRow(c.Request.Context(),
		"SELECT speed_threshold_kmh FROM company_settings WHERE company_id = $1", companyID).Scan(&limit); err == nil && limit > 0 {
		return limit
	}
	return 0
}

// ─── Dashboard ───────────────────────────────────────────

func dashboardSummaryHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	var total, online, moving, idle, stopped, offline, unacked int64
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM vehicles WHERE company_id = $1", companyID).Scan(&total)
	// Status buckets use the LAST KNOWN position from the database: a vehicle
	// keeps its last moving/idle/stopped state regardless of age and is only
	// offline when it has never reported. `online` is informational (fresh 15m).
	_ = deps.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.time > NOW() - INTERVAL '15 minutes'),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed > 2),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed <= 2 AND p.ignition),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed <= 2 AND NOT p.ignition),
			COUNT(*) FILTER (WHERE p.time IS NULL)
		FROM vehicles v
		LEFT JOIN LATERAL (SELECT speed, ignition, time FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1) p ON TRUE
		WHERE v.company_id = $1
	`, companyID).Scan(&online, &moving, &idle, &stopped, &offline)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts WHERE company_id = $1 AND acknowledged = FALSE", companyID).Scan(&unacked)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"totalVehicles": total, "online": online, "moving": moving, "idle": idle,
		"stopped": stopped, "offline": offline, "unacknowledgedAlerts": unacked,
	}})
}

func dashboardAnalyticsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	var totalVehicles int64
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM vehicles WHERE company_id = $1", companyID).Scan(&totalVehicles)

	var onlineVehicles, recordedVehicles, idleVehicles, stoppedVehicles, runningVehicles, offlineVehicles int64
	// `onlineVehicles` (reporting now) drives "active" counters; the driving
	// status itself is the last known state from the database and is never
	// time-expired. `recordedVehicles` have telemetry history on file.
	_ = deps.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.time > NOW() - INTERVAL '15 minutes'),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed > 2),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed <= 2 AND p.ignition),
			COUNT(*) FILTER (WHERE p.time IS NOT NULL AND p.speed <= 2 AND NOT p.ignition),
			COUNT(*) FILTER (WHERE p.time IS NULL)
		FROM vehicles v
		LEFT JOIN LATERAL (SELECT speed, ignition, time FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1) p ON TRUE
		WHERE v.company_id = $1
	`, companyID).Scan(&onlineVehicles, &recordedVehicles, &runningVehicles, &idleVehicles, &stoppedVehicles, &offlineVehicles)

	occupancy := 0.0
	if totalVehicles > 0 {
		occupancy = float64(onlineVehicles) / float64(totalVehicles) * 100
	}

	// 7-day utilization from real position tracks
	trend := make([]map[string]interface{}, 0)
	rows, err := deps.Pool.Query(ctx, `
		WITH daily AS (
			SELECT DATE_TRUNC('day', p.time) AS day, p.device_id,
			       ST_Distance(p.location::geography,
			                   LAG(p.location) OVER (PARTITION BY p.device_id ORDER BY p.time)::geography) AS leg_meters
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			WHERE v.company_id = $1 AND p.time >= NOW() - INTERVAL '7 days'
		)
		SELECT TO_CHAR(day, 'Dy'), COALESCE(SUM(leg_meters) / 1000.0, 0)::float8, COUNT(DISTINCT device_id)
		FROM daily GROUP BY day ORDER BY day ASC
	`, companyID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var day string
			var km float64
			var devices int64
			if err := rows.Scan(&day, &km, &devices); err == nil {
				occ := 0.0
				if totalVehicles > 0 {
					occ = float64(devices) / float64(totalVehicles) * 100
				}
				trend = append(trend, map[string]interface{}{
					"day": strings.TrimSpace(day), "occupancy": int(occ + 0.5), "km": int(km + 0.5),
				})
			}
		}
	}

	// Fuel + emissions for the last 31 days
	var totalFuel, totalCost float64
	_ = deps.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(liters), 0), COALESCE(SUM(cost), 0)
		FROM fuel_records WHERE company_id = $1 AND fuel_date >= NOW() - INTERVAL '31 days'
	`, companyID).Scan(&totalFuel, &totalCost)

	var km31 float64
	_ = deps.Pool.QueryRow(ctx, `
		WITH legs AS (
			SELECT p.device_id,
			       ST_Distance(p.location::geography,
			                   LAG(p.location) OVER (PARTITION BY p.device_id ORDER BY p.time)::geography) AS meters
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			WHERE v.company_id = $1 AND p.time >= NOW() - INTERVAL '31 days'
		)
		SELECT COALESCE(SUM(meters) / 1000.0, 0) FROM legs WHERE meters IS NOT NULL
	`, companyID).Scan(&km31)

	efficiency := 0.0
	if totalFuel > 0 {
		efficiency = km31 / totalFuel
	}

	var co2Factor float64
	_ = deps.Pool.QueryRow(ctx, "SELECT COALESCE(co2_kg_per_litre, 0) FROM company_settings WHERE company_id = $1", companyID).Scan(&co2Factor)

	var kmToday float64
	_ = deps.Pool.QueryRow(ctx, `
		WITH legs AS (
			SELECT p.device_id,
			       ST_Distance(p.location::geography,
			                   LAG(p.location) OVER (PARTITION BY p.device_id ORDER BY p.time)::geography) AS meters
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			WHERE v.company_id = $1 AND p.time >= CURRENT_DATE
		)
		SELECT COALESCE(SUM(meters) / 1000.0, 0) FROM legs WHERE meters IS NOT NULL
	`, companyID).Scan(&kmToday)

	// Top speed violators from real positions
	violators := make([]map[string]interface{}, 0)
	limit := companySpeedThreshold(c, companyID)
	if limit > 0 {
		vrows, err := deps.Pool.Query(ctx, `
			SELECT v.reg_number, COALESCE(dr.name, ''), MAX(p.speed), COUNT(*)
			FROM positions p
			JOIN vehicles v ON v.device_id = p.device_id
			LEFT JOIN drivers dr ON dr.assigned_vehicle_id = v.id
			WHERE v.company_id = $1 AND p.speed > $2 AND p.time >= NOW() - INTERVAL '31 days'
			GROUP BY v.reg_number, dr.name
			ORDER BY MAX(p.speed) DESC
			LIMIT 5
		`, companyID, limit)
		if err == nil {
			defer vrows.Close()
			for vrows.Next() {
				var reg, driver string
				var topSpeed float64
				var count int64
				if err := vrows.Scan(&reg, &driver, &topSpeed, &count); err == nil {
					violators = append(violators, map[string]interface{}{
						"vehicle": reg, "driver": driver, "topSpeed": topSpeed, "count": count,
					})
				}
			}
		}
	}

	avgDistancePerDay := km31 / 31.0

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"fleetOccupancyPct":  occupancy,
		"activeVehicles":     onlineVehicles,
		"onlineVehicles":     onlineVehicles,
		"recordedVehicles":   recordedVehicles,
		"idleVehicles":       idleVehicles,
		"stoppedVehicles":    stoppedVehicles,
		"runningVehicles":    runningVehicles,
		"offlineVehicles":    offlineVehicles,
		"avgDistancePerDay":  avgDistancePerDay,
		"totalFleetKmToday":  kmToday,
		"totalKm31Days":      km31,
		"fuelEfficiencyKmpl": efficiency,
		"totalFuelBurnedLtr": totalFuel,
		"totalFuelCost":      totalCost,
		"carbonEmissionsKg":  totalFuel * co2Factor,
		"utilizationTrend":   trend,
		"engineStatusRatio": gin.H{
			"running": runningVehicles, "idle": idleVehicles, "stopped": stoppedVehicles,
		},
		"topSpeedViolators": violators,
	}})
}

// nearestPOIHandler returns POIs within the requested radius using PostGIS.
func nearestPOIHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	lat, errLat := strconv.ParseFloat(c.Query("lat"), 64)
	lng, errLng := strconv.ParseFloat(c.Query("lng"), 64)
	if errLat != nil || errLng != nil {
		badRequest(c, "lat and lng query parameters are required")
		return
	}
	radius := atoiDefault(c.Query("radius"), 5000)
	if radius <= 0 {
		radius = 5000
	}

	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT id, name, COALESCE(category, ''), COALESCE(address, ''), COALESCE(phone, ''),
		       ST_Y(location), ST_X(location),
		       ROUND((ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) / 1000.0)::numeric, 2)::float8 AS distance_km
		FROM poi
		WHERE company_id = $1
		  AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
		ORDER BY distance_km ASC
		LIMIT 20
	`, companyID, lng, lat, radius)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type POIResult struct {
		ID         int64   `json:"id"`
		Name       string  `json:"name"`
		Category   string  `json:"category"`
		Address    string  `json:"address"`
		Phone      string  `json:"phone"`
		Lat        float64 `json:"lat"`
		Lng        float64 `json:"lng"`
		DistanceKm float64 `json:"distanceKm"`
	}
	list := make([]POIResult, 0)
	for rows.Next() {
		var p POIResult
		if err := rows.Scan(&p.ID, &p.Name, &p.Category, &p.Address, &p.Phone, &p.Lat, &p.Lng, &p.DistanceKm); err == nil {
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

// ─── RFID Handlers ───────────────────────────────────────

func listRFIDTagsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT d.id, d.rfid_tag, d.name, COALESCE(d.phone, ''), COALESCE(v.reg_number, ''), COALESCE(d.status, '')
		FROM drivers d
		LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
		WHERE d.company_id = $1 AND d.rfid_tag IS NOT NULL AND d.rfid_tag <> ''
		ORDER BY d.name ASC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type RFIDTag struct {
		DriverID    int64  `json:"driverId"`
		Tag         string `json:"tag"`
		DriverName  string `json:"driverName"`
		DriverPhone string `json:"driverPhone"`
		VehicleReg  string `json:"vehicleReg"`
		Status      string `json:"status"`
	}
	list := make([]RFIDTag, 0)
	for rows.Next() {
		var t RFIDTag
		if err := rows.Scan(&t.DriverID, &t.Tag, &t.DriverName, &t.DriverPhone, &t.VehicleReg, &t.Status); err == nil {
			list = append(list, t)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": list})
}

func createRFIDTagHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		DriverID int64  `json:"driverId"`
		Tag      string `json:"tag"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.DriverID <= 0 || strings.TrimSpace(req.Tag) == "" {
		badRequest(c, "driverId and tag are required")
		return
	}
	tag, err := deps.Pool.Exec(c.Request.Context(),
		"UPDATE drivers SET rfid_tag = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3",
		req.Tag, req.DriverID, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "driver not found for this organization"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "RFID tag registered"})
}

func assignRFIDHandler(c *gin.Context) {
	createRFIDTagHandler(c)
}

// ─── Invoice Handlers ────────────────────────────────────

func listInvoicesHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT i.id, i.company_id, COALESCE(c.name, ''), i.inv_number, i.inv_date, i.amount, i.tax_amount,
		       i.total_amount, i.paid_amount, i.status, i.due_date, COALESCE(i.plan, ''),
		       COALESCE(i.device_count, 0), COALESCE(i.rate_per_device, 0)::float8, COALESCE(i.notes, '')
		FROM invoices i
		LEFT JOIN companies c ON i.company_id = c.id
		WHERE i.company_id = $1
		ORDER BY i.id DESC
	`, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	c.JSON(http.StatusOK, gin.H{"success": true, "company_id": companyID, "data": scanInvoices(rows)})
}

func getInvoiceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid invoice id")
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT i.id, i.company_id, COALESCE(c.name, ''), i.inv_number, i.inv_date, i.amount, i.tax_amount,
		       i.total_amount, i.paid_amount, i.status, i.due_date, COALESCE(i.plan, ''),
		       COALESCE(i.device_count, 0), COALESCE(i.rate_per_device, 0)::float8, COALESCE(i.notes, '')
		FROM invoices i
		LEFT JOIN companies c ON i.company_id = c.id
		WHERE i.id = $1 AND i.company_id = $2
	`, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()
	list := scanInvoices(rows)
	if len(list) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "invoice not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list[0]})
}

func scanInvoices(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}) []map[string]interface{} {
	list := []map[string]interface{}{}
	for rows.Next() {
		var (
			id, companyID            int64
			companyName              string
			invNumber                string
			invDate, dueDate         *time.Time
			amount, tax, total, paid float64
			status, plan, notes      string
			deviceCount              int
			ratePerDevice            float64
		)
		if err := rows.Scan(&id, &companyID, &companyName, &invNumber, &invDate, &amount, &tax,
			&total, &paid, &status, &dueDate, &plan, &deviceCount, &ratePerDevice, &notes); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"id": id, "companyId": companyID, "companyName": companyName, "invoiceNo": invNumber,
			"invDate": fmtTime(invDate, "2006-01-02"), "dueDate": fmtTime(dueDate, "2006-01-02"),
			"amount": amount, "taxAmount": tax, "totalAmount": total, "paidAmount": paid,
			"status": status, "plan": plan, "deviceCount": deviceCount,
			"ratePerDevice": ratePerDevice, "notes": notes,
		})
	}
	return list
}

func createInvoiceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	var req struct {
		CompanyID     int64   `json:"companyId"`
		InvoiceNo     string  `json:"invoiceNo"`
		InvDate       string  `json:"invDate"`
		Amount        float64 `json:"amount"`
		TaxAmount     float64 `json:"taxAmount"`
		TotalAmount   float64 `json:"totalAmount"`
		PaidAmount    float64 `json:"paidAmount"`
		Status        string  `json:"status"`
		DueDate       string  `json:"dueDate"`
		Plan          string  `json:"plan"`
		DeviceCount   int     `json:"deviceCount"`
		RatePerDevice float64 `json:"ratePerDevice"`
		Notes         string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	// SuperAdmins may target another tenant; ordinary users stay scoped.
	targetCompany := companyID
	if role, _ := c.Get("role"); role == "superadmin" && req.CompanyID > 0 {
		targetCompany = req.CompanyID
	}

	invDate := time.Now()
	if req.InvDate != "" {
		if t, err := time.Parse("2006-01-02", req.InvDate); err == nil {
			invDate = t
		}
	}
	var dueDate *time.Time
	if req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = &t
		}
	}
	amount := req.Amount
	if amount == 0 && req.DeviceCount > 0 && req.RatePerDevice > 0 {
		amount = float64(req.DeviceCount) * req.RatePerDevice
	}
	tax := req.TaxAmount
	if tax == 0 && amount > 0 {
		var vat float64
		_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COALESCE(vat_percent, 0) FROM company_settings WHERE company_id = $1", targetCompany).Scan(&vat)
		tax = amount * vat / 100.0
	}
	total := req.TotalAmount
	if total == 0 {
		total = amount + tax
	}
	status := strings.ToLower(req.Status)
	if status == "" {
		status = "unpaid"
	}
	invNumber := req.InvoiceNo
	if invNumber == "" {
		var nextID int64
		_ = deps.Pool.QueryRow(c.Request.Context(), "SELECT COALESCE(MAX(id), 0) + 1 FROM invoices").Scan(&nextID)
		invNumber = fmt.Sprintf("INV-%d-%04d", time.Now().Year(), nextID)
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO invoices (company_id, inv_number, inv_date, amount, tax_amount, total_amount, paid_amount,
		                      status, due_date, plan, device_count, rate_per_device, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),NULLIF($11,0),NULLIF($12,0),NULLIF($13,''))
		RETURNING id
	`, targetCompany, invNumber, invDate, amount, tax, total, req.PaidAmount, status, dueDate,
		req.Plan, req.DeviceCount, req.RatePerDevice, req.Notes).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "invoiceNo": invNumber, "message": "Invoice created"})
}

func updateInvoiceHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid invoice id")
		return
	}
	var req struct {
		Status     string  `json:"status"`
		PaidAmount float64 `json:"paidAmount"`
		DueDate    string  `json:"dueDate"`
		Notes      string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	var dueDate *time.Time
	if req.DueDate != "" {
		if t, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = &t
		}
	}
	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE invoices SET
			status = COALESCE(NULLIF($1,''), status),
			paid_amount = CASE WHEN $2 > 0 THEN $2 ELSE paid_amount END,
			due_date = COALESCE($3, due_date),
			notes = COALESCE(NULLIF($4,''), notes)
		WHERE id = $5 AND company_id = $6
	`, strings.ToLower(req.Status), req.PaidAmount, dueDate, req.Notes, id, companyID)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "invoice not found for this organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Invoice updated"})
}

// downloadInvoicePDFHandler renders a single-page PDF from the invoice row.
func downloadInvoicePDFHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	companyID, ok := companyScope(c)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid invoice id")
		return
	}

	var (
		invNumber, companyName, status, plan string
		invDate, dueDate                     *time.Time
		amount, tax, total, paid             float64
		deviceCount                          int
	)
	err = deps.Pool.QueryRow(c.Request.Context(), `
		SELECT i.inv_number, COALESCE(c.name, ''), i.inv_date, i.amount, i.tax_amount, i.total_amount,
		       i.paid_amount, i.status, i.due_date, COALESCE(i.plan, ''), COALESCE(i.device_count, 0)
		FROM invoices i LEFT JOIN companies c ON i.company_id = c.id
		WHERE i.id = $1 AND i.company_id = $2
	`, id, companyID).Scan(&invNumber, &companyName, &invDate, &amount, &tax, &total, &paid, &status, &dueDate, &plan, &deviceCount)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "invoice not found for this organization"})
		return
	}

	lines := []string{
		fmt.Sprintf("Tax Invoice %s", invNumber),
		fmt.Sprintf("Organization: %s", companyName),
		fmt.Sprintf("Plan: %s", plan),
		fmt.Sprintf("Devices: %d", deviceCount),
		fmt.Sprintf("Invoice date: %s", fmtTime(invDate, "2006-01-02")),
		fmt.Sprintf("Due date: %s", fmtTime(dueDate, "2006-01-02")),
		fmt.Sprintf("Subtotal: AED %.2f", amount),
		fmt.Sprintf("VAT: AED %.2f", tax),
		fmt.Sprintf("Total: AED %.2f", total),
		fmt.Sprintf("Paid: AED %.2f", paid),
		fmt.Sprintf("Status: %s", strings.ToUpper(status)),
	}

	pdf := renderSimplePDF(lines)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.pdf\"", invNumber))
	c.Data(http.StatusOK, "application/pdf", pdf)
}

// renderSimplePDF builds a minimal valid one-page PDF containing lines of text.
func renderSimplePDF(lines []string) []byte {
	var content strings.Builder
	content.WriteString("BT\n/F1 12 Tf\n50 780 Td\n14 TL\n")
	for _, l := range lines {
		escaped := strings.NewReplacer("\\", "\\\\", "(", "\\(", ")", "\\)").Replace(l)
		content.WriteString(fmt.Sprintf("(%s) Tj T*\n", escaped))
	}
	content.WriteString("ET\n")
	stream := content.String()

	objs := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", len(stream), stream),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}

	var out strings.Builder
	out.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs)+1)
	for i, obj := range objs {
		offsets[i+1] = out.Len()
		out.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, obj))
	}
	xrefPos := out.Len()
	out.WriteString(fmt.Sprintf("xref\n0 %d\n", len(objs)+1))
	out.WriteString("0000000000 65535 f \n")
	for i := 1; i <= len(objs); i++ {
		out.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	out.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objs)+1, xrefPos))
	return []byte(out.String())
}

// ─── Admin Handlers ──────────────────────────────────────

func adminDashboardHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	ctx := c.Request.Context()

	var (
		tenants, devices, vehicles, users, alerts, trips, invoicesCount int64
		positions24h, onlineDevices                                     int64
	)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM companies").Scan(&tenants)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices").Scan(&devices)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM vehicles").Scan(&vehicles)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&users)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM alerts WHERE acknowledged = FALSE").Scan(&alerts)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM fleet_trips WHERE status = 'In Transit'").Scan(&trips)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM invoices").Scan(&invoicesCount)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM positions WHERE time >= NOW() - INTERVAL '24 hours'").Scan(&positions24h)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices WHERE last_heartbeat IS NOT NULL AND last_heartbeat >= NOW() - INTERVAL '15 minutes'").Scan(&onlineDevices)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"totalTenants": tenants, "totalDevices": devices, "onlineDevices": onlineDevices,
		"totalVehicles": vehicles, "systemUsers": users, "unacknowledgedAlerts": alerts,
		"activeTrips": trips, "totalInvoices": invoicesCount, "positionsLast24h": positions24h,
	}})
}

func adminStatsHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	ctx := c.Request.Context()
	var totalTenants, activeVehicles, systemUsers, siraActive int64
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM companies").Scan(&totalTenants)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM devices").Scan(&activeVehicles)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&systemUsers)
	_ = deps.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM companies WHERE sira_relay = TRUE").Scan(&siraActive)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"totalTenants": totalTenants, "activeVehicles": activeVehicles,
		"systemUsers": systemUsers, "siraRelayActive": siraActive,
	}})
}

func adminMISReportHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT c.id, c.name, c.code,
		       (SELECT COUNT(*) FROM devices d WHERE d.company_id = c.id),
		       (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id),
		       (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id),
		       (SELECT COUNT(*) FROM alerts a WHERE a.company_id = c.id),
		       (SELECT COUNT(*) FROM fleet_trips ft WHERE ft.company_id = c.id),
		       (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i WHERE i.company_id = c.id AND i.status = 'paid')
		FROM companies c ORDER BY c.id
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	type MISRow struct {
		CompanyID   int64   `json:"companyId"`
		CompanyName string  `json:"companyName"`
		Code        string  `json:"code"`
		Devices     int64   `json:"devices"`
		Vehicles    int64   `json:"vehicles"`
		Users       int64   `json:"users"`
		Alerts      int64   `json:"alerts"`
		Trips       int64   `json:"trips"`
		PaidRevenue float64 `json:"paidRevenue"`
	}
	list := make([]MISRow, 0)
	for rows.Next() {
		var r MISRow
		if err := rows.Scan(&r.CompanyID, &r.CompanyName, &r.Code, &r.Devices, &r.Vehicles, &r.Users, &r.Alerts, &r.Trips, &r.PaidRevenue); err == nil {
			list = append(list, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func createCompanyHandler(c *gin.Context) {
	if dbUnavailable(c) {
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
		MaxDevices    int    `json:"maxDevices"`
		MaxUsers      int    `json:"maxUsers"`
		SIRARelay     *bool  `json:"siraRelay"`
		City          string `json:"city"`
		Address       string `json:"address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Code) == "" {
		badRequest(c, "name and code are required")
		return
	}
	statusInt := 1
	if strings.EqualFold(req.Status, "Suspended") {
		statusInt = 0
	}

	var newID int64
	err := deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO companies (name, code, contact_person, email, phone, database_name, city, address,
		                       status, max_devices, max_users, sira_relay, created_at, updated_at)
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),
		        $9,NULLIF($10,0),NULLIF($11,0),COALESCE($12,FALSE),NOW(),NOW())
		RETURNING id
	`, req.Name, req.Code, req.ContactPerson, req.ContactEmail, req.ContactPhone, req.DBShard,
		req.City, req.Address, statusInt, req.MaxDevices, req.MaxUsers, req.SIRARelay).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}

	// The API key is derived from the persisted identity and stored in the DB.
	apiKey := fmt.Sprintf("RN-KEY-%s-%02d", req.Code, newID)
	_, _ = deps.Pool.Exec(c.Request.Context(), "UPDATE companies SET api_key = $1 WHERE id = $2", apiKey, newID)

	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "apiKey": apiKey, "message": "Company created successfully"})
}

func updateCompanyHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid company id")
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
		MaxDevices    int    `json:"maxDevices"`
		MaxUsers      int    `json:"maxUsers"`
		SIRARelay     *bool  `json:"siraRelay"`
		City          string `json:"city"`
		Address       string `json:"address"`
		RegenerateKey bool   `json:"regenerateKey"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	// Status is only changed when explicitly provided.
	var statusInt *int
	if req.Status != "" {
		v := 1
		if strings.EqualFold(req.Status, "Suspended") {
			v = 0
		}
		statusInt = &v
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE companies SET
			name = COALESCE(NULLIF($1,''), name),
			code = COALESCE(NULLIF($2,''), code),
			contact_person = COALESCE(NULLIF($3,''), contact_person),
			email = COALESCE(NULLIF($4,''), email),
			phone = COALESCE(NULLIF($5,''), phone),
			database_name = COALESCE(NULLIF($6,''), database_name),
			city = COALESCE(NULLIF($7,''), city),
			address = COALESCE(NULLIF($8,''), address),
			status = COALESCE($9, status),
			max_devices = COALESCE(NULLIF($10,0), max_devices),
			max_users = COALESCE(NULLIF($11,0), max_users),
			sira_relay = COALESCE($12, sira_relay),
			updated_at = NOW()
		WHERE id = $13
	`, req.Name, req.Code, req.ContactPerson, req.ContactEmail, req.ContactPhone, req.DBShard,
		req.City, req.Address, statusInt, req.MaxDevices, req.MaxUsers, req.SIRARelay, id)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "company not found"})
		return
	}

	resp := gin.H{"success": true, "message": "Company updated successfully"}
	if req.RegenerateKey {
		var code string
		if err := deps.Pool.QueryRow(c.Request.Context(), "SELECT code FROM companies WHERE id = $1", id).Scan(&code); err == nil {
			apiKey := fmt.Sprintf("RN-KEY-%s-%02d-%d", code, id, time.Now().Unix()%10000)
			if _, err := deps.Pool.Exec(c.Request.Context(), "UPDATE companies SET api_key = $1 WHERE id = $2", apiKey, id); err == nil {
				resp["apiKey"] = apiKey
			}
		}
	}
	c.JSON(http.StatusOK, resp)
}

func adminListUsersHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	rows, err := deps.Pool.Query(c.Request.Context(), `
		SELECT u.id, u.username, COALESCE(u.full_name, u.username), COALESCE(u.email, ''), u.role,
		       COALESCE(u.company_id, 0), COALESCE(c.name, ''), CASE WHEN u.is_active THEN 'Active' ELSE 'Inactive' END,
		       COALESCE(u.phone, '')
		FROM users u
		LEFT JOIN companies c ON u.company_id = c.id
		ORDER BY u.id ASC
	`)
	if err != nil {
		serverError(c, err)
		return
	}
	defer rows.Close()

	var users []gin.H
	for rows.Next() {
		var id, compID int64
		var uname, fname, email, role, cname, status, phone string
		if err := rows.Scan(&id, &uname, &fname, &email, &role, &compID, &cname, &status, &phone); err == nil {
			users = append(users, gin.H{
				"id": id, "username": uname, "fullName": fname, "email": email, "role": role,
				"companyId": compID, "companyName": cname, "status": status, "phone": phone,
			})
		}
	}
	if users == nil {
		users = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": users})
}

func adminCreateUserHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	var req struct {
		Username  string `json:"username"`
		Password  string `json:"password"`
		FullName  string `json:"fullName"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Role      string `json:"role"`
		CompanyID int64  `json:"companyId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Username == "" || len(req.Password) < 6 || req.CompanyID <= 0 {
		badRequest(c, "username, password (min 6 chars) and companyId are required")
		return
	}
	if req.Role == "" {
		badRequest(c, "role is required")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		serverError(c, err)
		return
	}
	var newID int64
	err = deps.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO users (company_id, username, password_hash, full_name, email, phone, role, is_active)
		VALUES ($1, $2, $3, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), $7, TRUE)
		RETURNING id
	`, req.CompanyID, req.Username, hash, req.FullName, req.Email, req.Phone, req.Role).Scan(&newID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "id": newID, "message": "User created"})
}

func adminUpdateUserHandler(c *gin.Context) {
	if dbUnavailable(c) {
		return
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		badRequest(c, "invalid user id")
		return
	}
	var req struct {
		FullName  string `json:"fullName"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Role      string `json:"role"`
		CompanyID int64  `json:"companyId"`
		IsActive  *bool  `json:"isActive"`
		Password  string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}

	tag, err := deps.Pool.Exec(c.Request.Context(), `
		UPDATE users SET
			full_name = COALESCE(NULLIF($1,''), full_name),
			email = COALESCE(NULLIF($2,''), email),
			phone = COALESCE(NULLIF($3,''), phone),
			role = COALESCE(NULLIF($4,''), role),
			company_id = COALESCE(NULLIF($5,0), company_id),
			is_active = COALESCE($6, is_active),
			updated_at = NOW()
		WHERE id = $7
	`, req.FullName, req.Email, req.Phone, req.Role, req.CompanyID, req.IsActive, id)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "user not found"})
		return
	}
	if req.Password != "" {
		hash, err := hashPassword(req.Password)
		if err != nil {
			serverError(c, err)
			return
		}
		if _, err := deps.Pool.Exec(c.Request.Context(), "UPDATE users SET password_hash = $1 WHERE id = $2", hash, id); err != nil {
			serverError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "User updated"})
}
