package domain

import "errors"

var ErrInvalidPolygon = errors.New("invalid polygon")

// Point is a lat/lon pair.
type Point struct {
	Lat float64
	Lon float64
}

// ValidatePolygon checks 3-100 vertices and no self-intersection (simplified).
func ValidatePolygon(verts []Point) error {
	if len(verts) < 3 || len(verts) > 100 {
		return ErrInvalidPolygon
	}
	// self-intersection check: O(n^2) segments
	n := len(verts)
	for i := 0; i < n; i++ {
		a1 := verts[i]
		a2 := verts[(i+1)%n]
		for j := i + 2; j < n; j++ {
			if j == (i+n-1)%n {
				continue
			}
			b1 := verts[j]
			b2 := verts[(j+1)%n]
			if segmentsIntersect(a1, a2, b1, b2) {
				return ErrInvalidPolygon
			}
		}
	}
	return nil
}

func segmentsIntersect(a1, a2, b1, b2 Point) bool {
	// standard cross-product orientation test
	d1 := cross(b1, b2, a1)
	d2 := cross(b1, b2, a2)
	d3 := cross(a1, a2, b1)
	d4 := cross(a1, a2, b2)
	if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)) {
		return true
	}
	return false
}

func cross(o, a, b Point) float64 {
	return (a.Lon-o.Lon)*(b.Lat-o.Lat) - (a.Lat-o.Lat)*(b.Lon-o.Lon)
}
