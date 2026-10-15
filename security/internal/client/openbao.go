package client

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"plentypay/security/internal/domain"
)

// OpenBaoClient se comunica con la API HTTP de OpenBao (fork de Vault).
type OpenBaoClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewOpenBaoClient(baseURL, token string) *OpenBaoClient {
	return &OpenBaoClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Health consulta /v1/sys/health en OpenBao.
func (c *OpenBaoClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/sys/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// 200 = inicializado, desellado y activo; 429 = standby; 473 = rendimiento standby
	if resp.StatusCode != http.StatusOK && resp.StatusCode != 429 {
		return fmt.Errorf("openbao healthcheck devolvió status %d", resp.StatusCode)
	}
	return nil
}

type kvPayload struct {
	Data map[string]any `json:"data"`
}

type kvResponse struct {
	Data struct {
		Data     map[string]any `json:"data"`
		Metadata struct {
			Version     int       `json:"version"`
			CreatedTime time.Time `json:"created_time"`
		} `json:"metadata"`
	} `json:"data"`
}

// Get obtiene un secreto de OpenBao KV v2 (secret/data/plentypay/<name>).
func (c *OpenBaoClient) Get(ctx context.Context, name, version string) (*domain.Secret, error) {
	url := fmt.Sprintf("%s/v1/secret/data/plentypay/%s", c.baseURL, strings.TrimPrefix(name, "/"))
	if version != "" {
		url += "?version=" + version
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, domain.ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openbao GET devolvió %d", resp.StatusCode)
	}

	var res kvResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	valB64, _ := res.Data.Data["value"].(string)
	val, err := base64.StdEncoding.DecodeString(valB64)
	if err != nil {
		val = []byte(valB64)
	}

	var allowedReaders []string
	if arList, ok := res.Data.Data["allowed_readers"].([]any); ok {
		for _, item := range arList {
			if s, ok := item.(string); ok {
				allowedReaders = append(allowedReaders, s)
			}
		}
	}

	labels := make(map[string]string)
	if lMap, ok := res.Data.Data["labels"].(map[string]any); ok {
		for k, v := range lMap {
			if s, ok := v.(string); ok {
				labels[k] = s
			}
		}
	}

	return &domain.Secret{
		Name:           name,
		Version:        strconv.Itoa(res.Data.Metadata.Version),
		Value:          val,
		AllowedReaders: allowedReaders,
		Labels:         labels,
		CreatedAt:      res.Data.Metadata.CreatedTime,
	}, nil
}

// Put escribe un secreto en OpenBao KV v2.
func (c *OpenBaoClient) Put(ctx context.Context, secret *domain.Secret, _ string) (*domain.SecretMetadata, error) {
	url := fmt.Sprintf("%s/v1/secret/data/plentypay/%s", c.baseURL, strings.TrimPrefix(secret.Name, "/"))

	payload := kvPayload{
		Data: map[string]any{
			"value":           base64.StdEncoding.EncodeToString(secret.Value),
			"allowed_readers": secret.AllowedReaders,
			"labels":          secret.Labels,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openbao PUT devolvió %d: %s", resp.StatusCode, string(respBody))
	}

	var res kvResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	return &domain.SecretMetadata{
		Name:           secret.Name,
		Version:        strconv.Itoa(res.Data.Metadata.Version),
		AllowedReaders: secret.AllowedReaders,
		Labels:         secret.Labels,
		CreatedAt:      res.Data.Metadata.CreatedTime,
	}, nil
}

// Rotate escribe una nueva versión del secreto existente.
func (c *OpenBaoClient) Rotate(ctx context.Context, name string, newValue []byte, idempotencyKey string) (*domain.SecretMetadata, error) {
	existing, err := c.Get(ctx, name, "")
	if err != nil {
		return nil, err
	}

	existing.Value = newValue
	return c.Put(ctx, existing, idempotencyKey)
}

// List lista secretos bajo un prefijo.
func (c *OpenBaoClient) List(ctx context.Context, prefix string) ([]domain.SecretMetadata, error) {
	url := fmt.Sprintf("%s/v1/secret/metadata/plentypay/%s?list=true", c.baseURL, strings.Trim(prefix, "/"))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openbao LIST devolvió %d", resp.StatusCode)
	}

	var listRes struct {
		Data struct {
			Keys []string `json:"keys"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&listRes); err != nil {
		return nil, err
	}

	var metas []domain.SecretMetadata
	for _, k := range listRes.Data.Keys {
		metas = append(metas, domain.SecretMetadata{
			Name: prefix + k,
		})
	}
	return metas, nil
}
