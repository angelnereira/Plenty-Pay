package geostream

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client wraps the GeoStream REST API.
type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

func New(baseURL, apiKey string) *Client {
	return &Client{BaseURL: baseURL, APIKey: apiKey, HTTP: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Client) do(method, path string, body any) (*http.Response, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(method, c.BaseURL+path, &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	return c.HTTP.Do(req)
}

// CreateSession creates a GeoStream session.
func (c *Client) CreateSession(mode string, expiresIn int) (map[string]any, error) {
	resp, err := c.do("POST", "/v1/sessions", map[string]any{
		"mode":              mode,
		"expires_in_seconds": expiresIn,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("geostream: %s", resp.Status)
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSnapshot retrieves the last location snapshot of a session.
func (c *Client) GetSnapshot(sessionID string) (map[string]any, error) {
	resp, err := c.do("GET", "/v1/sessions/"+sessionID+"/snapshot", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("geostream: %s", resp.Status)
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}


// IngestLocations sends location samples to GeoStream (HTTP ingest).
func (c *Client) IngestLocations(sessionID string, samples []map[string]any) (map[string]any, error) {
	resp, err := c.do("POST", "/v1/ingest/locations", map[string]any{
		"session_id": sessionID,
		"samples":    samples,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("geostream: %s", resp.Status)
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}
