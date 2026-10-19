package domain

import "errors"

var ErrInvalidDriver = errors.New("invalid driver")

type Driver struct {
	ID             string
	TenantID       string
	UserID         string
	CarrierID      string
	VehicleKind    string
	VehiclePlate   string
	LicenseNumber  string
	EmploymentKind string
	Active         bool
}

func (d Driver) Validate() error {
	if d.TenantID == "" || d.UserID == "" {
		return ErrInvalidDriver
	}
	if d.VehicleKind == "" {
		return ErrInvalidDriver
	}
	if d.EmploymentKind != "EMPLOYEE" && d.EmploymentKind != "CONTRACTOR" {
		return ErrInvalidDriver
	}
	// vehicles with motor require plate
	motorVehicles := map[string]bool{"MOTORCYCLE": true, "CAR": true, "VAN": true, "TRUCK": true}
	if motorVehicles[d.VehicleKind] && d.VehiclePlate == "" {
		return ErrInvalidDriver
	}
	return nil
}

// DeliveryStatus per domain-model.md §8.11.
type DeliveryStatus int

const (
	DeliveryPending DeliveryStatus = iota + 1
	DeliveryAssigned
	DeliveryPickedUp
	DeliveryInTransit
	DeliveryArrived
	DeliveryDelivered
	DeliveryFailed
	DeliveryCancelled
)

func (s DeliveryStatus) String() string {
	names := []string{"", "PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "DELIVERED", "FAILED", "CANCELLED"}
	if int(s) < len(names) {
		return names[s]
	}
	return "UNKNOWN"
}

// Delivery represents a delivery.
type Delivery struct {
	ID             string
	TenantID       string
	Status         DeliveryStatus
	DriverID       string
	AgeRestricted  bool
	AttemptNumber  int
}

func (d *Delivery) Assign(driverID string) error {
	if d.Status != DeliveryPending {
		return errors.New("invalid state transition")
	}
	d.DriverID = driverID
	d.Status = DeliveryAssigned
	return nil
}

func (d *Delivery) PickUp() error {
	if d.Status != DeliveryAssigned {
		return errors.New("invalid state transition")
	}
	d.Status = DeliveryPickedUp
	return nil
}

func (d *Delivery) StartTransit() error {
	if d.Status != DeliveryPickedUp {
		return errors.New("invalid state transition")
	}
	d.Status = DeliveryInTransit
	return nil
}

func (d *Delivery) Arrive() error {
	if d.Status != DeliveryInTransit {
		return errors.New("invalid state transition")
	}
	d.Status = DeliveryArrived
	return nil
}

func (d *Delivery) Deliver() error {
	if d.Status != DeliveryArrived {
		return errors.New("invalid state transition")
	}
	d.Status = DeliveryDelivered
	return nil
}

func (d *Delivery) Fail() error {
	if d.Status != DeliveryArrived && d.Status != DeliveryInTransit {
		return errors.New("invalid state transition")
	}
	d.AttemptNumber++
	d.Status = DeliveryFailed
	return nil
}

// DriverCandidate for nearest assignment.
type DriverCandidate struct {
	DriverID string
	Distance float64
	Active   bool
	DocsValid bool
}

// NearestDriver selects the active driver with valid docs closest to the origin.
func NearestDriver(candidates []DriverCandidate) (string, bool) {
	var best string
	var bestDist float64
	found := false
	for _, c := range candidates {
		if !c.Active || !c.DocsValid {
			continue
		}
		if !found || c.Distance < bestDist {
			best = c.DriverID
			bestDist = c.Distance
			found = true
		}
	}
	return best, found
}

// ProofOfDelivery validates delivery proof.
type ProofOfDelivery struct {
	Code            string
	ReceivedByName  string
	AgeVerified     bool
	RecipientBirthDate string
	AgeRestricted   bool
}

func (p ProofOfDelivery) Validate() error {
	if p.Code == "" && p.ReceivedByName == "" {
		return errors.New("proof required")
	}
	if p.AgeRestricted && !p.AgeVerified {
		return errors.New("age verification required")
	}
	return nil
}
