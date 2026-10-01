# syntax=docker/dockerfile:1
# identity-service — imagen mínima (multi-stage, mandato §14).
FROM golang:1.27-alpine AS build
ENV GOTOOLCHAIN=local CGO_ENABLED=0
WORKDIR /src
# Cache de dependencias primero.
COPY contracts/gen/go.mod contracts/gen/go.sum ./contracts/gen/
COPY services/identity/go.mod services/identity/go.sum ./services/identity/
RUN cd services/identity && go mod download
# Código: contratos generados (solo código de contrato, ADR-0010) + servicio.
COPY contracts/gen ./contracts/gen
COPY services/identity ./services/identity
RUN cd services/identity && \
    go build -trimpath -ldflags="-s -w" -o /out/identity .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/identity /identity
USER nonroot:nonroot
EXPOSE 50051
ENTRYPOINT ["/identity"]
