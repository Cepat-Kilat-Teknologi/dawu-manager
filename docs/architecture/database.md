# Database Architecture

dawu-manager uses SQLite as its embedded database, accessed through Prisma 7 with the libsql driver adapter. This page describes the schema, data flow, and operational characteristics of the database layer.

---

## Why SQLite

dawu-manager is designed for deployment in ISP network operations environments where simplicity and reliability are prioritized over horizontal scalability. SQLite was chosen for the following reasons:

| Requirement | SQLite Advantage |
|-------------|-----------------|
| Zero configuration | No database server process to install or manage |
| Single-file deployment | Database is a single file, trivial to back up and restore |
| npx compatibility | Works immediately with `npx dawu-manager` (no external dependencies) |
| Docker simplicity | Mounted as a volume, no sidecar container needed |
| Reliability | SQLite is one of the most tested software libraries in existence |
| Performance | More than sufficient for managing up to 100 BNG nodes |

---

## Schema

### Entity Relationship Diagram

```
+----------+       +----------+       +----------+
|   User   |       |   Node   |       | Setting  |
+----------+       +----------+       +----------+
| id (PK)  |       | id (PK)  |       | key (PK) |
| name     |       | name     |       | value    |
| email    |       | url      |       +----------+
| password |       | apiKey   |
| role     |       | location |
| created  |       | status   |
| updated  |       | lastSeen |
+----+-----+       | created  |
     |              | updated  |
     |              +----+-----+
     |                   |
     |    +-----------+  |
     +--->| AuditLog  |<-+
     |    +-----------+
     |    | id (PK)   |
     |    | userId    |
     |    | nodeId    |
     |    | action    |
     |    | detail    |
     |    | created   |
     |    +-----------+
     |
     +---->+----------+       +-----------+
           | Session  |       | AlertRule |
           +----------+       +-----------+
           | id (PK)  |       | id (PK)   |
           | token    |       | name      |
           | userId   |       | metric    |
           | expires  |       | operator  |
           +----------+       | threshold |
                              | nodeId    |
                              | enabled   |
                              +-----------+
                                    |
                              +------------+
                              | AlertEvent |
                              +------------+
                              | id (PK)    |
                              | ruleId     |
                              | nodeId     |
                              | value      |
                              | created    |
                              +------------+
```

### Models

#### User

Stores dashboard user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `name` | String | Required | Display name |
| `email` | String | Unique, required | Login identifier |
| `passwordHash` | String | Required | bcrypt hash (cost 12) |
| `role` | String | Default: `viewer` | One of: `admin`, `operator`, `viewer` |
| `createdAt` | DateTime | Default: now | Account creation timestamp |
| `updatedAt` | DateTime | Auto-update | Last modification timestamp |

#### Node

Stores registered dawos-agent instances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `name` | String | Unique, required | Human-readable node name |
| `url` | String | Required | dawos-agent base URL (e.g., `http://192.168.1.100:8470`) |
| `apiKey` | String | Required | Encrypted API key (AES-256-GCM ciphertext) |
| `location` | String | Optional | Physical location description |
| `status` | String | Default: `unknown` | One of: `online`, `offline`, `degraded`, `unknown` |
| `lastSeen` | DateTime | Optional | Last successful health check timestamp |
| `createdAt` | DateTime | Default: now | Registration timestamp |
| `updatedAt` | DateTime | Auto-update | Last modification timestamp |

#### AuditLog

Append-only log of management actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `userId` | String | Foreign key -> User | Who performed the action |
| `nodeId` | String | Foreign key -> Node, optional | Target node (if applicable) |
| `action` | String | Required | Action type (e.g., `node.create`, `session.terminate`) |
| `detail` | String | Optional | JSON-encoded context |
| `createdAt` | DateTime | Default: now | Timestamp |

Indexes on `userId`, `nodeId`, and `createdAt` for efficient querying.

#### Session

Browser session tokens for NextAuth.js.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `sessionToken` | String | Unique | JWT session identifier |
| `userId` | String | Foreign key -> User | Session owner |
| `expires` | DateTime | Required | Expiration timestamp |

#### Setting

Key-value store for application configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | String | Primary key | Setting name |
| `value` | String | Required | Setting value |

#### AlertRule

Threshold-based monitoring rules.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `name` | String | Required | Rule display name |
| `metric` | String | Required | Metric to monitor |
| `operator` | String | Required | Comparison operator |
| `threshold` | Float | Required | Threshold value |
| `nodeId` | String | Foreign key -> Node, optional | Target node (null = all nodes) |
| `enabled` | Boolean | Default: true | Whether the rule is active |
| `createdAt` | DateTime | Default: now | Creation timestamp |
| `updatedAt` | DateTime | Auto-update | Last modification timestamp |

#### AlertEvent

Recorded alert trigger events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | Primary key, CUID | Unique identifier |
| `ruleId` | String | Foreign key -> AlertRule | Which rule triggered |
| `nodeId` | String | Foreign key -> Node | Which node triggered |
| `value` | Float | Required | Actual metric value at trigger time |
| `createdAt` | DateTime | Default: now | Trigger timestamp |

---

## Prisma 7 Configuration

dawu-manager uses Prisma 7 with the libsql driver adapter. This differs from earlier Prisma versions in several ways:

### Configuration File

Prisma 7 uses `prisma.config.ts` (TypeScript) instead of the traditional `url` field in `schema.prisma`:

```typescript
// prisma/prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "./schema.prisma",
});
```

### Client Initialization

The Prisma client is initialized with the libsql adapter in `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSQL({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

### No `url` in Datasource Block

The `datasource` block in `schema.prisma` does not include a `url` field. The database URL is passed through the adapter at runtime:

```prisma
datasource db {
  provider = "sqlite"
}
```

---

## Database Locations

The SQLite database file is stored at different paths depending on the deployment method:

| Deployment | Path | Notes |
|------------|------|-------|
| Development | `./prisma/dev.db` | Local to the project directory |
| npx | `~/.dawu-manager/data.db` | In the user's home directory |
| Docker | `/data/dawu.db` | In the mounted volume |
| systemd | `/var/lib/dawu-manager/data.db` | In the service data directory |

---

## Migrations

Database migrations are managed by Prisma:

```bash
# Development: create and apply migrations
pnpm exec prisma migrate dev --name description

# Production: apply pending migrations
pnpm exec prisma migrate deploy
```

In Docker and npx deployments, migrations are applied automatically on startup before the server begins accepting requests.

---

## Backup and Recovery

SQLite databases are single files. Backup is a file copy operation:

```bash
cp /var/lib/dawu-manager/data.db /var/lib/dawu-manager/data.db.bak
```

!!! warning "Backup while running"
    SQLite supports safe concurrent reads, but copying the file while a write is in progress could result in a corrupted backup. For guaranteed consistency, stop the service before copying, or use `sqlite3 data.db ".backup backup.db"` which uses SQLite's built-in online backup API.

---

## Performance Characteristics

| Operation | Typical Latency |
|-----------|----------------|
| Read (single record) | < 1 ms |
| Write (single record) | 1-5 ms |
| List with pagination | 1-10 ms |
| Audit log insert | 1-3 ms |

SQLite uses file-level locking for writes. Concurrent reads are unlimited. Write operations are serialized, but individual writes are fast enough that this is not a bottleneck for dawu-manager's workload.

For deployments managing up to 100 BNG nodes with 10 concurrent operators, SQLite provides more than adequate performance.
