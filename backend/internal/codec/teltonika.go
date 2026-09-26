// Package codec implements GPS device protocol decoders.
// Supports Teltonika Codec 8 (0x08) and Codec 8 Extended (0x8E) AVL data,
// plus Codec 12 (0x0C) GPRS command/response frames.
package codec

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/rudra-netra/backend/internal/domain"
)

// Teltonika IO element IDs — matches constants from legacy Teltonika.cs
const (
	IO_ACC              = 1
	IO_INPUT2           = 2 // DIN2 (door contact in this fleet)
	IO_INPUT3           = 3
	IO_ANALOG           = 4
	IO_GSM              = 5
	IO_SPEED            = 6
	IO_VOLTAGE          = 7
	IO_GPSPOWER         = 8
	IO_ODOMETER         = 16
	IO_STOP             = 20
	IO_TRIP             = 28
	IO_IMMOBILIZER      = 29
	IO_AUTHORIZED       = 30
	IO_OVERSPEED        = 33
	IO_OUTPUT3          = 50
	IO_EXTERNAL_VOLTAGE = 66
	IO_BATTERY_VOLTAGE  = 67
	IO_TEMPERATURE      = 72
	IO_OUTPUT1          = 179
	IO_OUTPUT2          = 180
	IO_RFID             = 207
	IO_IGNITION         = 239
	IO_GREEDRIVING      = 253
	IO_FUEL_LEVEL       = 84

	CODEC8  = 0x08
	CODEC8E = 0x8E
	CODEC12 = 0x0C
	CODEC16 = 0x10
)

// Codec defines the interface for GPS device protocol decoders.
type Codec interface {
	// ParseIMEI extracts the IMEI from the initial handshake bytes.
	ParseIMEI(data []byte) (string, error)
	// ParseData decodes a complete data packet into Position records.
	ParseData(data []byte, deviceID int64) ([]domain.Position, error)
	// Acknowledge returns the acknowledgment bytes to send back to the device.
	Acknowledge(count int) []byte
}

// TeltonikaCodec decodes Teltonika Codec 8 / Codec 8 Extended protocol.
type TeltonikaCodec struct{}

// NewTeltonikaCodec creates a new Teltonika protocol decoder.
func NewTeltonikaCodec() *TeltonikaCodec {
	return &TeltonikaCodec{}
}

