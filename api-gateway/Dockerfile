# syntax=docker/dockerfile:1
# Brecha registrada (api-gateway/README.md): sin go.sum commiteado aún → `go mod tidy` en el build.
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api-gateway .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api-gateway /api-gateway
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/api-gateway"]
