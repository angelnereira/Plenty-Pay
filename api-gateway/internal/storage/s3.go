// Package storage implementa un cliente S3 mínimo con autenticación AWS SigV4
// para comunicarse con object-storage (Garage) sin dependencias externas (ADR 0001, ADR 0002).
package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// Client es el cliente S3 para almacenamiento de objetos.
type Client struct {
	endpoint   string
	region     string
	keyID      string
	secretKey  string
	bucket     string
	httpClient *http.Client
}

// NewClient crea un cliente S3 configurado.
func NewClient(endpoint, region, keyID, secretKey, bucket string) *Client {
	if region == "" {
		region = "garage"
	}
	return &Client{
		endpoint:   strings.TrimRight(endpoint, "/"),
		region:     region,
		keyID:      keyID,
		secretKey:  secretKey,
		bucket:     bucket,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// PutObject sube un archivo binario al bucket S3 con su Content-Type correspondiente.
func (c *Client) PutObject(ctx context.Context, key, contentType string, data []byte) error {
	path := "/" + c.bucket + "/" + strings.TrimLeft(key, "/")
	reqURL := c.endpoint + path

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	payloadHash := sha256Hex(data)

	u, err := url.Parse(reqURL)
	if err != nil {
		return fmt.Errorf("url invalida: %w", err)
	}

	headers := map[string]string{
		"host":                 u.Host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzDate,
		"content-type":         contentType,
	}

	authHeader := c.buildAuthHeader("PUT", path, "", headers, payloadHash, amzDate, dateStamp)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, reqURL, bytes.NewReader(data))
	if err != nil {
		return err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Authorization", authHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error al conectar con object-storage: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("object-storage respondio %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// GetObject obtiene un objeto desde el bucket S3.
func (c *Client) GetObject(ctx context.Context, key string) (io.ReadCloser, string, int64, error) {
	path := "/" + c.bucket + "/" + strings.TrimLeft(key, "/")
	reqURL := c.endpoint + path

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	payloadHash := sha256Hex(nil)

	u, err := url.Parse(reqURL)
	if err != nil {
		return nil, "", 0, fmt.Errorf("url invalida: %w", err)
	}

	headers := map[string]string{
		"host":                 u.Host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzDate,
	}

	authHeader := c.buildAuthHeader("GET", path, "", headers, payloadHash, amzDate, dateStamp)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, "", 0, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Authorization", authHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", 0, fmt.Errorf("error al conectar con object-storage: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		defer func() { _ = resp.Body.Close() }()
		respBody, _ := io.ReadAll(resp.Body)
		return nil, "", 0, fmt.Errorf("object-storage GET %d: %s", resp.StatusCode, string(respBody))
	}

	return resp.Body, resp.Header.Get("Content-Type"), resp.ContentLength, nil
}

func (c *Client) buildAuthHeader(method, path, query string, headers map[string]string, payloadHash, amzDate, dateStamp string) string {
	names := make([]string, 0, len(headers))
	for h := range headers {
		names = append(names, strings.ToLower(h))
	}
	sort.Strings(names)

	var canonicalHeaders strings.Builder
	for _, h := range names {
		canonicalHeaders.WriteString(h)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(strings.TrimSpace(headers[h]))
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

	scope := dateStamp + "/" + c.region + "/s3/aws4_request"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+c.secretKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(c.region))
	kService := hmacSHA256(kRegion, []byte("s3"))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	signature := hex.EncodeToString(hmacSHA256(kSigning, []byte(stringToSign)))

	return "AWS4-HMAC-SHA256 Credential=" + c.keyID + "/" + scope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}
