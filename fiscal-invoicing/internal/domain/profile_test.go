package domain

import "testing"

func TestFiscalProfile_Validate_OK(t *testing.T) {
	p := FiscalProfile{RUC: "123", DV: "45", LegalName: "Acme", PACProvider: "hka", PACCredentialsSecret: "sec", Environment: "TEST"}
	if err := p.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestFiscalProfile_Validate_Missing(t *testing.T) {
	p := FiscalProfile{RUC: "123", DV: "45", LegalName: "Acme"}
	if err := p.Validate(); err != ErrProfileMissing {
		t.Fatalf("expected ErrProfileMissing, got %v", err)
	}
}
