SHELL := /bin/bash

-include .env
export

BACKEND := backend
BIN := $(CURDIR)/$(BACKEND)/bin

GOOSE_VERSION := v3.28.0
SQLC_VERSION := v1.31.1
GOLANGCI_VERSION := v2.14.0

GOOSE := $(BIN)/goose
SQLC := $(BIN)/sqlc
GOLANGCI := $(BIN)/golangci-lint

.PHONY: dev db tools migrate migrate-down migrate-status migrate-create sqlc test test-go test-web lint lint-go lint-web api-client otp e2e

dev:
	./start.sh

db:
	./scripts/ensure-db.sh

tools: $(GOOSE) $(SQLC) $(GOLANGCI)

$(GOOSE):
	GOBIN=$(BIN) go install github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION)

$(SQLC):
	GOBIN=$(BIN) go install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION)

$(GOLANGCI):
	curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $(BIN) $(GOLANGCI_VERSION)

migrate: db $(GOOSE)
	@if ls $(BACKEND)/migrations/*.sql >/dev/null 2>&1; then \
		$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" up; \
	else \
		echo "[migrate] backend/migrations bo'sh: migratsiya yo'q"; \
	fi

migrate-down: $(GOOSE)
	$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" down

migrate-status: $(GOOSE)
	$(GOOSE) -dir $(BACKEND)/migrations postgres "$(DATABASE_URL)" status

migrate-create: $(GOOSE)
	@test -n "$(name)" || { echo "usage: make migrate-create name=<snake_case>"; exit 1; }
	$(GOOSE) -dir $(BACKEND)/migrations -s create $(name) sql

sqlc: $(SQLC)
	cd $(BACKEND) && $(SQLC) generate

test: test-go test-web

test-go: db
	cd $(BACKEND) && go test ./...

test-web:
	pnpm test

lint: lint-go lint-web

lint-go: $(GOLANGCI)
	cd $(BACKEND) && go vet ./... && $(GOLANGCI) run ./...

lint-web:
	pnpm lint && pnpm typecheck

api-client:
	pnpm --filter @hisob24/api-client generate

otp:
	cd $(BACKEND) && go run ./cmd/otp $(if $(ID),-telegram-id $(ID))

# Playwright: the admin panel in a mobile (375px) and a desktop browser, with
# the API mocked by MSW. Needs Chromium: pnpm --filter @hisob24/admin exec playwright install chromium
e2e:
	pnpm --filter @hisob24/admin test:e2e
