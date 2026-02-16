# Docker-Compose MongoDB Setup + Onboarding DX Plan

> **For Claude:** REQUIRED: Follow this plan task-by-task using TDD.
> **Research:** See `docs/research/2026-02-16-mdb-community-search-reference-research.md` for full reference repo analysis.

**Goal:** Ship a docker-compose.yml adapted from mdb-community-search that gives users mongod + mongot + replica set in one command, and improve the onboarding wizard to detect topology and guide users through three deployment tiers.

**Architecture:** Docker Compose with three profiles (standalone, replicaset, fullstack) using official MongoDB Community images. Setup-generator container handles auth file creation. Onboarding wizard gains topology detection via `replSetGetStatus` and `listSearchIndexes` probes.

**Tech Stack:** Docker Compose, mongodb/mongodb-community-server, mongodb/mongodb-community-search, TypeScript (wizard), @clack/prompts

**Prerequisites:**

- Docker and docker-compose installed for users who want local MongoDB
- Existing ClawMongo codebase on feat/mongodb-memory-backend branch
- Understanding of mdb-community-search reference repo (see research doc)

---

## Relevant Codebase Files

### Patterns to Follow

- `src/wizard/onboarding-memory.ts` - Current MongoDB onboarding wizard (WizardPrompter pattern)
- `src/commands/configure-memory.ts` - Configure wizard (raw @clack/prompts + guardCancel pattern)
- `src/commands/doctor-memory-search.ts` - Doctor health check (noteMongoDBBackendHealth)
- `src/memory/mongodb-schema.ts:726-799` - Existing detectCapabilities() function
- `src/memory/backend-config.ts` - ResolvedMongoDBConfig type and defaults

### Reference Repo Files (Already Researched)

- github.com/JohnGUnderwood/mdb-community-search/docker-compose.yml
- github.com/JohnGUnderwood/mdb-community-search/mongod.conf
- github.com/JohnGUnderwood/mdb-community-search/mongot.conf
- github.com/JohnGUnderwood/mdb-community-search/init-mongo.sh

### Configuration Files

- `src/config/types.memory.ts` - MemoryMongoDBDeploymentProfile type
- `src/config/zod-schema.ts` - Zod validation schema
- `docker-compose.yml` - Existing (for openclaw-gateway, NOT MongoDB)

---

## Phase 1: Docker Compose Infrastructure (MVP)

> **Exit Criteria:** User can run `docker compose --profile fullstack up -d` from the repo and get a working mongod + mongot + replica set.

### Task 1.1: Create MongoDB Docker Config Files

**Files:**

- Create: `docker/mongodb/docker-compose.mongodb.yml`
- Create: `docker/mongodb/mongod.conf`
- Create: `docker/mongodb/mongot.conf`
- Create: `docker/mongodb/init-mongo.sh`

**Step 1: Create directory structure**

```bash
mkdir -p docker/mongodb
```

**Step 2: Create mongod.conf**

Adapt from reference repo. Key changes:

- Use `clawmongo-net` network name instead of `search-community`
- Container names: `clawmongo-mongod`, `clawmongo-mongot`

```yaml
# mongod.conf - MongoDB Community Server configuration for ClawMongo
# Adapted from github.com/JohnGUnderwood/mdb-community-search

net:
  port: 27017
  bindIpAll: true

replication:
  replSetName: rs0

setParameter:
  # mongot connection parameters (required for $vectorSearch, $search)
  searchIndexManagementHostAndPort: clawmongo-mongot.clawmongo-net:27028
  mongotHost: clawmongo-mongot.clawmongo-net:27028
  skipAuthenticationToSearchIndexManagementServer: false
  useGrpcForSearch: true

security:
  authorization: enabled
  keyFile: /auth/keyfile
```

**Step 3: Create mongot.conf**

```yaml
# mongot.conf - MongoDB Community Search configuration for ClawMongo
# Adapted from github.com/JohnGUnderwood/mdb-community-search

syncSource:
  replicaSet:
    hostAndPort: "clawmongo-mongod.clawmongo-net:27017"
    username: "mongotUser"
    passwordFile: "/auth/passwordFile"
    authSource: "admin"
    tls: false

storage:
  dataPath: "/data/mongot"

server:
  grpc:
    address: "clawmongo-mongot.clawmongo-net:27028"

metrics:
  enabled: true
  address: "clawmongo-mongot.clawmongo-net:9946"

healthCheck:
  address: "clawmongo-mongot.clawmongo-net:8080"

logging:
  verbosity: INFO

# Uncomment for auto-embedding with Voyage AI
# embedding:
#    queryKeyFile: /auth/voyage-api-query-key
#    indexingKeyFile: /auth/voyage-api-indexing-key
#    providerEndpoint: https://api.voyageai.com/v1/embeddings
#    isAutoEmbeddingViewWriter: true
```

**Step 4: Create init-mongo.sh**

Adapted from reference. Changes:

- Remove sample data loading (not needed for ClawMongo)
- Add ClawMongo database initialization
- Keep mongotUser creation with error handling

