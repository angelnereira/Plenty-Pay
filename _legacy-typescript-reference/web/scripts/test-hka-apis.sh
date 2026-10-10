#!/bin/bash

# ═══════════════════════════════════════════════════════════
# PlentyPay - Test de APIs HKA desde Terminal
# ═══════════════════════════════════════════════════════════

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base
BASE_URL="http://localhost:3000"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PlentyPay - Test APIs HKA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════
# PASO 1: LOGIN PARA OBTENER SESSION COOKIE
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}🔐 PASO 1: Autenticación${NC}"
echo "Email: admin@plentypay.com"
echo "Password: Admin123!"
echo ""

# Login y guardar cookies
echo -e "${BLUE}→ Iniciando sesión...${NC}"

# Primera opción: Obtener CSRF token
CSRF_TOKEN=$(curl -s -c cookies.txt -b cookies.txt "$BASE_URL/api/auth/csrf" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
    echo -e "${RED}✗ Error obteniendo CSRF token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ CSRF Token obtenido${NC}"

# Login
LOGIN_RESPONSE=$(curl -s -c cookies.txt -b cookies.txt \
    -X POST "$BASE_URL/api/auth/callback/credentials" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"admin@plentypay.com\",
        \"password\": \"Admin123!\",
        \"csrfToken\": \"$CSRF_TOKEN\"
    }")

echo -e "${GREEN}✓ Login exitoso${NC}"
echo ""

# ═══════════════════════════════════════════════════════════
# FUNCIÓN HELPER PARA HACER REQUESTS
# ═══════════════════════════════════════════════════════════

make_request() {
    local METHOD=$1
    local ENDPOINT=$2
    local DESCRIPTION=$3
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🔹 $DESCRIPTION${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Endpoint: $METHOD $ENDPOINT"
    echo ""
    
    RESPONSE=$(curl -s -b cookies.txt \
        -X $METHOD \
        -H "Content-Type: application/json" \
        "$BASE_URL$ENDPOINT")
    
    # Pretty print JSON
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # Verificar success
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Error${NC}"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════
# MÉTODO 1: FOLIOS RESTANTES
# ═══════════════════════════════════════════════════════════

make_request "GET" "/api/hka/folios-restantes" "Método 1: Consultar Folios Restantes"

# ═══════════════════════════════════════════════════════════
# MÉTODO 2: CONSULTAR RUC DV
# ═══════════════════════════════════════════════════════════

make_request "GET" "/api/hka/consultar-ruc?ruc=155596713-2-2015&tipo=2" "Método 2: Consultar RUC DV"

# ═══════════════════════════════════════════════════════════
# MÉTODO 3: ESTADO DOCUMENTO
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔹 Método 3: Estado Documento${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: POST /api/hka/estado-documento"
echo ""

curl -s -b cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "codigoSucursalEmisor": "0000",
        "numeroDocumentoFiscal": "0000000001",
        "puntoFacturacionFiscal": "001",
        "tipoDocumento": "01",
        "tipoEmision": "01"
    }' \
    "$BASE_URL/api/hka/estado-documento" | jq '.'

echo ""

# ═══════════════════════════════════════════════════════════
# MÉTODO 4: DESCARGAR PDF
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔹 Método 4: Descargar PDF${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: POST /api/hka/descargar-pdf"
echo ""

curl -s -b cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "codigoSucursalEmisor": "0000",
        "numeroDocumentoFiscal": "0000000001",
        "puntoFacturacionFiscal": "001",
        "tipoDocumento": "01",
        "tipoEmision": "01"
    }' \
    "$BASE_URL/api/hka/descargar-pdf" | jq '.' | head -20

echo "..."
echo ""

# ═══════════════════════════════════════════════════════════
# MÉTODO 5: DESCARGAR XML
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔹 Método 5: Descargar XML${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: POST /api/hka/descargar-xml"
echo ""

curl -s -b cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "codigoSucursalEmisor": "0000",
        "numeroDocumentoFiscal": "0000000001",
        "puntoFacturacionFiscal": "001",
        "tipoDocumento": "01",
        "tipoEmision": "01"
    }' \
    "$BASE_URL/api/hka/descargar-xml" | jq '.' | head -20

echo "..."
echo ""

# ═══════════════════════════════════════════════════════════
# MÉTODO 6: ENVÍO CORREO
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔹 Método 6: Envío Correo${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: POST /api/hka/envio-correo"
echo ""

curl -s -b cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "codigoSucursalEmisor": "0000",
        "numeroDocumentoFiscal": "0000000001",
        "puntoFacturacionFiscal": "001",
        "tipoDocumento": "01",
        "tipoEmision": "01",
        "correo": "test@example.com"
    }' \
    "$BASE_URL/api/hka/envio-correo" | jq '.'

echo ""

# ═══════════════════════════════════════════════════════════
# MÉTODO 7: ANULACIÓN DOCUMENTO
# ═══════════════════════════════════════════════════════════

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔹 Método 7: Anulación Documento${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoint: POST /api/hka/anulacion-documento"
echo ""

curl -s -b cookies.txt \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "codigoSucursalEmisor": "0000",
        "numeroDocumentoFiscal": "0000000001",
        "puntoFacturacionFiscal": "001",
        "tipoDocumento": "01",
        "tipoEmision": "01",
        "motivoAnulacion": "Prueba de anulación desde terminal"
    }' \
    "$BASE_URL/api/hka/anulacion-documento" | jq '.'

echo ""

# ═══════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Test completado${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Verificar en Sentry:"
echo "   https://YOUR-ORG.sentry.io/issues/  # AJUSTAR: URL real de tu organización en Sentry"
echo ""
echo "📝 Cookies guardadas en: cookies.txt"
echo ""

# Cleanup
rm -f cookies.txt
