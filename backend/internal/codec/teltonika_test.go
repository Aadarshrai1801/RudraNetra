package codec

import (
	"encoding/binary"
	"encoding/json"
	"sort"
	"testing"
)

// ─── Test packet builders ────────────────────────────────

type ioSet struct {
	oneByte   map[int]int64
	twoByte   map[int]int64
	fourByte  map[int]int64
	eightByte map[int]int64
	xByte     map[int][]byte
}

func newIOSet() ioSet {
	return ioSet{
		oneByte:   map[int]int64{},
		twoByte:   map[int]int64{},
		fourByte:  map[int]int64{},
		eightByte: map[int]int64{},
		xByte:     map[int][]byte{},
	}
}

func sortedKeys(m map[int]int64) []int {
	keys := make([]int, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Ints(keys)
	return keys
}

func appendUint(buf []byte, value int64, width int) []byte {
	switch width {
	case 1:
		return append(buf, byte(value))
	case 2:
		return binary.BigEndian.AppendUint16(buf, uint16(value))
	case 4:
		return binary.BigEndian.AppendUint32(buf, uint32(value))
	case 8:
		return binary.BigEndian.AppendUint64(buf, uint64(value))
	default:
		return buf
	}
}

// gpsPart builds the fixed 24-byte GPS section of an AVL record.
func gpsPart(tsMs int64, lat, lng float64, speed uint16) []byte {
	buf := make([]byte, 24)
	binary.BigEndian.PutUint64(buf[0:8], uint64(tsMs))
	buf[8] = 0 // priority
	binary.BigEndian.PutUint32(buf[9:13], uint32(int32(lng*1e7)))
	binary.BigEndian.PutUint32(buf[13:17], uint32(int32(lat*1e7)))
	binary.BigEndian.PutUint16(buf[17:19], 15) // altitude
	binary.BigEndian.PutUint16(buf[19:21], 90) // heading
	buf[21] = 12                               // satellites
	binary.BigEndian.PutUint16(buf[22:24], speed)
	return buf
}

// codec8Record builds one AVL record with the Codec 8 IO layout (1-byte ids).
func codec8Record(tsMs int64, lat, lng float64, speed uint16, ios ioSet) []byte {
	buf := gpsPart(tsMs, lat, lng, speed)
	buf = append(buf, 0) // event IO id
	total := len(ios.oneByte) + len(ios.twoByte) + len(ios.fourByte) + len(ios.eightByte)
	buf = append(buf, byte(total))

	groups := []struct {
		width int
		m     map[int]int64
	}{{1, ios.oneByte}, {2, ios.twoByte}, {4, ios.fourByte}, {8, ios.eightByte}}
	for _, grp := range groups {
		buf = append(buf, byte(len(grp.m)))
		for _, id := range sortedKeys(grp.m) {
			buf = append(buf, byte(id))
			buf = appendUint(buf, grp.m[id], grp.width)
		}
	}
	return buf
}

// codec8eRecord builds one AVL record with the Codec 8 Extended IO layout
// (2-byte ids and counts plus the variable-length X group).
func codec8eRecord(tsMs int64, lat, lng float64, speed uint16, ios ioSet) []byte {
	buf := gpsPart(tsMs, lat, lng, speed)
	buf = append(buf, 0) // event IO id
	total := len(ios.oneByte) + len(ios.twoByte) + len(ios.fourByte) + len(ios.eightByte) + len(ios.xByte)
	buf = binary.BigEndian.AppendUint16(buf, uint16(total))

	groups := []struct {
		width int
		m     map[int]int64
	}{{1, ios.oneByte}, {2, ios.twoByte}, {4, ios.fourByte}, {8, ios.eightByte}}
	for _, grp := range groups {
		buf = binary.BigEndian.AppendUint16(buf, uint16(len(grp.m)))
		for _, id := range sortedKeys(grp.m) {
			buf = binary.BigEndian.AppendUint16(buf, uint16(id))
			buf = appendUint(buf, grp.m[id], grp.width)
		}
	}

	// X group: id(2) + length(2) + value
	buf = binary.BigEndian.AppendUint16(buf, uint16(len(ios.xByte)))
	xIDs := make([]int, 0, len(ios.xByte))
	for id := range ios.xByte {
		xIDs = append(xIDs, id)
	}
	sort.Ints(xIDs)
	for _, id := range xIDs {
		value := ios.xByte[id]
		buf = binary.BigEndian.AppendUint16(buf, uint16(id))
		buf = binary.BigEndian.AppendUint16(buf, uint16(len(value)))
		buf = append(buf, value...)
	}
	return buf
}

// avlPayload wraps records into a frame payload (codec id .. trailing count).
func avlPayload(codecID byte, records ...[]byte) []byte {
	payload := []byte{codecID, byte(len(records))}
	for _, rec := range records {
		payload = append(payload, rec...)
	}
	return append(payload, byte(len(records)))
}

// frame wraps a payload into a complete TCP frame with a valid CRC.
func frame(payload []byte) []byte {
	buf := make([]byte, framePreambleSize+frameLengthSize+len(payload)+frameCRCSize)
	binary.BigEndian.PutUint32(buf[4:8], uint32(len(payload)))
	copy(buf[8:], payload)
	binary.LittleEndian.PutUint16(buf[8+len(payload):], CRC16(payload))
	return buf
}

func sampleIOSet() ioSet {
	ios := newIOSet()
	ios.oneByte[IO_ACC] = 1
	ios.oneByte[IO_INPUT2] = 1 // door open
	ios.oneByte[IO_IGNITION] = 1
	ios.twoByte[IO_VOLTAGE] = 24150
	ios.twoByte[IO_BATTERY_VOLTAGE] = 3950
	ios.twoByte[IO_TEMPERATURE] = -184 // -18.4 °C
	ios.twoByte[IO_FUEL_LEVEL] = 57
	ios.fourByte[IO_ODOMETER] = 123456
	return ios
}

// ─── IMEI / ACK ──────────────────────────────────────────

func TestParseIMEI(t *testing.T) {
	codec := NewTeltonikaCodec()

	imei := "352093088642068"
	data := make([]byte, 2+len(imei))
	data[1] = byte(len(imei))
	copy(data[2:], []byte(imei))

	result, err := codec.ParseIMEI(data)
	if err != nil {
		t.Fatalf("ParseIMEI failed: %v", err)
	}
	if result != imei {
		t.Errorf("expected IMEI %s, got %s", imei, result)
	}
}

func TestParseIMEI_TooShort(t *testing.T) {
	codec := NewTeltonikaCodec()
	if _, err := codec.ParseIMEI([]byte{0x00}); err == nil {
		t.Error("expected error for short IMEI packet")
	}
}

func TestAcknowledge(t *testing.T) {
	codec := NewTeltonikaCodec()
	ack := codec.Acknowledge(5)
	if len(ack) != 4 || ack[3] != 5 {
		t.Fatalf("expected 4-byte ack with count 5, got %v", ack)
	}
}

func TestIMEIAcceptReject(t *testing.T) {
	if accept := IMEIAccept(); len(accept) != 1 || accept[0] != 0x01 {
		t.Error("IMEIAccept should return [0x01]")
	}
	if reject := IMEIReject(); len(reject) != 1 || reject[0] != 0x00 {
		t.Error("IMEIReject should return [0x00]")
	}
}

// ─── Codec 8 / Codec 8 Extended ──────────────────────────

func TestParseCodec8Frame(t *testing.T) {
	codec := NewTeltonikaCodec()
	ts := int64(1758800000000)
	payload := avlPayload(CODEC8, codec8Record(ts, 25.2048, 55.2708, 64, sampleIOSet()))

	positions, err := codec.ParseFrame(payload, 42)
	if err != nil {
		t.Fatalf("ParseFrame failed: %v", err)
	}
	if len(positions) != 1 {
		t.Fatalf("expected 1 position, got %d", len(positions))
	}

	pos := positions[0]
	if pos.DeviceID != 42 {
		t.Errorf("device id = %d, want 42", pos.DeviceID)
	}
	if pos.Latitude < 25.2047 || pos.Latitude > 25.2049 {
		t.Errorf("latitude = %f", pos.Latitude)
	}
	if pos.Longitude < 55.2707 || pos.Longitude > 55.2709 {
		t.Errorf("longitude = %f", pos.Longitude)
	}
	if pos.Speed != 64 || pos.Heading != 90 || pos.Satellites != 12 {
		t.Errorf("gps fields wrong: speed=%v heading=%v sats=%v", pos.Speed, pos.Heading, pos.Satellites)
	}
	if !pos.Ignition {
		t.Error("ignition should be true for ACC=1")
	}
	if pos.Temperature < -18.5 || pos.Temperature > -18.3 {
		t.Errorf("temperature = %v, want -18.4", pos.Temperature)
	}
	if pos.FuelLevelPct == nil || *pos.FuelLevelPct != 57 {
		t.Errorf("fuel level = %v, want 57", pos.FuelLevelPct)
	}
	if pos.BackupBatteryV == nil || *pos.BackupBatteryV < 3.94 || *pos.BackupBatteryV > 3.96 {
		t.Errorf("backup battery = %v, want ~3.95", pos.BackupBatteryV)
	}
	if pos.DoorOpen == nil || !*pos.DoorOpen {
		t.Errorf("door should be open, got %v", pos.DoorOpen)
	}
	if pos.Voltage < 24.1 || pos.Voltage > 24.2 {
		t.Errorf("voltage = %v, want ~24.15", pos.Voltage)
	}
	if pos.Odometer != 123456 {
		t.Errorf("odometer = %d", pos.Odometer)
	}
	if len(pos.RawData) == 0 {
		t.Error("raw_data should preserve decoded IO elements")
	}
}

func TestParseCodec8ExtendedFrame(t *testing.T) {
	codec := NewTeltonikaCodec()
	ios := sampleIOSet()
	ios.xByte[200] = []byte{0x01, 0x02, 0x03, 0x04}

	payload := avlPayload(CODEC8E, codec8eRecord(1758800000000, 24.8952, 55.1420, 40, ios))

	positions, err := codec.ParseFrame(payload, 7)
	if err != nil {
		t.Fatalf("ParseFrame (8E) failed: %v", err)
	}
	if len(positions) != 1 {
		t.Fatalf("expected 1 position, got %d", len(positions))
	}
	pos := positions[0]
	if pos.FuelLevelPct == nil || *pos.FuelLevelPct != 57 {
		t.Errorf("fuel level = %v, want 57", pos.FuelLevelPct)
	}
	if pos.Temperature < -18.5 || pos.Temperature > -18.3 {
		t.Errorf("temperature = %v, want -18.4", pos.Temperature)
	}
	if pos.BackupBatteryV == nil || *pos.BackupBatteryV < 3.94 {
		t.Errorf("backup battery = %v", pos.BackupBatteryV)
	}
	// The X-group element must be preserved in raw_data.
	if len(pos.RawData) == 0 {
		t.Fatal("raw_data empty")
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(pos.RawData, &raw); err != nil {
		t.Fatalf("raw_data is not valid JSON: %v", err)
	}
	if got, ok := raw["200"]; !ok || got != "01020304" {
		t.Errorf("X-group element missing from raw_data: %v", raw["200"])
	}
}

func TestParseFrameZeroRecords(t *testing.T) {
	codec := NewTeltonikaCodec()
	positions, err := codec.ParseFrame([]byte{CODEC8, 0, 0}, 1)
	if err != nil {
		t.Fatalf("zero-record frame should be valid (keepalive): %v", err)
	}
	if len(positions) != 0 {
		t.Fatalf("expected 0 positions, got %d", len(positions))
	}
}

func TestParseFrameUnsupportedCodec16(t *testing.T) {
	codec := NewTeltonikaCodec()
	if _, err := codec.ParseFrame([]byte{CODEC16, 0, 0}, 1); err == nil {
		t.Error("expected an explicit unsupported-codec error for Codec 16")
	}
}

func TestParseDataAcceptsWholeFrame(t *testing.T) {
	codec := NewTeltonikaCodec()
	payload := avlPayload(CODEC8, codec8Record(1758800000000, 25.0, 55.0, 10, sampleIOSet()))
	positions, err := codec.ParseData(frame(payload), 5)
	if err != nil {
		t.Fatalf("ParseData failed: %v", err)
	}
	if len(positions) != 1 {
		t.Fatalf("expected 1 position, got %d", len(positions))
	}
}

// ─── Stream framing ──────────────────────────────────────

func TestStreamFramerFragmentedReads(t *testing.T) {
	payload := avlPayload(CODEC8, codec8Record(1758800000000, 25.0, 55.0, 10, sampleIOSet()))
	raw := frame(payload)

	framer := NewStreamFramer()
	for i, b := range raw {
		framer.Append([]byte{b})
		got, ok, err := framer.Next()
		if err != nil {
			t.Fatalf("unexpected resync error at byte %d: %v", i, err)
		}
		if ok {
			if i != len(raw)-1 {
				t.Fatalf("frame reported complete at byte %d of %d", i, len(raw))
			}
			if string(got.Payload) != string(payload) {
				t.Fatal("payload mismatch")
			}
			return
		}
	}
	t.Fatal("framed packet never completed")
}

func TestStreamFramerCoalescedFramesAndBurst(t *testing.T) {
	ts := int64(1758800000000)
	first := frame(avlPayload(CODEC8, codec8Record(ts, 25.0, 55.0, 10, sampleIOSet())))
	second := frame(avlPayload(CODEC8E, codec8eRecord(ts+1000, 25.1, 55.1, 20, sampleIOSet())))
	burst := frame(avlPayload(CODEC8,
		codec8Record(ts+2000, 25.2, 55.2, 30, sampleIOSet()),
		codec8Record(ts+3000, 25.3, 55.3, 40, sampleIOSet()),
		codec8Record(ts+4000, 25.4, 55.4, 50, sampleIOSet()),
	))

	stream := append(append(append([]byte{}, first...), second...), burst...)

	framer := NewStreamFramer()
	framer.Append(stream)

	counts := []int{}
	for {
		got, ok, err := framer.Next()
		if err != nil {
			t.Fatalf("unexpected resync error: %v", err)
		}
		if !ok {
			break
		}
		positions, err := NewTeltonikaCodec().ParseFrame(got.Payload, 1)
		if err != nil {
			t.Fatalf("failed to parse reassembled frame: %v", err)
		}
		counts = append(counts, len(positions))
	}

	if len(counts) != 3 {
		t.Fatalf("expected 3 frames, got %d", len(counts))
	}
	if counts[0] != 1 || counts[1] != 1 || counts[2] != 3 {
		t.Fatalf("unexpected record counts: %v", counts)
	}
	if framer.Buffered() != 0 {
		t.Fatalf("framer should be drained, %d bytes left", framer.Buffered())
	}
}

func TestStreamFramerResyncsAfterGarbage(t *testing.T) {
	payload := avlPayload(CODEC8, codec8Record(1758800000000, 25.0, 55.0, 10, sampleIOSet()))
	stream := append([]byte{0x13, 0x37, 0xAB}, frame(payload)...)

	framer := NewStreamFramer()
	framer.Append(stream)

	got, ok, err := framer.Next()
	if err != nil {
		t.Fatalf("resync should not be fatal: %v", err)
	}
	if !ok || string(got.Payload) != string(payload) {
		t.Fatal("failed to recover the valid frame after garbage")
	}
}

func TestStreamFramerResyncsAfterInvalidLength(t *testing.T) {
	payload := avlPayload(CODEC8, codec8Record(1758800000000, 25.0, 55.0, 10, sampleIOSet()))
	bad := []byte{0, 0, 0, 0, 0xFF, 0xFF, 0xFF, 0xFF}
	stream := append(bad, frame(payload)...)

	framer := NewStreamFramer()
	framer.Append(stream)

	got, ok, err := framer.Next()
	if err == nil {
		t.Error("expected a reported resync for the invalid length")
	}
	if !ok || string(got.Payload) != string(payload) {
		t.Fatal("failed to recover the valid frame after an invalid length")
	}
}

// ─── CRC / Codec 12 ──────────────────────────────────────

func TestCRC16Vector(t *testing.T) {
	if got := CRC16([]byte("123456789")); got != 0xBB3D {
		t.Fatalf("CRC16 vector = 0x%04X, want 0xBB3D", got)
	}
}

func TestFrameCRCValidation(t *testing.T) {
	payload := avlPayload(CODEC8, codec8Record(1758800000000, 25.0, 55.0, 10, sampleIOSet()))
	raw := frame(payload)

	framer := NewStreamFramer()
	framer.Append(raw)
	got, ok, err := framer.Next()
	if err != nil || !ok {
		t.Fatalf("frame not decoded: ok=%v err=%v", ok, err)
	}
	if !got.CRCValid() {
		t.Error("valid frame failed CRC validation")
	}

	got.CRC = []byte{0, 0, 0, 0}
	if got.CRCValid() {
		t.Error("zero CRC should not validate")
	}
}

func TestBuildCommandFrameRoundTrip(t *testing.T) {
	raw := BuildCommandFrame("setdigout 0")

	framer := NewStreamFramer()
	framer.Append(raw)
	got, ok, err := framer.Next()
	if err != nil || !ok {
		t.Fatalf("command frame not decoded: ok=%v err=%v", ok, err)
	}
	if !got.CRCValid() {
		t.Error("command frame has an invalid CRC")
	}
	if got.Payload[0] != CODEC12 {
		t.Fatalf("codec id = 0x%02X, want 0x%02X", got.Payload[0], CODEC12)
	}

	responses, err := ParseCommandPayload(got.Payload)
	if err != nil {
		t.Fatalf("ParseCommandPayload failed: %v", err)
	}
	if len(responses) != 1 || responses[0] != "setdigout 0" {
		t.Fatalf("responses = %v", responses)
	}
}
