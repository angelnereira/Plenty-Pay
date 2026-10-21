package domain

import (
	"strconv"
	"strings"
)

// Clases de tasa de ITBMS (regulatory-framework §13: legal.pa.itbms.<clase>_bps).
const (
	RateExempt   = "exempt"
	RateStandard = "standard"
	RateAlcohol  = "alcohol"
	RateTobacco  = "tobacco"
)

// RateClasses lee de la versión legal guardada en el documento (client.Rates.Version:
// "legal.pa.itbms.standard_bps=700@…;…") a qué clase pertenece cada tasa. Así el envío al PAC usa las
// tasas vigentes en la fecha del documento, no las de hoy (AGENTS.md §2.13). 0 es siempre exento.
func RateClasses(legalParamVersion string) map[int64]string {
	out := map[int64]string{0: RateExempt}
	for _, part := range strings.Split(legalParamVersion, ";") {
		key, rest, ok := strings.Cut(part, "=")
		if !ok {
			continue
		}
		class, ok := strings.CutPrefix(strings.TrimSpace(key), "legal.pa.itbms.")
		if !ok {
			continue
		}
		class = strings.TrimSuffix(class, "_bps")
		value, _, _ := strings.Cut(rest, "@")
		bps, err := strconv.ParseInt(value, 10, 64)
		if err != nil || bps <= 0 {
			continue
		}
		if _, taken := out[bps]; !taken {
			out[bps] = class
		}
	}
	return out
}
