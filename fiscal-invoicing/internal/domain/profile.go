package domain

import "errors"

var ErrProfileMissing = errors.New("profile missing")

type FiscalProfile struct {
	TenantID            string
	RUC                 string
	DV                  string
	LegalName           string
	BranchCode          string
	PointOfSaleCode     string
	PACProvider         string
	PACCredentialsSecret string // nombre del secreto en security, nunca el valor
	CheckoutPreference  int
	AutoThresholdMinor  int64
	Environment         string
}

func (p FiscalProfile) Validate() error {
	if p.RUC == "" || p.DV == "" || p.LegalName == "" {
		return ErrProfileMissing
	}
	if p.PACProvider == "" || p.PACCredentialsSecret == "" {
		return ErrProfileMissing
	}
	if p.Environment != "TEST" && p.Environment != "PRODUCTION" {
		return ErrProfileMissing
	}
	return nil
}
