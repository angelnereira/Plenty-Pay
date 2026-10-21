package pac

import (
	"context"
	"errors"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"plentypay/fiscal-invoicing/internal/domain"
)

type stub struct{ info Info }

func (s stub) Info() Info           { return s.info }
func (s stub) Check(Document) error { return nil }
func (s stub) Send(context.Context, Credentials, Document) (Result, error) {
	return Result{}, nil
}

// R10: el registro es el selector; un adaptador simulado nunca atiende producción (R9).
func TestR10_RegistrySelectsAdapters(t *testing.T) {
	sim := stub{Info{ID: "sim", Environments: []string{domain.EnvDemo, domain.EnvProd}, Simulated: true}}
	real := stub{Info{ID: "pac-a", Environments: []string{domain.EnvDemo, domain.EnvProd},
		Credentials: []CredentialField{{Key: "user"}, {Key: "pass", Secret: true}}}}
	r := NewRegistry(sim, real)
	if !r.Supports("pac-a", domain.EnvProd) || r.Supports("sim", domain.EnvProd) || !r.Supports("sim", domain.EnvDemo) ||
		r.Supports("otro", domain.EnvDemo) || r.Get("otro") != nil {
		t.Fatal("Supports/Get")
	}
	if l := r.List(); len(l) != 2 || l[0].ID != "sim" || strings.Join(l[1].CredentialKeys(), ",") != "user,pass" {
		t.Fatalf("%+v", l)
	}
	var nilRegistry *Registry
	if nilRegistry.Get("sim") != nil {
		t.Fatal("registro nulo")
	}
}

func TestR3_RetryErrorIsTransient(t *testing.T) {
	err := &RetryError{Message: "sin folios", Alert: true, Err: errors.New("code 119")}
	if !errors.Is(err, ErrTransient) || err.Error() != "sin folios: code 119" {
		t.Fatalf("%v", err)
	}
}

// vendorSDKs son los SDK de proveedores de PAC; cada uno solo se importa desde su adaptador.
var vendorSDKs = map[string]string{"github.com/angelnereira/hka-sdk": "internal/pac/hka/"}

// ADR 0022 (sin dependencia de un proveedor): el paquete de un adaptador (pac/<proveedor>) y el SDK de
// un proveedor solo se importan desde ese mismo adaptador; main.go los registra. Dominio, servicio,
// store, servidor y pac/dgi quedan neutrales. Las pruebas pueden usar el simulador como doble.
func TestR10_VendorNeutralPackages(t *testing.T) {
	const module = "plentypay/fiscal-invoicing/"
	root := filepath.Join("..", "..")
	err := filepath.WalkDir(filepath.Join(root, "internal"), func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		f, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, imp := range f.Imports {
			p := strings.Trim(imp.Path.Value, `"`)
			owner := ""
			for sdk, dir := range vendorSDKs {
				if p == sdk || strings.HasPrefix(p, sdk+"/") {
					owner = dir
				}
			}
			if adapter, ok := strings.CutPrefix(p, module+"internal/pac/"); ok && adapter != "dgi" {
				owner = "internal/pac/" + adapter + "/"
				if adapter == "simulator" && strings.HasSuffix(rel, "_test.go") {
					owner = ""
				}
			}
			if owner != "" && !strings.HasPrefix(rel, owner) {
				t.Errorf("%s importa %s: un proveedor solo se usa desde su adaptador (%s) y main.go", rel, p, owner)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
