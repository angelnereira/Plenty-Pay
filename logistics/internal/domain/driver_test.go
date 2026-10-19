package domain

import "testing"

func TestDriver_Validate_OK(t *testing.T) {
	d := Driver{TenantID: "t1", UserID: "u1", VehicleKind: "MOTORCYCLE", VehiclePlate: "ABC-123", EmploymentKind: "EMPLOYEE"}
	if err := d.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestDriver_Validate_NoPlate(t *testing.T) {
	d := Driver{TenantID: "t1", UserID: "u1", VehicleKind: "MOTORCYCLE", EmploymentKind: "EMPLOYEE"}
	if err := d.Validate(); err != ErrInvalidDriver {
		t.Fatalf("expected ErrInvalidDriver, got %v", err)
	}
}

func TestDriver_Validate_BicycleNoPlate(t *testing.T) {
	d := Driver{TenantID: "t1", UserID: "u1", VehicleKind: "BICYCLE", EmploymentKind: "CONTRACTOR"}
	if err := d.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestDelivery_AssignPickUpTransitArriveDeliver(t *testing.T) {
	d := Delivery{ID: "d1", TenantID: "t1", Status: DeliveryPending}
	if err := d.Assign("drv1"); err != nil {
		t.Fatalf("assign: %v", err)
	}
	if err := d.PickUp(); err != nil {
		t.Fatalf("pickup: %v", err)
	}
	if err := d.StartTransit(); err != nil {
		t.Fatalf("transit: %v", err)
	}
	if err := d.Arrive(); err != nil {
		t.Fatalf("arrive: %v", err)
	}
	if err := d.Deliver(); err != nil {
		t.Fatalf("deliver: %v", err)
	}
	if d.Status != DeliveryDelivered {
		t.Fatalf("expected DELIVERED, got %s", d.Status)
	}
}

func TestDelivery_Fail(t *testing.T) {
	d := Delivery{ID: "d2", TenantID: "t1", Status: DeliveryInTransit}
	if err := d.Fail(); err != nil {
		t.Fatalf("fail: %v", err)
	}
	if d.Status != DeliveryFailed {
		t.Fatalf("expected FAILED, got %s", d.Status)
	}
	if d.AttemptNumber != 1 {
		t.Fatalf("expected attempt 1, got %d", d.AttemptNumber)
	}
}

func TestDelivery_InvalidTransition(t *testing.T) {
	d := Delivery{ID: "d3", TenantID: "t1", Status: DeliveryDelivered}
	if err := d.Assign("drv1"); err == nil {
		t.Fatal("expected error")
	}
}

func TestNearestDriver_OK(t *testing.T) {
	cands := []DriverCandidate{
		{DriverID: "d1", Distance: 500, Active: true, DocsValid: true},
		{DriverID: "d2", Distance: 200, Active: true, DocsValid: true},
		{DriverID: "d3", Distance: 100, Active: false, DocsValid: true},
	}
	id, ok := NearestDriver(cands)
	if !ok || id != "d2" {
		t.Fatalf("expected d2, got %s, %v", id, ok)
	}
}

func TestNearestDriver_None(t *testing.T) {
	cands := []DriverCandidate{
		{DriverID: "d1", Distance: 100, Active: false, DocsValid: true},
	}
	_, ok := NearestDriver(cands)
	if ok {
		t.Fatal("expected none")
	}
}

func TestProofOfDelivery_Validate_CodeOK(t *testing.T) {
	p := ProofOfDelivery{Code: "123456", AgeRestricted: false}
	if err := p.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestProofOfDelivery_Validate_AgeRequired(t *testing.T) {
	p := ProofOfDelivery{Code: "123456", AgeRestricted: true, AgeVerified: false}
	if err := p.Validate(); err == nil {
		t.Fatal("expected error")
	}
}

func TestProofOfDelivery_Validate_NoProof(t *testing.T) {
	p := ProofOfDelivery{}
	if err := p.Validate(); err == nil {
		t.Fatal("expected error")
	}
}
