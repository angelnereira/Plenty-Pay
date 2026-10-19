package openapi

import (
	"encoding/json"
	"net/http"

	"plentypay/api-gateway/internal/routes"
)

// Handler sirve el documento OpenAPI 3.0 generado a partir de la tabla declarativa de rutas (F09.7).
func Handler() http.HandlerFunc {
	doc := build()
	body, _ := json.MarshalIndent(doc, "", "  ")
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(append(body, '\n'))
	}
}

func build() map[string]any {
	paths := map[string]any{}
	for _, r := range routes.Table {
		path := r.Path
		// OpenAPI usa {param} igual que la tabla; ya viene en ese formato.
		ops, _ := paths[path].(map[string]any)
		if ops == nil {
			ops = map[string]any{}
		}
		op := map[string]any{
			"summary":     r.RPC,
			"operationId": r.Method + " " + r.Path,
			"responses": map[string]any{
				"200": map[string]any{"description": "OK"},
				"400": map[string]any{"description": "Bad request"},
				"401": map[string]any{"description": "Unauthorized"},
				"403": map[string]any{"description": "Forbidden"},
				"404": map[string]any{"description": "Not found"},
				"429": map[string]any{"description": "Too many requests"},
			},
		}
		if r.RequireAuth {
			op["security"] = []map[string]any{{"bearerAuth": []string{}}}
		}
		if r.Idempotency {
			op["parameters"] = appendParams(op["parameters"], map[string]any{
				"name": "Idempotency-Key", "in": "header", "required": true,
				"schema": map[string]any{"type": "string"},
			})
		}
		if r.StepUp {
			op["parameters"] = appendParams(op["parameters"], map[string]any{
				"name": "X-Step-Up-Token", "in": "header", "required": true,
				"schema": map[string]any{"type": "string"},
			})
		}
		// Path params
		for name := range r.PathParams {
			op["parameters"] = appendParams(op["parameters"], map[string]any{
				"name": name, "in": "path", "required": true,
				"schema": map[string]any{"type": "string"},
			})
		}
		// Query params
		for q := range r.QueryParams {
			op["parameters"] = appendParams(op["parameters"], map[string]any{
				"name": q, "in": "query", "required": false,
				"schema": map[string]any{"type": "string"},
			})
		}
		if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" {
			op["requestBody"] = map[string]any{
				"required": true,
				"content": map[string]any{
					"application/json": map[string]any{
						"schema": map[string]any{"type": "object"},
					},
				},
			}
		}
		method := toLower(r.Method)
		ops[method] = op
		paths[path] = ops
	}
	return map[string]any{
		"openapi": "3.0.3",
		"info": map[string]any{
			"title":   "PlentyPay API Gateway",
			"version": "1.0.0",
		},
		"paths": paths,
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"bearerAuth": map[string]any{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
				},
			},
		},
	}
}

func appendParams(existing any, p map[string]any) []map[string]any {
	list, _ := existing.([]map[string]any)
	return append(list, p)
}

func toLower(s string) string {
	out := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		out[i] = c
	}
	return string(out)
}
