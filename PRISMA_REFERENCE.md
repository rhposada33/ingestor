# Prisma Quick Reference Card

## 🚀 Quick Commands

```bash
# Setup
npm install
npm run prisma:generate

# Database
npm run db:push                    # Create tables
npm run prisma:migrate             # Create migration
npm run prisma:studio              # Open GUI

# Development
npm run dev                        # Start app
npm run lint                       # Check code
npm run format                     # Format code
```

## 💾 Common Database Operations

### Query Single Record
```typescript
import { prisma } from './src/db/client.js';

const tenant = await prisma.tenant.findUnique({
  where: { id: 'tenant-123' }
});
```

### Query Multiple Records
```typescript
const events = await prisma.event.findMany({
  where: { cameraId: 'camera-123' },
  orderBy: { createdAt: 'desc' },
  take: 100
});
```

### Create Record
```typescript
const event = await prisma.event.create({
  data: {
    tenantId: 'tenant-123',
    cameraId: 'camera-123',
    frigateId: 'frigate-event-123',
    type: 'person',
    rawPayload: { /* data */ }
  }
});
```

### Update Record
```typescript
const updated = await prisma.event.update({
  where: { id: 'event-123' },
  data: { label: 'VIP Detection' }
});
```

### Delete Record
```typescript
await prisma.event.delete({
  where: { id: 'event-123' }
});
```

## 📋 Using DatabaseService

```typescript
import { dbService } from './src/db/service.js';

// Tenants
const tenant = await dbService.createTenant('ACME Corp');
const t = await dbService.getTenant('tenant-123');

// Cameras
const camera = await dbService.createCamera('tenant-123', 'front-door');
const cams = await dbService.getCamerasByTenant('tenant-123');

// Events
const event = await dbService.createEvent(
  'tenant-123',
  'camera-123',
  'frigate-event-123',
  'person',
  { /* payload */ }
);
const recent = await dbService.getEventsByTenant('tenant-123', 50);
```

## 🔗 Relations

### Include Related Records
```typescript
const event = await prisma.event.findUnique({
  where: { id: 'event-123' },
  include: {
    tenant: true,    // Include parent tenant
    camera: true     // Include parent camera
  }
});
// Access: event.tenant.name, event.camera.label
```

### Nested Queries
```typescript
const tenantWithAll = await prisma.tenant.findUnique({
  where: { id: 'tenant-123' },
  include: {
    cameras: {
      include: {
        events: { take: 10 }  // Last 10 events per camera
      }
    }
  }
});
```

## 🔍 Filtering

### Simple Filters
```typescript
// Exact match
await prisma.event.findMany({
  where: { type: 'person' }
});

// Multiple conditions (AND)
await prisma.event.findMany({
  where: {
    type: 'person',
    cameraId: 'camera-123'
  }
});
```

### Advanced Filters
```typescript
// OR conditions
await prisma.event.findMany({
  where: {
    OR: [
      { type: 'person' },
      { type: 'car' }
    ]
  }
});

// NOT condition
await prisma.event.findMany({
  where: {
    NOT: { type: 'unknown' }
  }
});
```

## 📊 Pagination & Sorting

```typescript
const events = await prisma.event.findMany({
  where: { cameraId: 'camera-123' },
  orderBy: { createdAt: 'desc' },  // Sort
  skip: 0,                          // Offset
  take: 100                         // Limit
});
```

## 🔄 Transactions

```typescript
const [event, updatedCamera] = await prisma.$transaction([
  prisma.event.create({
    data: { /* ... */ }
  }),
  prisma.camera.update({
    where: { id: 'camera-123' },
    data: { /* ... */ }
  })
]);
```

## 🆔 ID Generation

IDs are automatically generated as CUID:
```typescript
// No need to generate IDs manually
const event = await prisma.event.create({
  data: {
    // id is auto-generated
    tenantId: 'tenant-123',
    // ...
  }
});
// event.id is now set
```

## 🗂️ Type Safety

```typescript
import type { Tenant, Camera, Event } from '@prisma/client';

async function processEvent(event: Event) {
  console.log(event.id);        // ✅ Known to be string
  console.log(event.type);      // ✅ Known to be string
  console.log(event.startTime); // ✅ Known to be number | null
}
```

## 📍 Model Reference

| Model | Table | Key Fields |
|-------|-------|-----------|
| Tenant | tenants | id, name, createdAt |
| Camera | cameras | id, tenantId, key, label, createdAt |
| Event | events | id, tenantId, cameraId, frigateId, type, rawPayload, createdAt |

## ⚠️ Important Notes

- **Cascading deletes**: Deleting Tenant removes all Cameras and Events
- **Unique constraints**: 
  - One camera `key` per tenant
  - One `frigateId` per tenant
- **Indexes**: Created on `tenantId`, `cameraId`, `createdAt` for performance
- **Singleton**: Only one Prisma instance per process

## 🐛 Debugging

### View Query Logs
```bash
# Already enabled in development
# Check console for SQL queries
```

### Open Prisma Studio
```bash
npm run prisma:studio
# Opens http://localhost:5555
```

### Check Schema
```bash
cat prisma/schema.prisma
```

## 🚨 Common Errors

| Error | Solution |
|-------|----------|
| `Cannot find module '@prisma/client'` | Run `npm install` |
| `Connection refused` | Check `POSTGRES_URL` and PostgreSQL is running |
| `Type 'Event' not found` | Run `npm run prisma:generate` |
| `Unique constraint failed` | Record already exists with that value |

## 📚 More Info

- Detailed guide: `PRISMA.md`
- Setup steps: `PRISMA_QUICKSTART.md`
- Implementation: `PRISMA_SETUP.md`
- File list: `PRISMA_FILES.md`

---

**Last Updated**: Dec 9, 2025 | **Status**: ✅ Ready for Use
