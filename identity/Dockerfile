# syntax=docker/dockerfile:1
# Brecha registrada (identity/README.md): aún no hay go.sum commiteado → se resuelve con `go mod tidy`.
# Al commitear go.sum, migrar a la plantilla de docs/standards/go-standards.md §6 (go mod download + distroless).
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/identity .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/identity /identity
USER nonroot:nonroot
EXPOSE 50060
ENTRYPOINT ["/identity"]