// KnownCodec reports whether the codec id is handled or recognised.
func KnownCodec(id byte) bool {
	switch id {
	case CODEC8, CODEC8E, CODEC12, CODEC16:
		return true
	default:
		return false
	}
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

// ParseFrame decodes one AVL frame payload (codec id through the trailing
// record count) into Position records. Codec 8 and Codec 8 Extended are
// supported; a frame with zero records (device keepalive) returns no rows.
func (t *TeltonikaCodec) ParseFrame(payload []byte, deviceID int64) ([]domain.Position, error) {
	if len(payload) < 2 {
		return nil, fmt.Errorf("frame payload too short: %d bytes", len(payload))
	}

	switch payload[0] {
	case CODEC8:
		return t.parseRecords(payload[1:], deviceID, false)
	case CODEC8E:
		return t.parseRecords(payload[1:], deviceID, true)
	case CODEC16:
		return nil, fmt.Errorf("codec 0x%02X (Codec 16) is not supported yet", payload[0])
	default:
		return nil, fmt.Errorf("unsupported codec: 0x%02X", payload[0])
	}
}

// ParseData decodes a complete framed packet (preamble + length + data + CRC).
// Kept for callers that already have one whole frame in memory.
func (t *TeltonikaCodec) ParseData(data []byte, deviceID int64) ([]domain.Position, error) {
	if len(data) < framePreambleSize+frameLengthSize {
		return nil, fmt.Errorf("data packet too short: %d bytes", len(data))
	}
	if !(data[0] == 0 && data[1] == 0 && data[2] == 0 && data[3] == 0) {
		return nil, fmt.Errorf("invalid frame preamble")
	}
	dataLen := int(binary.BigEndian.Uint32(data[4:8]))
	if dataLen <= 0 || framePreambleSize+frameLengthSize+dataLen > len(data) {
		return nil, fmt.Errorf("invalid AVL data length %d", dataLen)
	}
	return t.ParseFrame(data[framePreambleSize+frameLengthSize:framePreambleSize+frameLengthSize+dataLen], deviceID)
}

// parseRecords decodes a record array. extended selects the Codec 8 Extended
// IO layout (2-byte ids and counts, plus variable-length X elements).
func (t *TeltonikaCodec) parseRecords(data []byte, deviceID int64, extended bool) ([]domain.Position, error) {
	if len(data) < 1 {
		return nil, fmt.Errorf("missing record count")
	}
	recordCount := int(data[0])
	offset := 1

	positions := make([]domain.Position, 0, recordCount)
	for i := 0; i < recordCount; i++ {
		pos, bytesRead, err := t.parseAVLRecord(data[offset:], deviceID, extended)
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
func (t *TeltonikaCodec) parseAVLRecord(data []byte, deviceID int64, extended bool) (domain.Position, int, error) {
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
	offset++

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
	offset++

	// Speed: 2 bytes unsigned (km/h)
	pos.Speed = float32(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2

	// IO elements (all decoded elements are preserved in raw_data)
	raw := map[string]interface{}{}
	ioBytes, err := t.parseIOElements(data[offset:], &pos, raw, extended)
	if err != nil {
		return pos, 0, fmt.Errorf("error parsing IO elements: %w", err)
	}
	offset += ioBytes

	if len(raw) > 0 {
		if encoded, err := json.Marshal(raw); err == nil {
			pos.RawData = encoded
		}
	}

	return pos, offset, nil
}

// parseIOElements decodes the variable-length IO element section.
//
// Codec 8:
//
//	[1 byte: event IO ID][1 byte: total IO count]
//	For each width in {1,2,4,8}: [1 byte count] then count × [1 byte id, width bytes value]
//
// Codec 8 Extended:
//
//	[1 byte: event IO ID][2 bytes: total IO count]
//	For each width in {1,2,4,8}: [2 byte count] then count × [2 byte id, width bytes value]
//	[X group: 2 byte count] then count × [2 byte id, 2 byte length, length bytes value]
func (t *TeltonikaCodec) parseIOElements(data []byte, pos *domain.Position, raw map[string]interface{}, extended bool) (int, error) {
	if extended {
		return t.parseIOElementsExtended(data, pos, raw)
	}
	return t.parseIOElementsCodec8(data, pos, raw)
}

func (t *TeltonikaCodec) parseIOElementsCodec8(data []byte, pos *domain.Position, raw map[string]interface{}) (int, error) {
	offset := 0
	if len(data) < 2 {
		return 0, fmt.Errorf("IO data too short")
	}
	offset += 2 // event IO id + total IO count

	for _, width := range []int{1, 2, 4, 8} {
		if offset >= len(data) {
			// Devices occasionally omit trailing empty groups.
			return offset, nil
		}
		count := int(data[offset])
		offset++
		for i := 0; i < count; i++ {
			if offset+1+width > len(data) {
				return offset, fmt.Errorf("truncated %d-byte IO element", width)
			}
			ioID := int(data[offset])
			offset++
			value := readUnsigned(data[offset:offset+width], width)
			offset += width
			t.recordIO(pos, raw, ioID, value)
		}
	}

	return offset, nil
}

func (t *TeltonikaCodec) parseIOElementsExtended(data []byte, pos *domain.Position, raw map[string]interface{}) (int, error) {
	offset := 0
	if len(data) < 3 {
		return 0, fmt.Errorf("IO data too short")
	}
	offset++    // event IO id
	offset += 2 // total IO count (2 bytes in Codec 8 Extended)

	for _, width := range []int{1, 2, 4, 8} {
		if offset+2 > len(data) {
			return offset, nil
		}
		count := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		offset += 2
		for i := 0; i < count; i++ {
			if offset+2+width > len(data) {
				return offset, fmt.Errorf("truncated %d-byte IO element", width)
			}
			ioID := int(binary.BigEndian.Uint16(data[offset : offset+2]))
			offset += 2
			value := readUnsigned(data[offset:offset+width], width)
			offset += width
			t.recordIO(pos, raw, ioID, value)
		}
	}

	// Variable-length X group
	if offset+2 > len(data) {
		return offset, nil
	}
	count := int(binary.BigEndian.Uint16(data[offset : offset+2]))
	offset += 2
	for i := 0; i < count; i++ {
		if offset+4 > len(data) {
			return offset, fmt.Errorf("truncated X-group header")
		}
		ioID := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		offset += 2
		length := int(binary.BigEndian.Uint16(data[offset : offset+2]))
		offset += 2
		if length < 0 || offset+length > len(data) {
			return offset, fmt.Errorf("truncated X-group value")
		}
		raw[fmt.Sprintf("%d", ioID)] = hex.EncodeToString(data[offset : offset+length])
		offset += length
	}

	return offset, nil
}

// recordIO stores every element in raw_data and maps the known AVL IDs onto
// typed Position fields.
func (t *TeltonikaCodec) recordIO(pos *domain.Position, raw map[string]interface{}, ioID int, value int64) {
	raw[fmt.Sprintf("%d", ioID)] = value
	t.applyIOValue(pos, ioID, value)
}

// applyIOValue maps a Teltonika IO element to the Position struct fields.
// Values not listed here remain available in raw_data.
func (t *TeltonikaCodec) applyIOValue(pos *domain.Position, ioID int, value int64) {
	switch ioID {
	case IO_ACC, IO_IGNITION:
		pos.Ignition = value == 1
	case IO_INPUT2:
		door := value == 1
		pos.DoorOpen = &door
	case IO_GSM:
		pos.GSMSignal = int16(value)
	case IO_VOLTAGE, IO_EXTERNAL_VOLTAGE:
		if pos.Voltage == 0 {
			pos.Voltage = float32(value) / 1000.0 // mV to V
		}
	case IO_BATTERY_VOLTAGE:
		volts := float64(value) / 1000.0 // mV to V
		pos.BackupBatteryV = &volts
	case IO_TEMPERATURE:
		// Signed 16-bit value scaled by 0.1 (e.g. -184 -> -18.4 °C)
		pos.Temperature = float32(int16(value)) * 0.1
	case IO_ODOMETER:
		pos.Odometer = value
	case IO_RFID:
		pos.RFIDTag = fmt.Sprintf("%d", value)
	case IO_FUEL_LEVEL:
		pct := float64(value)
		pos.FuelLevelPct = &pct
	}
}

// readUnsigned reads a big-endian unsigned integer of 1, 2, 4 or 8 bytes.
func readUnsigned(data []byte, width int) int64 {
	switch width {
	case 1:
		return int64(data[0])
	case 2:
		return int64(binary.BigEndian.Uint16(data[:2]))
	case 4:
		return int64(binary.BigEndian.Uint32(data[:4]))
	case 8:
		return int64(binary.BigEndian.Uint64(data[:8]))
	default:
		return 0
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

// BuildCommandFrame wraps a GPRS command in a Codec 12 frame:
// [preamble][data length][0x0C][quantity 1][command size][command][quantity 2][CRC]
func BuildCommandFrame(command string) []byte {
	cmd := []byte(command)
	dataLen := 1 + 1 + 4 + len(cmd) + 1

	frame := make([]byte, framePreambleSize+frameLengthSize+dataLen+frameCRCSize)
	binary.BigEndian.PutUint32(frame[0:4], 0)
	binary.BigEndian.PutUint32(frame[4:8], uint32(dataLen))

	offset := framePreambleSize + frameLengthSize
	frame[offset] = CODEC12
	frame[offset+1] = 1 // command quantity 1
	offset += 2
	binary.BigEndian.PutUint32(frame[offset:offset+4], uint32(len(cmd)))
	offset += 4
	copy(frame[offset:], cmd)
	offset += len(cmd)
	frame[offset] = 1 // command quantity 2

	crc := CRC16(frame[framePreambleSize+frameLengthSize : framePreambleSize+frameLengthSize+dataLen])
	binary.LittleEndian.PutUint16(frame[framePreambleSize+frameLengthSize+dataLen:], crc)
	return frame
}

// ParseCommandPayload decodes a Codec 12 payload into its command/response
// strings (a device may reply with several entries).
func ParseCommandPayload(payload []byte) ([]string, error) {
	if len(payload) < 2 {
		return nil, fmt.Errorf("command payload too short")
	}
	if payload[0] != CODEC12 {
		return nil, fmt.Errorf("not a Codec 12 payload: 0x%02X", payload[0])
	}

	offset := 1
	quantity := int(payload[offset])
	offset++

	out := make([]string, 0, quantity)
	for i := 0; i < quantity; i++ {
		if offset+4 > len(payload) {
			return out, fmt.Errorf("truncated command/response size")
		}
		size := int(binary.BigEndian.Uint32(payload[offset : offset+4]))
		offset += 4
		if size <= 0 || offset+size > len(payload) {
			return out, fmt.Errorf("invalid command/response size %d", size)
		}
		out = append(out, string(payload[offset:offset+size]))
		offset += size
	}

	return out, nil
}