```bash
#!/bin/bash
set -e

echo "Starting ClawMongo MongoDB initialization..."

export MONGOT_PASSWORD=${MONGOT_PASSWORD:-mongotPassword}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
until mongosh --eval "print('MongoDB is ready')" > /dev/null 2>&1; do
  echo "Waiting for MongoDB..."
  sleep 2
done

echo "MongoDB is ready, proceeding with initialization..."

# Create mongot user for search coordination
echo "Creating mongotUser..."
mongosh --eval "
const adminDb = db.getSiblingDB('admin');
try {
  adminDb.createUser({
    user: 'mongotUser',
    pwd: '$MONGOT_PASSWORD',
    roles: [{ role: 'searchCoordinator', db: 'admin' }]
  });
  print('User mongotUser created successfully');
} catch (error) {
  if (error.code === 11000) {
    print('User mongotUser already exists');
  } else {
    print('Error creating user: ' + error);
    throw error;
  }
}
"

# Create ClawMongo admin user (optional, for authenticated access)
echo "Creating clawmongo admin user..."
mongosh -u admin -p "$ADMIN_PASSWORD" --authenticationDatabase admin --eval "
const openclawDb = db.getSiblingDB('openclaw');
try {
  openclawDb.createUser({
    user: 'clawmongo',
    pwd: '$ADMIN_PASSWORD',
    roles: [{ role: 'readWrite', db: 'openclaw' }]
  });
  print('User clawmongo created successfully');
} catch (error) {
  if (error.code === 11000) {
    print('User clawmongo already exists');
  } else {
    print('Warning: Could not create clawmongo user: ' + error);
  }
}
"

echo "ClawMongo MongoDB initialization completed successfully."
```

**Step 5: Create docker-compose.mongodb.yml**

Three profiles: `standalone`, `replicaset`, `fullstack`

```yaml
# docker-compose.mongodb.yml - MongoDB setup for ClawMongo
# Adapted from github.com/JohnGUnderwood/mdb-community-search
#
# Usage:
#   Full stack (mongod + mongot + vector search):
#     docker compose -f docker/mongodb/docker-compose.mongodb.yml --profile setup run --rm setup-generator
#     docker compose -f docker/mongodb/docker-compose.mongodb.yml --profile fullstack up -d
#
#   Replica set only (transactions, no vector search):
#     docker compose -f docker/mongodb/docker-compose.mongodb.yml --profile replicaset up -d
#
#   Standalone (simplest, no transactions or search):
#     docker compose -f docker/mongodb/docker-compose.mongodb.yml --profile standalone up -d

services:
  # One-time setup: generates keyfile, password files, optional Voyage API key files
  setup-generator:
    image: alpine:latest
    container_name: clawmongo-setup
    volumes:
      - auth-files:/auth
    environment:
      - MONGOT_PASSWORD=${MONGOT_PASSWORD:-mongotPassword}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
      - VOYAGE_API_KEY=${VOYAGE_API_KEY:-}
    command: >
      sh -c "
        echo 'Setting up ClawMongo security files...';

        if [ ! -f /auth/keyfile ]; then
          echo 'Generating keyfile...';
          apk add --no-cache openssl > /dev/null 2>&1;
          openssl rand -base64 756 > /auth/keyfile;
          chmod 400 /auth/keyfile;
          chown 101:101 /auth/keyfile;
          echo 'Keyfile generated successfully';
        else
          echo 'Keyfile already exists, skipping';
        fi;

        echo -n \"$$MONGOT_PASSWORD\" > /auth/passwordFile;
        chmod 600 /auth/passwordFile;
        chown 101:101 /auth/passwordFile;
        echo 'Password file created';

        if [ -n \"$$VOYAGE_API_KEY\" ] && [ \"$$VOYAGE_API_KEY\" != '' ]; then
          echo 'Creating Voyage API key files...';
          echo -n \"$$VOYAGE_API_KEY\" > /auth/voyage-api-query-key;
          echo -n \"$$VOYAGE_API_KEY\" > /auth/voyage-api-indexing-key;
          chmod 600 /auth/voyage-api-query-key /auth/voyage-api-indexing-key;
          chown 101:101 /auth/voyage-api-query-key /auth/voyage-api-indexing-key;
          echo 'Voyage API key files created';
        else
          echo 'No VOYAGE_API_KEY provided, skipping auto-embedding setup';
        fi;
        echo 'Setup complete.';
      "
    restart: "no"
    profiles:
      - setup

  # Tier 1: Standalone MongoDB (simplest - no transactions, no search)
  mongod-standalone:
    image: mongodb/mongodb-community-server:latest
    container_name: clawmongo-mongod-standalone
    ports:
      - "${MONGODB_PORT:-27017}:27017"
    volumes:
      - mongod_standalone_data:/data/db
    profiles:
      - standalone
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Tier 2 & 3: MongoDB with replica set (used by both replicaset and fullstack profiles)
  mongod:
    image: mongodb/mongodb-community-server:latest
    container_name: clawmongo-mongod
    environment:
      MONGODB_INITDB_ROOT_USERNAME: admin
      MONGODB_INITDB_ROOT_PASSWORD: ${ADMIN_PASSWORD:-admin}
      MONGOT_PASSWORD: ${MONGOT_PASSWORD:-mongotPassword}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin}
    command: >-
      mongod
      --config /etc/mongod.conf
      --replSetMember=clawmongo-mongod.clawmongo-net:27017
    ports:
      - "${MONGODB_PORT:-27017}:27017"
    volumes:
      - mongod_data:/data/db
      - mongod_configdb:/data/configdb
      - ./mongod.conf:/etc/mongod.conf:ro
      - auth-files:/auth
      - ./init-mongo.sh:/docker-entrypoint-initdb.d/init-mongo.sh:ro
    networks:
      - clawmongo-net
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    profiles:
      - replicaset
      - fullstack

  # Tier 3: mongot search engine (fullstack only)
  mongot:
    image: mongodb/mongodb-community-search:latest
    container_name: clawmongo-mongot
    ports:
      - "${MONGOT_GRPC_PORT:-27028}:27028"
      - "${MONGOT_HEALTH_PORT:-8080}:8080"
      - "${MONGOT_METRICS_PORT:-9946}:9946"
    volumes:
      - mongot_data:/data/mongot
      - ./mongot.conf:/mongot-community/config.default.yml:ro
      - auth-files:/auth
    networks:
      - clawmongo-net
    depends_on:
      mongod:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--quiet",
          "--tries=1",
          "--spider",
          "http://clawmongo-mongot.clawmongo-net:9946/metrics",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    profiles:
      - fullstack

volumes:
  mongod_standalone_data:
  mongod_data:
  mongod_configdb:
  mongot_data:
  auth-files:

networks:
  clawmongo-net:
    name: clawmongo-net
    driver: bridge
```

