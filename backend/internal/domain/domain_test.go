package domain

import (
	"testing"
	"time"
)

func TestVehicleDomain(t *testing.T) {
	v := Vehicle{
		ID:        1001,
		CompanyID: 1,
		RegNumber: "DXB-A-92811",
		Make:      "Volvo",
		Model:     "FH16",
		MaxSpeed:  100,
		Odometer:  142850,
		IconType:  "truck",
		CreatedAt: time.Now(),
	}

	if v.RegNumber != "DXB-A-92811" {
		t.Errorf("expected RegNumber DXB-A-92811, got %s", v.RegNumber)
	}

	if v.MaxSpeed != 100 {
		t.Errorf("expected MaxSpeed 100, got %d", v.MaxSpeed)
	}
}

func TestVehicleWithTelemetry(t *testing.T) {
	lat := 25.2048
	lng := 55.2708
	speed := 64.5
	temp := -18.4
	ign := true

	vt := VehicleWithTelemetry{
		ID:          1,
		CompanyID:   1,
		RegNumber:   "DXB-K-58046",
		Status:      "moving",
		Lat:         &lat,
		Lng:         &lng,
		Speed:       &speed,
		Temperature: &temp,
		Ignition:    &ign,
	}

	if vt.Status != "moving" {
		t.Errorf("expected moving status, got %s", vt.Status)
	}

	if *vt.Speed != 64.5 {
		t.Errorf("expected speed 64.5, got %f", *vt.Speed)
	}

	if *vt.Temperature != -18.4 {
		t.Errorf("expected temp -18.4, got %f", *vt.Temperature)
	}
}

func TestGeofenceModels(t *testing.T) {
	coords := [][]float64{
		{55.0617, 25.0112},
		{55.0717, 25.0112},
		{55.0717, 25.0212},
		{55.0617, 25.0112},
	}
	gf := Geofence{
		ID:           1,
		CompanyID:    1,
		Name:         "Jebel Ali Port Zone",
		Type:         "zone",
		AlertOnEnter: true,
		AlertOnExit:  true,
		Coordinates:  coords,
	}

	if gf.Type != "zone" || !gf.AlertOnEnter || len(gf.Coordinates) != 4 {
		t.Errorf("unexpected geofence properties: %+v", gf)
	}
}

func TestPOIModel(t *testing.T) {
	poi := POI{
		ID:        1,
		CompanyID: 1,
		Name:      "ENOC Fuel Station Al Quoz",
		Latitude:  25.1324,
		Longitude: 55.2415,
		Category:  "Fuel Station",
		Address:   "Al Quoz Industrial Area 3, Dubai",
	}

	if poi.Name != "ENOC Fuel Station Al Quoz" || poi.Category != "Fuel Station" {
		t.Errorf("unexpected POI fields: %+v", poi)
	}
}
