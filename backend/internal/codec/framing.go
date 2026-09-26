package codec

import (
	"encoding/binary"
	"fmt"
)

const (
	framePreambleSize = 4
	frameLengthSize   = 4
	frameCRCSize      = 4
	frameMaxDataLen   = 1 << 20 // 1 MiB safety cap for buffered bursts
)

// Frame is one complete Teltonika TCP frame.
type Frame struct {
	// Payload is the frame data: codec id, record counts and records.
	Payload []byte
	// CRC is the 4-byte checksum field exactly as received.
	CRC []byte
}

// CRC16 computes the CRC-16/ARC checksum used by Teltonika devices.
func CRC16(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ 0xA001
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}

// CRCValid reports whether the frame checksum matches its payload. Teltonika
// transmits the 16-bit CRC inside a 4-byte field; device families differ in
// byte order, so the common layouts are accepted.
func (f *Frame) CRCValid() bool {
	if len(f.CRC) < 4 || len(f.Payload) == 0 {
		return false
	}
	want := CRC16(f.Payload)
	return want == binary.LittleEndian.Uint16(f.CRC[0:2]) ||
		want == binary.BigEndian.Uint16(f.CRC[2:4])
}

// StreamFramer reassembles Teltonika frames from a TCP byte stream. It handles
// fragmented reads, multiple frames per read and buffered bursts, and
// resynchronises on the 4-byte zero preamble when the stream is corrupted.
type StreamFramer struct {
	buf []byte
}

// NewStreamFramer creates an empty framer.
func NewStreamFramer() *StreamFramer { return &StreamFramer{} }

// Append adds bytes received from the socket.
func (f *StreamFramer) Append(data []byte) { f.buf = append(f.buf, data...) }

// Buffered returns the number of bytes waiting for a complete frame.
func (f *StreamFramer) Buffered() int { return len(f.buf) }

// Reset drops all buffered bytes (used when a device reconnects).
func (f *StreamFramer) Reset() { f.buf = f.buf[:0] }

// Next returns the next complete frame. ok is false when more data is needed.
// A non-nil error reports a resynchronisation (invalid length or unknown codec
// id); the framer has already recovered and the caller may keep reading.
func (f *StreamFramer) Next() (*Frame, bool, error) {
	var lastErr error
	for {
		idx := -1
		for i := 0; i+framePreambleSize <= len(f.buf); i++ {
			if f.buf[i] == 0 && f.buf[i+1] == 0 && f.buf[i+2] == 0 && f.buf[i+3] == 0 {
				idx = i
				break
			}
		}
		if idx < 0 {
			// Keep the last 3 bytes: a preamble may be split across reads.
			if len(f.buf) > framePreambleSize-1 {
				f.buf = f.buf[len(f.buf)-(framePreambleSize-1):]
			}
			return nil, false, lastErr
		}
		if idx > 0 {
			f.buf = f.buf[idx:]
		}
		if len(f.buf) < framePreambleSize+frameLengthSize {
			return nil, false, lastErr
		}

		dataLen := int(binary.BigEndian.Uint32(f.buf[4:8]))
		if dataLen <= 0 || dataLen > frameMaxDataLen {
			f.buf = f.buf[1:]
			lastErr = fmt.Errorf("invalid teltonika frame length %d", dataLen)
			continue
		}

		total := framePreambleSize + frameLengthSize + dataLen + frameCRCSize
		if len(f.buf) < total {
			return nil, false, lastErr
		}

		payload := make([]byte, dataLen)
		copy(payload, f.buf[framePreambleSize+frameLengthSize:framePreambleSize+frameLengthSize+dataLen])

		if !KnownCodec(payload[0]) {
			// Not a frame boundary: drop one byte and resynchronise.
			f.buf = f.buf[1:]
			lastErr = fmt.Errorf("unknown codec id 0x%02X, resynchronising", payload[0])
			continue
		}

		crc := make([]byte, frameCRCSize)
		copy(crc, f.buf[framePreambleSize+frameLengthSize+dataLen:total])
		f.buf = f.buf[total:]

		return &Frame{Payload: payload, CRC: crc}, true, lastErr
	}
}
