// Package codec implements GPS device protocol decoders.
// Currently supports Teltonika FMB920 (Codec 8).
// Ported from the legacy Teltonika.cs with identical byte-level logic.
package codec

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/rudra-netra/backend/internal/domain"
)

// Teltonika IO element IDs — matches constants from legacy Teltonika.cs
const (
	IO_ACC         = 1
	IO_INPUT2      = 2
	IO_INPUT3      = 3
	IO_ANALOG      = 4
	IO_GSM         = 5
	IO_SPEED       = 6
	IO_VOLTAGE     = 7
	IO_GPSPOWER    = 8
	IO_ODOMETER    = 16
	IO_STOP        = 20
	IO_TRIP        = 28
	IO_IMMOBILIZER = 29
	IO_AUTHORIZED  = 30
	IO_OVERSPEED   = 33
	IO_OUTPUT1     = 179
	IO_OUTPUT2     = 180
	IO_OUTPUT3     = 50
	IO_TEMPERATURE = 72
	IO_RFID        = 207
	IO_GREEDRIVING = 253

	CODEC8 = 0x08
)

// Codec defines the interface for GPS device protocol decoders.
type Codec interface {
	// ParseIMEI extracts the IMEI from the initial handshake bytes.
	ParseIMEI(data []byte) (string, error)
	// ParseData decodes a data packet into Position records.
	ParseData(data []byte, deviceID int64) ([]domain.Position, error)
	// Acknowledge returns the acknowledgment bytes to send back to the device.
	Acknowledge(count int) []byte
}

// TeltonikaCodec decodes Teltonika Codec 8 protocol.
type TeltonikaCodec struct{}

// NewTeltonikaCodec creates a new Teltonika protocol decoder.
func NewTeltonikaCodec() *TeltonikaCodec {
	return &TeltonikaCodec{}
}

// ParseIMEI extracts the 15-digit IMEI from the Teltonika handshake packet.
// Packet format: [2 bytes: IMEI length] [N bytes: IMEI as ASCII]
func (t *TeltonikaCodec) ParseIMEI(data []byte) (string, error) {
	if len(data) < 2 {
		return "", fmt.Errorf("IMEI packet too short: %d bytes", len(data))
	}

	imeiLen := int(binary.BigEndian.Uint16(data[0:2]))
	if len(data) < 2+imeiLen {
		return "", fmt.Errorf("IMEI data incomplete: expected %d bytes, got %d", imeiLen, len(data)-2)
	}

	imei := string(data[2 : 2+imeiLen])
	if len(imei) < 15 {
		return "", fmt.Errorf("invalid IMEI length: %d", len(imei))
	}

	return imei, nil
}

// ParseData decodes a Teltonika Codec 8 AVL data packet into Position records.
// Packet format:
//
//	[4 bytes: preamble 0x00000000]
//	[4 bytes: data length]
//	[1 byte:  codec ID (0x08)]
//	[1 byte:  number of records]
//	[N bytes: AVL records]
//	[1 byte:  number of records (repeat)]
//	[4 bytes: CRC-16]
func (t *TeltonikaCodec) ParseData(data []byte, deviceID int64) ([]domain.Position, error) {
	if len(data) < 12 {
		return nil, fmt.Errorf("data packet too short: %d bytes", len(data))
	}

	// Skip 4-byte preamble + 4-byte data length
	offset := 8

	codecID := int(data[offset])
	offset++

	if codecID != CODEC8 {
		return nil, fmt.Errorf("unsupported codec: 0x%02X (expected 0x%02X)", codecID, CODEC8)
	}

	recordCount := int(data[offset])
	offset++

	positions := make([]domain.Position, 0, recordCount)

	for i := 0; i < recordCount; i++ {
		pos, bytesRead, err := t.parseAVLRecord(data[offset:], deviceID)
		if err != nil {
			return positions, fmt.Errorf("error parsing record %d: %w", i, err)
		}
		positions = append(positions, pos)
		offset += bytesRead
	}

	return positions, nil
}