**Step 6: Verify docker-compose syntax**

Run: `docker compose -f docker/mongodb/docker-compose.mongodb.yml config --quiet`
Expected: exit 0, no errors

**Step 7: Commit**

```bash
git add docker/mongodb/
git commit -m "feat(docker): add MongoDB docker-compose with 3 deployment tiers

Adapted from github.com/JohnGUnderwood/mdb-community-search.
Three profiles: standalone, replicaset, fullstack (mongod+mongot).
Includes auth setup, health checks, and Voyage API key support."
```

---

### Task 1.2: Create Quick-Start Script

**Files:**

- Create: `docker/mongodb/start.sh`

**Step 1: Create start script**

A convenience script that wraps the docker-compose commands for each tier.

```bash
#!/bin/bash
# ClawMongo MongoDB Quick Start
# Usage:
#   ./docker/mongodb/start.sh standalone    # Simplest, no transactions/search
#   ./docker/mongodb/start.sh replicaset    # Transactions, $text search
#   ./docker/mongodb/start.sh fullstack     # Transactions + vector search + auto-embedding
#   ./docker/mongodb/start.sh stop          # Stop all services
#   ./docker/mongodb/start.sh clean         # Stop and remove all data

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.mongodb.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

case "${1:-fullstack}" in
  standalone)
    echo -e "${GREEN}Starting MongoDB (standalone mode)...${NC}"
    echo -e "${YELLOW}Note: No transactions or vector search in standalone mode.${NC}"
    docker compose -f "$COMPOSE_FILE" --profile standalone up -d
    echo ""
    echo -e "${GREEN}MongoDB is starting on port ${MONGODB_PORT:-27017}${NC}"
    echo "Connection string: mongodb://localhost:${MONGODB_PORT:-27017}"
    echo ""
    echo "Features available:"
    echo "  - Basic CRUD operations"
    echo "  - $text keyword search"
    echo "  - NO transactions (withTransaction will fall back to sequential writes)"
    echo "  - NO vector search ($vectorSearch not available)"
    ;;

  replicaset)
    echo -e "${GREEN}Starting MongoDB (replica set mode)...${NC}"
    # Run setup first if auth files don't exist
    if ! docker volume inspect "$(basename "$SCRIPT_DIR")_auth-files" > /dev/null 2>&1; then
      echo "Running first-time setup..."
      docker compose -f "$COMPOSE_FILE" --profile setup run --rm setup-generator
    fi
    docker compose -f "$COMPOSE_FILE" --profile replicaset up -d
    echo ""
    echo -e "${GREEN}MongoDB replica set is starting on port ${MONGODB_PORT:-27017}${NC}"
    echo "Connection string: mongodb://admin:${ADMIN_PASSWORD:-admin}@localhost:${MONGODB_PORT:-27017}/?authSource=admin&replicaSet=rs0"
    echo ""
    echo "Features available:"
    echo "  - ACID transactions (withTransaction)"
    echo "  - $text keyword search"
    echo "  - Change streams"
    echo "  - NO vector search (requires fullstack profile with mongot)"
    ;;

  fullstack)
    echo -e "${GREEN}Starting MongoDB (full stack: mongod + mongot)...${NC}"
    # Run setup first if auth files don't exist
    if ! docker volume inspect "$(basename "$SCRIPT_DIR")_auth-files" > /dev/null 2>&1; then
      echo "Running first-time setup..."
      docker compose -f "$COMPOSE_FILE" --profile setup run --rm setup-generator
    fi
    docker compose -f "$COMPOSE_FILE" --profile fullstack up -d
    echo ""
    echo -e "${GREEN}MongoDB full stack is starting...${NC}"
    echo "  mongod: port ${MONGODB_PORT:-27017}"
    echo "  mongot: gRPC port ${MONGOT_GRPC_PORT:-27028}, health port ${MONGOT_HEALTH_PORT:-8080}"
    echo ""
    echo "Connection string: mongodb://admin:${ADMIN_PASSWORD:-admin}@localhost:${MONGODB_PORT:-27017}/?authSource=admin&replicaSet=rs0"
    echo ""
    echo "Features available:"
    echo "  - ACID transactions (withTransaction)"
    echo "  - $text keyword search"
    echo "  - $vectorSearch (semantic/vector search)"
    echo "  - $search with $rankFusion and $scoreFusion"
    echo "  - Automated embeddings (with Voyage API key)"
    echo "  - Change streams"
    if [ -n "${VOYAGE_API_KEY:-}" ]; then
      echo ""
      echo -e "${GREEN}Voyage API key detected - auto-embedding available.${NC}"
    else
      echo ""
      echo -e "${YELLOW}For auto-embedding: export VOYAGE_API_KEY=your-key && ./start.sh fullstack${NC}"
    fi
    ;;

  stop)
    echo "Stopping all ClawMongo MongoDB services..."
    docker compose -f "$COMPOSE_FILE" --profile standalone --profile replicaset --profile fullstack down
    echo -e "${GREEN}All services stopped.${NC}"
    ;;

  clean)
    echo -e "${RED}Stopping and removing ALL data (volumes)...${NC}"
    read -p "Are you sure? This deletes all MongoDB data. (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      docker compose -f "$COMPOSE_FILE" --profile standalone --profile replicaset --profile fullstack down -v
      echo -e "${GREEN}All services stopped and data removed.${NC}"
    else
      echo "Aborted."
    fi
    ;;

  *)
    echo "Usage: $0 {standalone|replicaset|fullstack|stop|clean}"
    echo ""
    echo "Deployment Tiers:"
    echo "  standalone   - Simplest MongoDB. No transactions, no search."
    echo "  replicaset   - MongoDB replica set. Transactions + $text search."
    echo "  fullstack    - mongod + mongot. Transactions + vector search + auto-embedding."
    echo ""
    echo "Management:"
    echo "  stop         - Stop all services"
    echo "  clean        - Stop and remove all data (WARNING: destructive)"
    exit 1
    ;;
esac
```

