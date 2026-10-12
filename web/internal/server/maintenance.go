package server

import (
	"errors"
	"html/template"
	"log/slog"
)

// errNoBundle es la causa que se registra cuando `static/app/` no tiene bundle construido.
var errNoBundle = errors.New("static/app sin bundle de flutter web")

func slogString(k, v string) slog.Attr { return slog.String(k, v) }

// maintenancePage es la plantilla de mantenimiento (R4, R5: `html/template` escapa todo).
var maintenancePage = func() *template.Template {
	return template.Must(template.New("maintenance").Parse(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PlentyPay</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; margin: 0;
         align-items: center; justify-content: center; background: #f7f7f8; color: #1c1b1f; }
  main { max-width: 32rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { line-height: 1.5; }
</style>
</head>
<body>
<main>
  <h1>Estamos preparando la app</h1>
  <p>La aplicación web se está actualizando. Vuelve a intentarlo en unos minutos o abre la app
     instalada en tu teléfono.</p>
</main>
</body>
</html>`))
}
