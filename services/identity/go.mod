module plentypay.dev/services/identity

go 1.25.0

require (
	golang.org/x/crypto v0.40.0
	google.golang.org/grpc v1.76.0
	google.golang.org/protobuf v1.36.11
	plentypay.dev/contracts/gen v0.0.0
)

require (
	golang.org/x/net v0.42.0 // indirect
	golang.org/x/sys v0.34.0 // indirect
	golang.org/x/text v0.27.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250804133106-a7a43d27e69b // indirect
)

replace plentypay.dev/contracts/gen => ../../contracts/gen