**Step 2: Make executable**

Run: `chmod +x docker/mongodb/start.sh`

**Step 3: Commit**

```bash
git add docker/mongodb/start.sh
git commit -m "feat(docker): add convenience start script for MongoDB tiers"
```

---

## Phase 2: Topology Detection

> **Exit Criteria:** A new `detectTopology()` function returns `{isReplicaSet: boolean, hasMongot: boolean, serverVersion: string}` from a MongoDB connection, tested with unit tests.

### Task 2.1: Create Topology Detection Utility

**Files:**

- Create: `src/memory/mongodb-topology.ts`
- Create: `src/memory/mongodb-topology.test.ts`

**Step 1: Write failing tests**

```typescript
// src/memory/mongodb-topology.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Db } from "mongodb";

describe("detectTopology", () => {
  // Test 1: Detects replica set via replSetGetStatus
  it("detects replica set when replSetGetStatus succeeds", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi
        .fn()
        .mockResolvedValueOnce({ set: "rs0", members: [{}] }) // replSetGetStatus
        .mockResolvedValueOnce({ version: "8.2.0" }), // buildInfo
    });
    const result = await detectTopology(db);
    expect(result.isReplicaSet).toBe(true);
    expect(result.replicaSetName).toBe("rs0");
  });

  // Test 2: Detects standalone when replSetGetStatus fails
  it("detects standalone when replSetGetStatus fails", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi
        .fn()
        .mockRejectedValueOnce(new Error("not running with --replSet"))
        .mockResolvedValueOnce({ version: "8.2.0" }),
    });
    const result = await detectTopology(db);
    expect(result.isReplicaSet).toBe(false);
    expect(result.replicaSetName).toBeUndefined();
  });

  // Test 3: Detects mongot via listSearchIndexes
  it("detects mongot when listSearchIndexes succeeds", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi
        .fn()
        .mockRejectedValueOnce(new Error("not running with --replSet"))
        .mockResolvedValueOnce({ version: "8.2.0" }),
      listSearchIndexesSucceeds: true,
    });
    const result = await detectTopology(db);
    expect(result.hasMongot).toBe(true);
  });

  // Test 4: No mongot when listSearchIndexes fails
  it("detects no mongot when listSearchIndexes fails", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi
        .fn()
        .mockRejectedValueOnce(new Error("not running with --replSet"))
        .mockResolvedValueOnce({ version: "8.2.0" }),
      listSearchIndexesSucceeds: false,
    });
    const result = await detectTopology(db);
    expect(result.hasMongot).toBe(false);
  });

  // Test 5: Extracts server version
  it("extracts server version from buildInfo", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi
        .fn()
        .mockRejectedValueOnce(new Error("not running with --replSet"))
        .mockResolvedValueOnce({ version: "8.2.5" }),
    });
    const result = await detectTopology(db);
    expect(result.serverVersion).toBe("8.2.5");
  });

  // Test 6: Maps topology to deployment tier
  it("maps full stack topology to tier fullstack", async () => {
    const { detectTopology, topologyToTier } = await import("./mongodb-topology.js");
    expect(topologyToTier({ isReplicaSet: true, hasMongot: true, serverVersion: "8.2.0" })).toBe(
      "fullstack",
    );
  });

  it("maps replica set without mongot to tier replicaset", async () => {
    const { topologyToTier } = await import("./mongodb-topology.js");
    expect(topologyToTier({ isReplicaSet: true, hasMongot: false, serverVersion: "8.2.0" })).toBe(
      "replicaset",
    );
  });

  it("maps standalone to tier standalone", async () => {
    const { topologyToTier } = await import("./mongodb-topology.js");
    expect(topologyToTier({ isReplicaSet: false, hasMongot: false, serverVersion: "8.2.0" })).toBe(
      "standalone",
    );
  });

  // Test 9: Suggests connection string based on topology
  it("suggests replicaSet connection string for replica set", async () => {
    const { suggestConnectionString } = await import("./mongodb-topology.js");
    const suggestion = suggestConnectionString(
      { isReplicaSet: true, hasMongot: true, serverVersion: "8.2.0", replicaSetName: "rs0" },
      "mongodb://admin:admin@localhost:27017/?authSource=admin",
    );
    expect(suggestion).toContain("replicaSet=rs0");
  });

  // Test 10: Graceful failure when all probes fail
  it("returns safe defaults when all probes fail", async () => {
    const { detectTopology } = await import("./mongodb-topology.js");
    const db = createMockDb({
      adminCommand: vi.fn().mockRejectedValue(new Error("connection closed")),
    });
    const result = await detectTopology(db);
    expect(result.isReplicaSet).toBe(false);
    expect(result.hasMongot).toBe(false);
    expect(result.serverVersion).toBe("unknown");
  });
});
```

