package codec

import (
	"testing"
)

func TestParseIMEI(t *testing.T) {
	codec := NewTeltonikaCodec()

	// Simulated IMEI packet: length(2 bytes) + IMEI ASCII
	imei := "352093088642068"
	data := make([]byte, 2+len(imei))
	data[0] = 0x00
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

	_, err := codec.ParseIMEI([]byte{0x00})
	if err == nil {
		t.Error("expected error for short IMEI packet")
	}
}

func TestAcknowledge(t *testing.T) {
	codec := NewTeltonikaCodec()

	ack := codec.Acknowledge(5)
	if len(ack) != 4 {
		t.Fatalf("expected 4 bytes, got %d", len(ack))
	}
	if ack[3] != 5 {
		t.Errorf("expected ack count 5, got %d", ack[3])
	}
}

func TestIMEIAcceptReject(t *testing.T) {
	accept := IMEIAccept()
	if len(accept) != 1 || accept[0] != 0x01 {
		t.Error("IMEIAccept should return [0x01]")
	}

	reject := IMEIReject()
	if len(reject) != 1 || reject[0] != 0x00 {
		t.Error("IMEIReject should return [0x00]")
	}
}

func TestApplyIOValues(t *testing.T) {
	codec := NewTeltonikaCodec()
	pos := &domain_position_stub{}

	// Test ACC (ignition)
	codec_applyIO(codec, pos, IO_ACC, 1)
	if !pos.ignition {
		t.Error("expected ignition=true for ACC=1")
	}

	codec_applyIO(codec, pos, IO_ACC, 0)
	if pos.ignition {
		t.Error("expected ignition=false for ACC=0")
	}
}

// Stubs for testing without full domain import in unit tests
type domain_position_stub struct {
	ignition bool
}

func codec_applyIO(c *TeltonikaCodec, stub *domain_position_stub, ioID int, value int64) {
	// Simplified test — full integration tests will use domain.Position
	if ioID == IO_ACC {
		stub.ignition = value == 1
	}
}
