package service

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/repository/postgres"
	"github.com/xuri/excelize/v2"
)

// ReportService handles generation of structured reports and Excel export.
type ReportService struct {
	reportRepo *postgres.ReportRepository
}

// NewReportService creates a new ReportService.
func NewReportService(reportRepo *postgres.ReportRepository) *ReportService {
	return &ReportService{reportRepo: reportRepo}
}

// GenerateDistanceReport generates DistanceReportRow data.
func (s *ReportService) GenerateDistanceReport(ctx context.Context, companyID int64, startStr, endStr string) ([]domain.DistanceReportRow, error) {
	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		start = time.Now().Add(-24 * time.Hour)
	}
	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		end = time.Now()
	}

	return s.reportRepo.GetDistanceReport(ctx, companyID, start, end)
}

// ExportDistanceReportToExcel converts distance report rows into an Excel .xlsx spreadsheet byte stream.
func (s *ReportService) ExportDistanceReportToExcel(rows []domain.DistanceReportRow) ([]byte, error) {
	f := excelize.NewFile()
	sheetName := "Distance Report"
	f.SetSheetName("Sheet1", sheetName)

	// Set Headers
	headers := []string{
		"Device ID", "Plate No", "Start Odometer (km)", "End Odometer (km)",
		"Distance (km)", "Max Speed (km/h)", "Avg Speed (km/h)",
		"Running (min)", "Idle (min)", "Stopped (min)",
	}

	for colIdx, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	// Set Data Rows
	for rowIdx, r := range rows {
		rowNum := rowIdx + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", rowNum), r.DeviceID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", rowNum), r.RegNumber)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", rowNum), r.StartOdometer)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", rowNum), r.EndOdometer)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", rowNum), r.DistanceKM)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", rowNum), r.MaxSpeed)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", rowNum), r.AvgSpeed)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", rowNum), r.MovingTimeMin)
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", rowNum), r.IdleTimeMin)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", rowNum), r.StopTimeMin)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to write excel buffer: %w", err)
	}
	return buf.Bytes(), nil
}