Helper `createMockDb` creates a mock Db object with configurable adminCommand and listSearchIndexes behavior.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/memory/mongodb-topology.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement detectTopology**

```typescript
// src/memory/mongodb-topology.ts
import type { Db } from "mongodb";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory:mongodb:topology");

export type MongoTopology = {
  isReplicaSet: boolean;
  replicaSetName?: string;
  hasMongot: boolean;
  serverVersion: string;
};

export type DeploymentTier = "standalone" | "replicaset" | "fullstack";

/**
 * Detect the MongoDB deployment topology by probing the server.
 * Safe to call on any MongoDB version/edition - all probes use try/catch.
 */
export async function detectTopology(db: Db): Promise<MongoTopology> {
  const result: MongoTopology = {
    isReplicaSet: false,
    hasMongot: false,
    serverVersion: "unknown",
  };

  // Probe 1: Replica set status
  try {
    const rsStatus = await db.admin().command({ replSetGetStatus: 1 });
    result.isReplicaSet = true;
    result.replicaSetName = rsStatus.set;
  } catch {
    // Not a replica set member or not authorized
    result.isReplicaSet = false;
  }

  // Probe 2: Server version via buildInfo
  try {
    const buildInfo = await db.admin().command({ buildInfo: 1 });
    result.serverVersion = buildInfo.version ?? "unknown";
  } catch {
    result.serverVersion = "unknown";
  }

  // Probe 3: mongot availability via listSearchIndexes
  try {
    const collections = await db.listCollections().toArray();
    for (const col of collections.slice(0, 5)) {
      try {
        await db.collection(col.name).listSearchIndexes().toArray();
        result.hasMongot = true;
        break;
      } catch {
        // This collection doesn't support search indexes
      }
    }
  } catch {
    result.hasMongot = false;
  }

  log.info(`topology detected: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Map detected topology to one of three deployment tiers.
 */
export function topologyToTier(topology: MongoTopology): DeploymentTier {
  if (topology.isReplicaSet && topology.hasMongot) return "fullstack";
  if (topology.isReplicaSet) return "replicaset";
  return "standalone";
}

/**
 * Suggest connection string adjustments based on detected topology.
 */
export function suggestConnectionString(topology: MongoTopology, currentUri: string): string {
  if (!topology.isReplicaSet) return currentUri;

  // Check if replicaSet is already in the URI
  try {
    const url = new URL(currentUri);
    if (!url.searchParams.has("replicaSet") && topology.replicaSetName) {
      url.searchParams.set("replicaSet", topology.replicaSetName);
      return url.toString();
    }
  } catch {
    // URI parsing failed, return as-is
  }
  return currentUri;
}

