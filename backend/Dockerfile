# Production image of the Go API: the api binary, plus goose and the SQL
# migrations for `deploy/deploy.sh` to apply before the API starts.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOBIN=/out go install github.com/pressly/goose/v3/cmd/goose@v3.28.0

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H -u 10001 app
COPY --from=build /out/api /out/goose /usr/local/bin/
COPY migrations/*.sql /migrations/
USER app
EXPOSE 8080
CMD ["api"]
