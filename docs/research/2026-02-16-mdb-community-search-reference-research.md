# Research: mdb-community-search Reference Repo

## Knowledge Gap

How to properly orchestrate mongod + mongot via docker-compose for MongoDB Community Edition with full search support.

## Research Conducted

- Source: https://github.com/JohnGUnderwood/mdb-community-search (John G Underwood, MongoDB engineer)
- All files read: docker-compose.yml, mongod.conf, mongot.conf, init-mongo.sh, README.md, prometheus.yml, start-monitoring.sh

## Key Findings

### 1. Two-Phase Architecture

The setup uses a **two-phase approach**:

- **Phase 1 (setup)**: One-time `setup-generator` Alpine container creates auth files (keyfile, passwordFile, optional Voyage API key files), then exits. Uses Docker profile `--profile setup`.
- **Phase 2 (runtime)**: `mongod` + `mongot` services run with auth files from shared volume.

### 2. Docker Compose Services

- **setup-generator**: Alpine, generates keyfile (`openssl rand -base64 756`), passwordFile, Voyage API key files. Shared `auth-files` volume. Profile: `setup`.
- **mongod**: `mongodb/mongodb-community-server:latest`, port 27017, replica set rs0, healthcheck via `mongosh --eval "db.adminCommand('ping')"`.
- **mongot**: `mongodb/mongodb-community-search:latest`, ports 27028 (gRPC), 8080 (health), 9946 (metrics). Depends on mongod healthy. Healthcheck via wget to metrics.
- **mongodb-exporter**: Percona MongoDB exporter (monitoring, optional)
- **prometheus**: Metrics collection (optional)
- **grafana**: Dashboards (optional)

### 3. mongod.conf (CRITICAL)

```yaml
net:
  port: 27017
  bindIpAll: true
replication:
  replSetName: rs0
setParameter:
  searchIndexManagementHostAndPort: mongot-community.search-community:27028
  mongotHost: mongot-community.search-community:27028
  skipAuthenticationToSearchIndexManagementServer: false
  useGrpcForSearch: true
security:
  authorization: enabled
  keyFile: /auth/keyfile
```

### 4. mongot.conf (CRITICAL)

```yaml
syncSource:
  replicaSet:
    hostAndPort: "mongod.search-community:27017"
    username: "mongotUser"
    passwordFile: "/auth/passwordFile"
    authSource: "admin"
    tls: false
storage:
  dataPath: "/data/mongot"
server:
  grpc:
    address: "mongot-community.search-community:27028"
metrics:
  enabled: true
  address: "mongot-community.search-community:9946"
healthCheck:
  address: "mongot-community.search-community:8080"
logging:
  verbosity: INFO
# Optional auto-embedding:
# embedding:
#    queryKeyFile: /auth/voyage-api-query-key
#    indexingKeyFile: /auth/voyage-api-indexing-key
#    providerEndpoint: https://ai.mongodb.com/v1/embeddings
#    isAutoEmbeddingViewWriter: true
```

### 5. init-mongo.sh

- Waits for mongod readiness via `mongosh --eval "print('MongoDB is ready')"`
- Creates `mongotUser` with `searchCoordinator` role on admin db
- Handles user-already-exists (error code 11000)
- Optionally restores sample data from sampledata.archive

### 6. Auth Architecture

- **keyfile**: Shared auth between replica set members, generated via `openssl rand -base64 756`, permissions 400, owner 101:101
- **passwordFile**: mongot password, permissions 600, owner 101:101
- **Voyage API keys**: Optional, written to `/auth/voyage-api-query-key` and `/auth/voyage-api-indexing-key`

### 7. Network Architecture

- External bridge network: `search-community`
- Internal hostnames: `mongod.search-community:27017`, `mongot-community.search-community:27028`
- Must pre-create network: `docker network create search-community`

### 8. Connection Strings

- Default: `mongodb://admin:admin@localhost:27017/?authSource=admin`
- No auth (simpler): `mongodb://localhost:27017/?replicaSet=rs0`

### 9. Auto-Embedding (Voyage AI)

- Requires `VOYAGE_API_KEY` env var at setup time
- setup-generator writes key to files, mongot.conf references them
- Provider endpoint: `https://ai.mongodb.com/v1/embeddings` (MongoDB proxy) OR `https://api.voyageai.com/v1/embeddings` (direct)
- `isAutoEmbeddingViewWriter: true` designates leader instance

## Application to ClawMongo

### What to Adapt

1. docker-compose.yml: Strip monitoring stack (no prometheus/grafana/exporter), keep setup-generator + mongod + mongot
2. mongod.conf: Adapt hostnames to ClawMongo naming convention
3. mongot.conf: Same adaptation, keep auto-embedding commented out as optional
4. init-mongo.sh: Keep mongotUser creation, remove sample data loading, add ClawMongo-specific init
5. Network: Use `clawmongo-network` instead of `search-community`

### What to Add (Not in Reference)

1. Three-tier docker-compose profiles: standalone, replicaset, fullstack
2. Onboarding wizard topology detection
3. Connection string guidance in wizard
4. Auto-detection of which tier user's MongoDB is running

### Key Differences from Reference

- Reference has auth enabled by default; ClawMongo should offer auth-optional for simplicity
- Reference requires external network creation; ClawMongo should use internal network
- Reference loads sample data; ClawMongo doesn't need sample data
- Reference has monitoring stack; ClawMongo doesn't need it (maybe later)

## References

- https://github.com/JohnGUnderwood/mdb-community-search
- MongoDB Community Search docs: https://www.mongodb.com/docs/manual/administration/install-community/?search-docker=with-search-docker
