package domain

import "testing"

func TestValidatePolygon_OK(t *testing.T) {
	verts := []Point{{0, 0}, {1, 0}, {1, 1}, {0, 1}}
	if err := ValidatePolygon(verts); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}
}

func TestValidatePolygon_TooFew(t *testing.T) {
	verts := []Point{{0, 0}, {1, 0}}
	if err := ValidatePolygon(verts); err != ErrInvalidPolygon {
		t.Fatalf("expected ErrInvalidPolygon, got %v", err)
	}
}

func TestValidatePolygon_SelfIntersect(t *testing.T) {
	verts := []Point{{0, 0}, {2, 2}, {0, 2}, {2, 0}}
	if err := ValidatePolygon(verts); err != ErrInvalidPolygon {
		t.Fatalf("expected ErrInvalidPolygon, got %v", err)
	}
}
