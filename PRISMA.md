# Prisma Database Setup

## Overview

This project uses [Prisma](https://www.prisma.io/) as an ORM for type-safe database access to PostgreSQL.

## Data Models

### Tenant
Represents a customer or organization using the system.

```prisma
model Tenant {
  id        String @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  
  cameras Camera[]
  events  Event[]
}
```

- **id**: Unique identifier (CUID)
- **name**: Tenant name
- **createdAt**: Creation timestamp
- **cameras**: Relation to Camera records
- **events**: Relation to Event records

### Camera
Represents a Frigate camera monitored by the system.

```prisma
model Camera {
  id          String @id @default(cuid())
  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  key         String // Frigate camera name
  label       String?
  createdAt   DateTime @default(now())
  
  events Event[]
}
```

- **id**: Unique identifier (CUID)
- **tenantId**: Foreign key to Tenant
- **tenant**: Relation to parent Tenant
- **key**: Frigate camera name/identifier (unique per tenant)
- **label**: Optional human-readable label
- **createdAt**: Creation timestamp
- **events**: Relation to Event records
- **Unique constraint**: `(tenantId, key)` - One camera key per tenant

### Event
Represents a detected event from Frigate (e.g., person detection, car detection).

```prisma
model Event {
  id         String @id @default(cuid())
  tenantId   String
  tenant     Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  cameraId   String
  camera     Camera @relation(fields: [cameraId], references: [id], onDelete: Cascade)
  frigateId  String // event_id from MQTT
  type       String
  label      String?
  hasSnapshot Boolean @default(false)
  hasClip     Boolean @default(false)
  startTime   Float?
  endTime     Float?
  rawPayload  Json
  createdAt   DateTime @default(now())

  @@unique([tenantId, frigateId])
  @@index([tenantId])
  @@index([cameraId])
  @@index([createdAt])
}
```

- **id**: Unique identifier (CUID)
- **tenantId**: Foreign key to Tenant
- **tenant**: Relation to parent Tenant
- **cameraId**: Foreign key to Camera
- **camera**: Relation to parent Camera
- **frigateId**: Frigate event ID from MQTT payload
- **type**: Event type (e.g., "person", "car", "dog")
- **label**: Optional human-readable label
- **hasSnapshot**: Whether a snapshot was captured
- **hasClip**: Whether a video clip was captured
- **startTime**: Event start timestamp (Unix time)
- **endTime**: Event end timestamp (Unix time)
- **rawPayload**: Full event payload as JSON
- **createdAt**: When the event was created in our system
- **Unique constraint**: `(tenantId, frigateId)` - Prevent duplicate events
- **Indexes**: `tenantId`, `cameraId`, `createdAt` for query performance

## Setup

### 1. Initialize Prisma

Prisma is already initialized and configured. The schema is located at `prisma/schema.prisma`.

### 2. Environment Variables

Ensure `POSTGRES_URL` is set in your `.env` file:

```bash
POSTGRES_URL=postgres://user:password@localhost:5432/ingestor
```

### 3. Database Migrations

Create and run migrations:

```bash
# Create a new migration
npm run prisma:migrate

# Or push schema to database without migrations (development only)
npm run db:push
```

### 4. Generate Client

The Prisma Client is automatically generated from the schema:

```bash
npm run prisma:generate
```

This creates types and the query client in `node_modules/@prisma/client`.

## Usage

### Importing Prisma Client

```typescript
// Use the singleton instance
import { prisma, connectDatabase, disconnectDatabase } from './src/db/client.js';

// Connect at startup
await connectDatabase();

// Use in queries
const user = await prisma.tenant.findUnique({
  where: { id: 'tenant-id' },
  include: { cameras: true }
});

// Disconnect at shutdown
await disconnectDatabase();
```

### Using the Database Service

```typescript
import { dbService } from './src/db/service.js';

// Create a tenant
const tenant = await dbService.createTenant('My Organization');

// Create a camera
const camera = await dbService.createCamera(tenant.id, 'front-door', 'Front Door');

// Create an event
const event = await dbService.createEvent(
  tenant.id,
  camera.id,
  'frigate-event-123',
  'person',
  { /* raw payload from MQTT */ },
  'Person detected',
  true,  // hasSnapshot
  false, // hasClip
  1670000000.5,
  1670000010.5
);

// Query events
const recentEvents = await dbService.getEventsByTenant(tenant.id, 50);
```

## Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create a migration
npm run prisma:migrate

# Open Prisma Studio (GUI database explorer)
npm run prisma:studio

# Push schema to database (development)
npm run db:push
```

## Development

### Prisma Studio

Explore and edit your database data with a visual interface:

```bash
npm run prisma:studio
```

This opens a browser interface at `http://localhost:5555` where you can view and manage all data.

### Logging

In development, Prisma logs queries and warnings:

```typescript
// Set in client.ts
log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
```

## Cascading Deletes

All foreign keys use `onDelete: Cascade` to automatically clean up related records:

- Deleting a Tenant automatically deletes all its Cameras and Events
- Deleting a Camera automatically deletes all its Events

## Performance Considerations

- **Indexes**: Created on `tenantId`, `cameraId`, and `createdAt` in Events table for fast queries
- **Unique constraints**: Prevent duplicate cameras per tenant and duplicate events per tenant
- **Connection pooling**: Prisma automatically manages connection pooling
- **Singleton pattern**: Only one PrismaClient instance throughout the application

## Troubleshooting

### "Cannot find module '@prisma/client'"

Run `npm install` to install dependencies.

### "Connection refused" error

Check that PostgreSQL is running and the `POSTGRES_URL` is correct.

### Schema changes not reflected in generated code

Run `npm run prisma:generate` to regenerate the Prisma Client.

### Database is out of sync with schema

Run `npm run db:push` to update the database to match your schema.

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Data Model](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model)
