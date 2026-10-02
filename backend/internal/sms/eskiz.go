package sms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
)

// EskizURL is the Eskiz.uz API.
const EskizURL = "https://notify.eskiz.uz"

// EskizSender sends SMS through the Eskiz.uz API. It logs in with the
// account's email and password and keeps the token it gets for later sends.
type EskizSender struct {
	baseURL, email, password, from string
	client                         *http.Client

	mu    sync.Mutex
	token string
}

// NewEskiz is an Eskiz sender for the account email/password, sending from
// the sender name from (4546 is Eskiz's default).
func NewEskiz(baseURL, email, password, from string, client *http.Client) *EskizSender {
	return &EskizSender{baseURL: baseURL, email: email, password: password, from: from, client: client}
}

// Send sends text to phone.
func (e *EskizSender) Send(ctx context.Context, phone, text string) error {
	token, err := e.currentToken(ctx)
	if err != nil {
		return err
	}
	_, err = e.send(ctx, token, phone, text)
	return err
}

func (e *EskizSender) currentToken(ctx context.Context) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.token == "" {
		token, err := e.login(ctx)
		if err != nil {
			return "", err
		}
		e.token = token
	}
	return e.token, nil
}

func (e *EskizSender) login(ctx context.Context) (string, error) {
	res, err := e.post(ctx, "/api/auth/login", "", url.Values{"email": {e.email}, "password": {e.password}})
	if err != nil {
		return "", fmt.Errorf("eskiz login: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("eskiz login: status %d", res.StatusCode)
	}
	var body struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("eskiz login: %w", err)
	}
	if body.Data.Token == "" {
		return "", errors.New("eskiz login: no token in the answer")
	}
	return body.Data.Token, nil
}

// send posts the SMS and returns Eskiz's status code.
func (e *EskizSender) send(ctx context.Context, token, phone, text string) (int, error) {
	res, err := e.post(ctx, "/api/message/sms/send", token, url.Values{
		"mobile_phone": {phone},
		"message":      {text},
		"from":         {e.from},
	})
	if err != nil {
		return 0, fmt.Errorf("eskiz send: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	return res.StatusCode, nil
}

func (e *EskizSender) post(ctx context.Context, path, token string, form url.Values) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return e.client.Do(req)
}