/**
 * Get human-readable feature list for a deployment tier.
 */
export function tierFeatures(tier: DeploymentTier): {
  available: string[];
  unavailable: string[];
} {
  switch (tier) {
    case "fullstack":
      return {
        available: [
          "ACID transactions (withTransaction)",
          "$vectorSearch (semantic/vector search)",
          "$search with $rankFusion and $scoreFusion",
          "Automated embeddings (Voyage AI)",
          "Change streams (real-time sync)",
          "$text keyword search",
        ],
        unavailable: [],
      };
    case "replicaset":
      return {
        available: [
          "ACID transactions (withTransaction)",
          "$text keyword search",
          "Change streams (real-time sync)",
        ],
        unavailable: [
          "$vectorSearch (requires mongot)",
          "$search/$rankFusion/$scoreFusion (requires mongot)",
          "Automated embeddings (requires mongot)",
        ],
      };
    case "standalone":
      return {
        available: ["$text keyword search", "Basic CRUD operations"],
        unavailable: [
          "ACID transactions (requires replica set)",
          "$vectorSearch (requires mongot)",
          "$search/$rankFusion/$scoreFusion (requires mongot)",
          "Automated embeddings (requires mongot)",
          "Change streams (requires replica set)",
        ],
      };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/memory/mongodb-topology.test.ts`
Expected: PASS (10/10)

**Step 5: Run full memory test suite**

Run: `npx vitest run src/memory/`
Expected: PASS (all existing + 10 new)

**Step 6: TSC check**

Run: `npx tsc --noEmit`
Expected: 0 new errors

**Step 7: Commit**

```bash
git add src/memory/mongodb-topology.ts src/memory/mongodb-topology.test.ts
git commit -m "feat(memory): add topology detection for MongoDB deployment tiers

Detects replica set, mongot, and server version via safe probes.
Maps topology to standalone/replicaset/fullstack tiers.
Suggests connection string with replicaSet parameter."
```

---

## Phase 3: Onboarding Wizard Topology Guidance

> **Exit Criteria:** Onboarding wizard detects MongoDB topology after URI entry, shows feature warnings, suggests correct connection string, and recommends deployment profile based on detected tier.

### Task 3.1: Add Topology Detection to Onboarding Wizard

**Files:**

- Modify: `src/wizard/onboarding-memory.ts` (add topology detection after URI input)
- Modify: `src/wizard/onboarding-memory.test.ts` (add tests for new flow)

**Step 1: Write failing tests for new wizard flow**

Add tests to onboarding-memory.test.ts:

```typescript
// New tests for topology detection in wizard
it("detects topology and shows features when connected", async () => {
  // Mock detectTopology to return fullstack
  // Verify wizard shows note with available features
  // Verify wizard auto-selects community-mongot profile
});

it("warns about standalone limitations", async () => {
  // Mock detectTopology to return standalone
  // Verify wizard shows warning note about missing features
  // Verify wizard still allows user to proceed
});

it("suggests replicaSet in connection string when detected", async () => {
  // Mock detectTopology to return replica set with name "rs0"
  // Verify wizard suggests updated URI with replicaSet=rs0
});

it("skips topology detection when connection fails", async () => {
  // Mock connection to fail
  // Verify wizard proceeds to profile selection without topology info
  // Verify no error shown (graceful degradation)
});

it("auto-selects community-bare profile when standalone detected", async () => {
  // Mock detectTopology to return standalone
  // Verify initialValue of profile select is "community-bare"
});

it("shows docker-compose hint when standalone detected", async () => {
  // Mock detectTopology to return standalone
  // Verify wizard shows note with docker-compose instructions
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/wizard/onboarding-memory.test.ts`
Expected: FAIL

**Step 3: Implement topology detection in wizard**

Modify `setupMongoDBMemory` in `onboarding-memory.ts`:

After the URI prompt and before the profile selection, add:

```typescript
// --- Topology Detection (after URI, before profile selection) ---
let detectedTopology: import("../memory/mongodb-topology.js").MongoTopology | undefined;

try {
  const { MongoClient } = await import("mongodb");
  const testClient = new MongoClient(trimmedUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });
  try {
    await testClient.connect();
    const { detectTopology } = await import("../memory/mongodb-topology.js");
    const testDb = testClient.db();
    detectedTopology = await detectTopology(testDb);
  } finally {
    await testClient.close().catch(() => {});
  }
} catch {
  // Connection failed — skip topology detection, user will manually select profile
}

if (detectedTopology) {
  const { topologyToTier, tierFeatures, suggestConnectionString } =
    await import("../memory/mongodb-topology.js");
  const tier = topologyToTier(detectedTopology);
  const features = tierFeatures(tier);

  // Suggest connection string with replicaSet if detected
  const suggestedUri = suggestConnectionString(detectedTopology, trimmedUri);
  if (suggestedUri !== trimmedUri) {
    await prompter.note(
      `Detected replica set "${detectedTopology.replicaSetName}". Recommended URI:\n${suggestedUri}`,
      "Connection String",
    );
    // Use suggested URI going forward
    trimmedUri = suggestedUri; // Note: need to make trimmedUri a let
  }

  // Show detected features
  const lines: string[] = [
    `Detected: ${tier} (MongoDB ${detectedTopology.serverVersion})`,
    "",
    "Available features:",
    ...features.available.map((f) => `  + ${f}`),
  ];
  if (features.unavailable.length > 0) {
    lines.push("", "Not available (upgrade to enable):");
    lines.push(...features.unavailable.map((f) => `  - ${f}`));
  }

  // Docker-compose hint for standalone users
  if (tier === "standalone") {
    lines.push(
      "",
      "Upgrade to full stack with docker-compose:",
      "  ./docker/mongodb/start.sh fullstack",
    );
  } else if (tier === "replicaset") {
    lines.push("", "Add vector search with mongot:", "  ./docker/mongodb/start.sh fullstack");
  }

  await prompter.note(lines.join("\n"), "MongoDB Topology");
}

// Auto-suggest profile based on detected topology
const suggestedProfile: MemoryMongoDBDeploymentProfile = (() => {
  if (detectedTopology) {
    const tier = topologyToTier(detectedTopology);
    if (isAtlas) return "atlas-default";
    if (tier === "fullstack") return "community-mongot";
    if (tier === "replicaset") return "community-bare"; // no mongot
    return "community-bare"; // standalone
  }
  return isAtlas ? "atlas-default" : "community-mongot";
})();
```

**[CHECKPOINT] Decision: Should topology detection be opt-in or always-on? Recommend always-on with 5s timeout (fast failure, good DX). User can skip by cancelling.**

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/wizard/onboarding-memory.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run src/memory/ src/wizard/onboarding-memory.test.ts`
Expected: PASS (all existing + new)

**Step 6: TSC check**

Run: `npx tsc --noEmit`
Expected: 0 new errors

**Step 7: Commit**

```bash
git add src/wizard/onboarding-memory.ts src/wizard/onboarding-memory.test.ts
git commit -m "feat(wizard): detect MongoDB topology during onboarding

Probes replica set status, mongot, and server version after URI entry.
Shows feature availability per detected tier.
Suggests connection string with replicaSet parameter.
Auto-selects deployment profile based on detected topology."
```

---

### Task 3.2: Add Topology Detection to Configure Wizard

**Files:**

- Modify: `src/commands/configure-memory.ts` (add topology detection after connection test)

**Step 1: Add topology detection to configure wizard**

After `testMongoDBConnection` in configure-memory.ts, add the same topology detection pattern but using the raw @clack/prompts + guardCancel pattern (not WizardPrompter).

The implementation mirrors Task 3.1 but uses `note()` from `../terminal/note.js` instead of `prompter.note()`.

**Step 2: Run existing tests**

Run: `npx vitest run src/commands/`
Expected: PASS (configure has E2E tests only, no unit tests needed per convention)

**Step 3: TSC check**

Run: `npx tsc --noEmit`
Expected: 0 new errors

**Step 4: Commit**

```bash
git add src/commands/configure-memory.ts
git commit -m "feat(configure): add topology detection to configure wizard

Mirrors onboarding wizard topology detection.
Shows features, suggests connection string, auto-selects profile."
```

---

### Task 3.3: Add Topology to Doctor Health Check

**Files:**

- Modify: `src/commands/doctor-memory-search.ts` (add topology info to health check output)

**Step 1: Add topology reporting to doctor**

In `noteMongoDBBackendHealth`, after successful ping, add:

```typescript
// Detect topology while connection is still open
try {
  const { detectTopology, topologyToTier, tierFeatures } =
    await import("../memory/mongodb-topology.js");
  const topology = await detectTopology(client.db());
  const tier = topologyToTier(topology);
  const features = tierFeatures(tier);

  const lines = [
    `MongoDB connected. Profile: ${deploymentProfile}.`,
    `Detected topology: ${tier} (v${topology.serverVersion})`,
  ];

  if (features.unavailable.length > 0) {
    lines.push("");
    lines.push("Missing features (upgrade to enable):");
    lines.push(...features.unavailable.map((f) => `  - ${f}`));
    lines.push("");
    lines.push("Upgrade: ./docker/mongodb/start.sh fullstack");
  }

  note(lines.join("\n"), "Memory (MongoDB)");
} catch {
  // Topology detection failed — show basic connected message
  note(`MongoDB connected. Profile: ${deploymentProfile}.`, "Memory (MongoDB)");
}
```

**Step 2: TSC check**

Run: `npx tsc --noEmit`
Expected: 0 new errors

**Step 3: Commit**

```bash
git add src/commands/doctor-memory-search.ts
git commit -m "feat(doctor): show MongoDB topology and missing features

Doctor now reports detected tier and lists missing features.
Suggests docker-compose upgrade command when applicable."
```

---

## Phase 4: Documentation

> **Exit Criteria:** Users have clear documentation for all three deployment tiers with copy-paste commands.

### Task 4.1: Create MongoDB Setup Guide

**Files:**

- Create: `docker/mongodb/README.md`

**Step 1: Write comprehensive README**

Cover:

- Prerequisites (Docker, docker-compose)
- Three tiers with when to use each
- Quick start for each tier (copy-paste commands)
- Connection strings for each tier
- Environment variables (ADMIN_PASSWORD, MONGOT_PASSWORD, VOYAGE_API_KEY)
- Auto-embedding with Voyage AI setup
- Troubleshooting (common errors and fixes)
- Upgrading between tiers
- Data persistence and cleanup

**Step 2: Commit**

```bash
git add docker/mongodb/README.md
git commit -m "docs: add MongoDB deployment guide for all three tiers"
```

### Task 4.2: Update Root Documentation

**Files:**

- Modify: `CLAWMONGO_FRESH_START.md` (add Docker setup section)

**Step 1: Add Docker setup section**

Add a new section pointing to the docker/ directory with quick-start commands for each tier.

**Step 2: Commit**

```bash
git add CLAWMONGO_FRESH_START.md
git commit -m "docs: add docker-compose quick start to CLAWMONGO_FRESH_START.md"
```

---

## Risks

| Risk                                                  | P (1-5) | I (1-5) | Score | Mitigation                                                   |
| ----------------------------------------------------- | ------- | ------- | ----- | ------------------------------------------------------------ |
| Docker images not available on all platforms          | 2       | 3       | 6     | Document ARM64/x86 requirements, test both                   |
| Topology detection times out on slow networks         | 3       | 2       | 6     | 5s timeout, graceful fallback to manual selection            |
| mongot healthcheck fails intermittently               | 3       | 3       | 9     | Use 30s start_period, 5 retries, document troubleshooting    |
| External network creation confuses users              | 2       | 2       | 4     | Use internal network (driver: bridge) instead of external    |
| Auth setup fails on Windows Docker                    | 2       | 4       | 8     | Document Windows-specific setup, test on Windows             |
| Users forget to run setup before fullstack            | 4       | 2       | 8     | start.sh auto-detects missing auth files, runs setup         |
| Existing docker-compose.yml conflict                  | 1       | 3       | 3     | Use separate file: docker/mongodb/docker-compose.mongodb.yml |
| Topology detection probe creates **probe** collection | 2       | 2       | 4     | Use existing collections for probes, fall back gracefully    |

---

## Success Criteria

- [ ] `docker compose -f docker/mongodb/docker-compose.mongodb.yml --profile fullstack up -d` gives working mongod + mongot
- [ ] `./docker/mongodb/start.sh fullstack` convenience script works
- [ ] Onboarding wizard detects and displays topology after URI entry
- [ ] Wizard auto-suggests correct deployment profile based on detected topology
- [ ] Wizard suggests connection string with replicaSet when detected
- [ ] Doctor shows topology info and missing features
- [ ] All existing tests still pass (zero regressions)
- [ ] New tests for topology detection pass (10+ tests)
- [ ] TSC clean
- [ ] Documentation covers all three tiers

---

## ADR: Docker Compose File Location

**Context:** Need to add MongoDB docker-compose without conflicting with existing root docker-compose.yml (used for openclaw-gateway).

**Decision:** Place in `docker/mongodb/docker-compose.mongodb.yml` with all config files in the same directory.

**Consequences:**

- **Positive:** No conflict with existing docker-compose.yml, clean separation of concerns
- **Negative:** Longer commands (need `-f docker/mongodb/docker-compose.mongodb.yml`)
- **Mitigation:** start.sh script wraps the long commands

## ADR: Internal vs External Network

**Context:** Reference repo uses external network requiring `docker network create` before `docker compose up`.

**Decision:** Use internal bridge network (no pre-creation needed).

**Consequences:**

- **Positive:** Simpler setup (no extra step), works with `docker compose up` directly
- **Negative:** Cannot share network with other compose files (acceptable for ClawMongo)

## ADR: Auth Optional for Standalone

**Context:** Reference repo always enables auth. Standalone tier users may want simplicity.

**Decision:** Standalone tier runs without auth (no keyfile, no password). Replicaset and fullstack require auth (keyfile needed for replica set + mongot).

**Consequences:**

- **Positive:** Standalone is truly one-command setup
- **Negative:** Users must understand auth is needed when upgrading to replicaset/fullstack
- **Mitigation:** start.sh and wizard explain this clearly

## ADR: Topology Detection Always-On

**Context:** Should topology detection during onboarding be opt-in or automatic?

**Decision:** Always-on with 5-second timeout. Fast feedback, good DX.

**Consequences:**

- **Positive:** Users get immediate feedback on their MongoDB capabilities
- **Negative:** Adds ~1-5s to onboarding when MongoDB is accessible
- **Mitigation:** Graceful fallback if connection fails, no blocking
