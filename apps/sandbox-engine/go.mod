module github.com/arslant84/greenbuild/apps/sandbox-engine

go 1.27.0

require (
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.2
	github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v1.8.2
	github.com/alicebob/miniredis/v2 v2.39.0
	github.com/arslant84/greenbuild/packages/agent-api v0.0.0
	github.com/arslant84/greenbuild/packages/devpki v0.0.0
	github.com/arslant84/greenbuild/packages/queue v0.0.0
	github.com/coder/websocket v1.8.15
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/redis/go-redis/v9 v9.22.0
	google.golang.org/grpc v1.84.0
)

require (
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.12.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/storage/internal v0.1.0 // indirect
	github.com/apache/arrow-go/v18 v18.7.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/goccy/go-json v0.10.6 // indirect
	github.com/google/flatbuffers v25.12.19+incompatible // indirect
	github.com/klauspost/compress v1.19.2 // indirect
	github.com/klauspost/cpuid/v2 v2.4.0 // indirect
	github.com/pierrec/lz4/v4 v4.1.28 // indirect
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.3 // indirect
	github.com/yuin/gopher-lua v1.1.1 // indirect
	github.com/zeebo/xxh3 v1.1.0 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	golang.org/x/exp v0.0.0-20260813180055-c1d0aacb2297 // indirect
	golang.org/x/net v0.58.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.41.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 // indirect
	google.golang.org/protobuf v1.36.12 // indirect
)

replace github.com/arslant84/greenbuild/packages/agent-api => ../../packages/agent-api

replace github.com/arslant84/greenbuild/packages/devpki => ../../packages/devpki

replace github.com/arslant84/greenbuild/packages/queue => ../../packages/queue
