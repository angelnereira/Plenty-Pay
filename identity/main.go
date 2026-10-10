package main

import (
	"log"
	"net"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/server"
	"plentypay/identity/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50060"
	}
	accessSecret, refreshSecret := os.Getenv("ACCESS_TOKEN_SECRET"), os.Getenv("REFRESH_TOKEN_SECRET")
	if accessSecret == "" || refreshSecret == "" {
		log.Fatal("ACCESS_TOKEN_SECRET y REFRESH_TOKEN_SECRET son obligatorios — ver .env.example. Nunca hay un secreto por defecto.")
	}
	tokens, err := auth.NewTokenIssuer(accessSecret, refreshSecret)
	if err != nil {
		log.Fatalf("configuración de tokens inválida: %v", err)
	}

	// Fase 8 (identity/SPEC.md §12): reemplazar por la implementación sobre postgres-db. Solo cambia esta línea.
	users := store.NewInMemoryUserStore()

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("no se pudo escuchar en :%s: %v", port, err)
	}
	grpcServer := grpc.NewServer()
	pb.RegisterIdentityServer(grpcServer, server.NewIdentityServer(users, tokens))
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	healthSrv.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	log.Printf("identity escuchando en :%s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("fallo del servidor gRPC: %v", err)
	}
}