// parseAVLRecord decodes a single AVL data record.
// Record format:
//
//	[8 bytes: timestamp (ms since epoch)]
//	[1 byte:  priority]
//	[4 bytes: longitude (signed, * 1e-7)]
//	[4 bytes: latitude  (signed, * 1e-7)]
//	[2 bytes: altitude  (meters)]
//	[2 bytes: heading   (degrees)]
//	[1 byte:  satellites]
//	[2 bytes: speed     (km/h)]
//	[IO elements...]
func (t *TeltonikaCodec) parseAVLRecord(data []byte, deviceID int64) (domain.Position, int, error) {
	pos := domain.Position{DeviceID: deviceID}

	if len(data) < 24 {
		return pos, 0, fmt.Errorf("AVL record too short: %d bytes", len(data))
	}

	offset := 0

	// Timestamp: 8 bytes, milliseconds since Unix epoch
	tsMs := int64(binary.BigEndian.Uint64(data[offset : offset+8]))
	pos.Time = time.UnixMilli(tsMs).UTC()
	offset += 8

	// Priority: 1 byte (skip)
	offset += 1

	// Longitude: 4 bytes signed int32, divide by 10^7
	lngRaw := int32(binary.BigEndian.Uint32(data[offset : offset+4]))
	pos.Longitude = float64(lngRaw) / 1e7
	offset += 4

	// Latitude: 4 bytes signed int32, divide by 10^7
	latRaw := int32(binary.BigEndian.Uint32(data[offset : offset+4]))
	pos.Latitude = float64(latRaw) / 1e7
	offset += 4

	// Altitude: 2 bytes unsigned
	pos.Altitude = float32(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2

	// Heading: 2 bytes unsigned (0-360 degrees)
	pos.Heading = float32(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2

	// Satellites: 1 byte
	pos.Satellites = int16(data[offset])
	offset += 1

	// Speed: 2 bytes unsigned (km/h)
	pos.Speed = float32(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2

	// Parse IO elements
	ioBytes, err := t.parseIOElements(data[offset:], &pos)
	if err != nil {
		return pos, 0, fmt.Errorf("error parsing IO elements: %w", err)
	}
	offset += ioBytes

	return pos, offset, nil
}

// parseIOElements decodes the variable-length IO element section.
// IO format (Codec 8):
//
//	[1 byte: event IO ID]
//	[1 byte: total IO count]
//	[1 byte: 1-byte IO count] [N * {1-byte ID, 1-byte value}]
//	[1 byte: 2-byte IO count] [N * {1-byte ID, 2-byte value}]
//	[1 byte: 4-byte IO count] [N * {1-byte ID, 4-byte value}]
//	[1 byte: 8-byte IO count] [N * {1-byte ID, 8-byte value}]
func (t *TeltonikaCodec) parseIOElements(data []byte, pos *domain.Position) (int, error) {
	if len(data) < 2 {
		return 0, fmt.Errorf("IO data too short")
	}

	offset := 0

	// Event IO ID
	offset += 1

	// Total IO element count
	offset += 1

	// 1-byte value IO elements
	count1 := int(data[offset])
	offset += 1
	for i := 0; i < count1; i++ {
		if offset+2 > len(data) {
			return offset, nil
		}
		ioID := int(data[offset])
		ioVal := int(data[offset+1])
		t.applyIOValue(pos, ioID, int64(ioVal))
		offset += 2
	}

	// 2-byte value IO elements
	if offset >= len(data) {
		return offset, nil
	}
	count2 := int(data[offset])
	offset += 1
	for i := 0; i < count2; i++ {
		if offset+3 > len(data) {
			return offset, nil
		}
		ioID := int(data[offset])
		ioVal := int(binary.BigEndian.Uint16(data[offset+1 : offset+3]))
		t.applyIOValue(pos, ioID, int64(ioVal))
		offset += 3
	}

	// 4-byte value IO elements
	if offset >= len(data) {
		return offset, nil
	}
	count4 := int(data[offset])
	offset += 1
	for i := 0; i < count4; i++ {
		if offset+5 > len(data) {
			return offset, nil
		}
		ioID := int(data[offset])
		ioVal := int(binary.BigEndian.Uint32(data[offset+1 : offset+5]))
		t.applyIOValue(pos, ioID, int64(ioVal))
		offset += 5
	}

	// 8-byte value IO elements
	if offset >= len(data) {
		return offset, nil
	}
	count8 := int(data[offset])
	offset += 1
	for i := 0; i < count8; i++ {
		if offset+9 > len(data) {
			return offset, nil
		}
		ioID := int(data[offset])
		ioVal := int64(binary.BigEndian.Uint64(data[offset+1 : offset+9]))
		t.applyIOValue(pos, ioID, ioVal)
		offset += 9
	}

	return offset, nil
}

// applyIOValue maps a Teltonika IO element to the Position struct fields.
func (t *TeltonikaCodec) applyIOValue(pos *domain.Position, ioID int, value int64) {
	switch ioID {
	case IO_ACC:
		pos.Ignition = value == 1
	case IO_GSM:
		pos.GSMSignal = int16(value)
	case IO_VOLTAGE:
		pos.Voltage = float32(value) / 1000.0 // mV to V
	case IO_TEMPERATURE:
		pos.Temperature = float32(value)
	case IO_ODOMETER:
		pos.Odometer = value
	case IO_RFID:
		pos.RFIDTag = fmt.Sprintf("%d", value)
	}
}

// Acknowledge returns the Teltonika acknowledgment packet.
// The device expects a 4-byte response with the number of accepted records.
func (t *TeltonikaCodec) Acknowledge(count int) []byte {
	ack := make([]byte, 4)
	binary.BigEndian.PutUint32(ack, uint32(count))
	return ack
}

// IMEIAccept is the response sent to accept the device IMEI (0x01).
func IMEIAccept() []byte {
	return []byte{0x01}
}

// IMEIReject is the response sent to reject the device IMEI (0x00).
func IMEIReject() []byte {
	return []byte{0x00}
}

// parseHexBytes is a helper to convert hex string to bytes (for testing).
func parseHexBytes(hexStr string) ([]byte, error) {
	cleaned := strings.ReplaceAll(hexStr, " ", "")
	return hex.DecodeString(cleaned)
}
