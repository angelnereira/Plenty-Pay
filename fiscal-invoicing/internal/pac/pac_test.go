package pac

import (
	"context"
	"strings"
	"testing"
)

func TestSimulator_Issue(t *testing.T) {
	s := Simulator{}
	cufe, qr, err := s.Issue(context.Background(), []byte("<xml/>"))
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !strings.HasPrefix(cufe, "SIMULATED-CUFE-") {
		t.Fatalf("bad cufe: %s", cufe)
	}
	if qr == "" {
		t.Fatal("empty qr url")
	}
}

func TestSimulator_GetStatus(t *testing.T) {
	s := Simulator{}
	st, err := s.GetStatus(context.Background(), "any")
	if err != nil || st != "ACCEPTED" {
		t.Fatalf("got %s, %v", st, err)
	}
}
