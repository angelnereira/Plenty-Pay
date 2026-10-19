// Cliente S3 minimo para las pruebas de object-storage (herramienta de prueba,
// NO codigo desplegable - AGENTS.md 2.1). Firma SigV4 con la stdlib de Go y
// habla con la API de Garage. Sin dependencias externas: el binario se compila
// dentro de un contenedor golang en la misma red que object-storage.
//
// Uso:
//
//	go run . <keyId> <secret> <LIST|PUT|GET|DELETE> <bucket> [key]
//
// Salida: una linea con el codigo HTTP de la respuesta (p. ej. 200, 403).
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "s3cli:", err)
		os.Exit(2)
	}
}

func run(args []string) error {
	if len(args) < 4 {
		return fmt.Errorf("uso: s3cli <keyId> <secret> <LIST|PUT|GET|DELETE> <bucket> [key]")
	}
	keyID, secret, method, bucket := args[0], args[1], strings.ToUpper(args[2]), args[3]
	key := ""
	if len(args) > 4 {
		key = args[4]
	}

	endpoint := envOr("S3_ENDPOINT", "http://object-storage:3900")
	region := envOr("S3_REGION", "garage")

	var (
		body   []byte
		path   = "/" + bucket
		query  = ""
		method2 = "GET"
	)
	switch method {
	case "LIST":
		query = "list-type=2"
		path += "/"
	case "PUT":
		method2 = "PUT"
		path += "/" + key
		switch {
		case os.Getenv("S3_PUT_SIZE") != "":
			n, err := strconv.Atoi(os.Getenv("S3_PUT_SIZE"))
			if err != nil {
				return fmt.Errorf("S3_PUT_SIZE invalido: %w", err)
			}
			body = bytes.Repeat([]byte("a"), n)
		default:
			body = []byte(envOr("S3_PUT_BODY", "probe"))
		}
	case "GET":
		path += "/" + key
	case "DELETE":
		method2 = "DELETE"
		path += "/" + key
	default:
		return fmt.Errorf("metodo no soportado: %s", method)
	}

	status, err := s3Request(method2, endpoint, path, query, region, keyID, secret, body)
	if err != nil {
		return err
	}
	fmt.Println(status)
	return nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// s3Request firma la peticion con SigV4 y devuelve el codigo HTTP de respuesta.
func s3Request(method, endpoint, path, query, region, keyID, secret string, body []byte) (int, error) {
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	payloadHash := sha256Hex(body)
	headers := map[string]string{
		"host":                 hostOf(endpoint),
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzDate,
	}
	if len(body) > 0 {
		headers["content-type"] = "application/octet-stream"
	}

	// Peticion canonica: headers ordenados y solo los firmados.
	names := make([]string, 0, len(headers))
	for h := range headers {
		names = append(names, h)
	}
	sort.Strings(names)
	var canonicalHeaders strings.Builder
	for _, h := range names {
		canonicalHeaders.WriteString(h)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(headers[h])
		canonicalHeaders.WriteByte('\n')
	}
	signedHeaders := strings.Join(names, ";")

	canonicalRequest := strings.Join([]string{
		method,
		path,
		query,
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := dateStamp + "/" + region + "/s3/aws4_request"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signature := hex.EncodeToString(sign(secret, dateStamp, region, stringToSign))
	headers["Authorization"] = "AWS4-HMAC-SHA256 Credential=" + keyID + "/" + scope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature

	url := endpoint + path
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(method, url, bytes.NewReader(body)) // #nosec G704 -- test CLI, URL comes from argv
	if err != nil {
		return 0, fmt.Errorf("build request: %w", err)
	}
	for h, v := range headers {
		req.Header.Set(h, v)
	}
	req.Host = headers["host"]

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- test CLI, URL comes from argv
	if err != nil {
		return 0, fmt.Errorf("do request: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	return resp.StatusCode, nil
}

func hostOf(endpoint string) string {
	return strings.TrimPrefix(strings.TrimPrefix(endpoint, "http://"), "https://")
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// sign aplica la cadena HMAC de SigV4 (AWS4 -> fecha -> region -> servicio).
func sign(secret, dateStamp, region, stringToSign string) []byte {
	h := func(key []byte, data string) []byte {
		m := hmac.New(sha256.New, key)
		m.Write([]byte(data))
		return m.Sum(nil)
	}
	kDate := h([]byte("AWS4"+secret), dateStamp)
	kRegion := h(kDate, region)
	kService := h(kRegion, "s3")
	kSigning := h(kService, "aws4_request")
	return h(kSigning, stringToSign)
}
