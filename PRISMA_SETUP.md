# Prisma Integration Summary

## ✅ What Was Added

### 1. Dependencies
Added to `package.json`:
- `@prisma/client@^5.7.0` - Production ORM client
- `prisma@^5.7.0` - Development toolkit

### 2. NPM Scripts
```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Create and run migrations
npm run prisma:studio    # Open Prisma Studio (GUI)
npm run db:push          # Push schema to database
```

### 3. Data Models (prisma/schema.prisma)

#### Tenant Model
- **id**: CUID primary key
- **name**: String (tenant name)
- **createdAt**: Timestamp
- Relations: One-to-many with Camera and Event

#### Camera Model
- **id**: CUID primary key
- **tenantId**: Foreign key to Tenant
- **key**: String (Frigate camera identifier)
- **label**: Optional string
- **createdAt**: Timestamp
- Relations: Many-to-one with Tenant, One-to-many with Event
- **Constraints**: Unique `(tenantId, key)` - one key per tenant
- **Cascade delete**: Deleting Tenant removes all Cameras

#### Event Model
- **id**: CUID primary key
- **tenantId**: Foreign key to Tenant
- **cameraId**: Foreign key to Camera
- **frigateId**: String (event_id from MQTT)
- **type**: String (detection type: person, car, etc.)
- **label**: Optional string
- **hasSnapshot**: Boolean (default: false)
- **hasClip**: Boolean (default: false)
- **startTime**: Optional Float (Unix timestamp)
- **endTime**: Optional Float (Unix timestamp)
- **rawPayload**: JSON (full MQTT payload)
- **createdAt**: Timestamp
- Relations: Many-to-one with Tenant and Camera
- **Constraints**: 
  - Unique `(tenantId, frigateId)` - prevent duplicates
  - Indexes on `tenantId`, `cameraId`, `createdAt` for performance
- **Cascade delete**: Deleting Tenant or Camera removes all related Events

### 4. Database Client (src/db/client.ts)

```typescript
// Singleton instance
export const prisma: PrismaClient

// Connection management
export async function connectDatabase(): Promise<void>
export async function disconnectDatabase(): Promise<void>
```

**Features:**
- Singleton pattern to prevent connection pool exhaustion
- Automatic logging in development (queries, errors, warnings)
- Error logging in production (errors only)
- Global instance caching to reuse across modules

### 5. Database Service (src/db/service.ts)

Type-safe database operations:

```typescript
// Tenant operations
await dbService.createTenant(name)
await dbService.getTenant(id)

// Camera operations
await dbService.createCamera(tenantId, key, label?)
await dbService.getCamera(id)
await dbService.getCamerasByTenant(tenantId)

// Event operations
await dbService.createEvent(tenantId, cameraId, frigateId, type, rawPayload, ...)
await dbService.getEvent(id)
await dbService.getEventsByCamera(cameraId, limit?)
await dbService.getEventsByTenant(tenantId, limit?)
await dbService.updateEvent(id, data)
```

### 6. Integration with Startup

Updated `src/index.ts` to:
- Connect to database on startup: `await connectDatabase()`
- Disconnect gracefully on shutdown: `await disconnectDatabase()`
- Handle connection errors

### 7. Documentation

- `PRISMA.md` - Comprehensive Prisma setup guide with examples
- Inline comments in schema and code

## 🏗️ Project Structure

```
ingestor/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── db/
│   │   ├── client.ts           # Singleton Prisma instance
│   │   ├── service.ts          # Business logic services
│   │   ├── Database.ts         # Legacy (can be replaced)
│   │   └── migrations.ts       # Legacy (can be removed)
│   ├── config/
│   │   ├── ConfigManager.ts
│   │   └── env.ts
│   ├── mqtt/
│   ├── index.ts                # Application entrypoint
│   └── ...
├── package.json                # Updated with Prisma
├── tsconfig.json
├── PRISMA.md                   # Documentation
└── .env                        # Includes POSTGRES_URL
```

## 🚀 Usage Example

```typescript
import { prisma, connectDatabase } from './src/db/client.js';
import { dbService } from './src/db/service.js';

// At startup
await connectDatabase();

// Create data
const tenant = await dbService.createTenant('ACME Corp');
const camera = await dbService.createCamera(
  tenant.id,
  'front-door',
  'Front Door Camera'
);

// Query data with relations
const cameraWithTenant = await prisma.camera.findUnique({
  where: { id: camera.id },
  include: { tenant: true, events: true }
});

// Complex queries
const recentPersonDetections = await prisma.event.findMany({
  where: {
    cameraId: camera.id,
    type: 'person'
  },
  orderBy: { createdAt: 'desc' },
  take: 100
});

// At shutdown
await disconnectDatabase();
```

## 📊 Key Design Decisions

1. **Multi-tenancy**: All models include `tenantId` for data isolation
2. **Cascading deletes**: Maintains data integrity automatically
3. **Unique constraints**: Prevents duplicate cameras and events
4. **Indexes**: Optimized for common queries (by tenant, camera, time)
5. **JSON payload**: Stores raw MQTT data for debugging and auditing
6. **Timestamps**: All records track creation time
7. **Singleton pattern**: Ensures single database connection throughout app

## ✨ Next Steps

1. **Create migrations**: Run `npm run prisma:migrate` to set up database
2. **Test connection**: Verify database connection with `.env` configured
3. **Implement MQTT handlers**: Use `dbService` to persist events
4. **Add validation**: Enhance service methods with input validation
5. **Add indexes**: Consider additional indexes based on query patterns

## 🔧 Troubleshooting

**Can't connect to database?**
- Check `POSTGRES_URL` in `.env`
- Verify PostgreSQL is running
- Check network connectivity

**Type errors in IDE?**
- Run `npm run prisma:generate`
- Restart TypeScript language server (Ctrl+Shift+P → "Restart TypeScript")

**Schema out of sync?**
- Run `npm run prisma:migrate create --name description` for migrations
- Or `npm run db:push` for development (destructive)

**Want to explore data visually?**
- Run `npm run prisma:studio` and open `http://localhost:5555`
