module github.com/arslant84/greenbuild/apps/sandbox-engine

go 1.27.0

require (
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
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.3 // indirect
	github.com/yuin/gopher-lua v1.1.1 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	golang.org/x/net v0.57.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260706201446-f0a921348800 // indirect
	google.golang.org/protobuf v1.36.12 // indirect
)

replace github.com/arslant84/greenbuild/packages/agent-api => ../../packages/agent-api

replace github.com/arslant84/greenbuild/packages/devpki => ../../packages/devpki

replace github.com/arslant84/greenbuild/packages/queue => ../../packages/queue
