# Prisma Quick Start

## 1️⃣ Setup Database URL

Make sure `POSTGRES_URL` is set in your `.env`:

```bash
POSTGRES_URL=postgres://username:password@localhost:5432/ingestor_db
```

## 2️⃣ Push Schema to Database

Create the tables in your PostgreSQL database:

```bash
npm run db:push
```

Or with migrations (recommended for production):

```bash
npm run prisma:migrate -- --name "init"
```

## 3️⃣ Verify Connection

The app will automatically test the connection on startup:

```bash
npm run dev
```

You should see:
```
✅ Database connected successfully
```

## 4️⃣ Use in Your Code

```typescript
import { dbService } from './src/db/service.js';

// Create a tenant
const tenant = await dbService.createTenant('My Organization');

// Create a camera
const camera = await dbService.createCamera(
  tenant.id,
  'living_room',
  'Living Room'
);

// Create an event from MQTT message
const event = await dbService.createEvent(
  tenant.id,
  camera.id,
  'frigate-event-abc123',
  'person',
  { /* mqtt payload */ }
);

// Query recent events
const recent = await dbService.getEventsByCamera(camera.id, 100);
```

## 5️⃣ Explore Data (Optional)

Open Prisma Studio to browse/edit your database:

```bash
npm run prisma:studio
```

Then open http://localhost:5555

## 📚 Common Tasks

### View Schema
```bash
cat prisma/schema.prisma
```

### Regenerate Client
```bash
npm run prisma:generate
```

### Create Migration
```bash
npm run prisma:migrate -- --name "add_something"
```

### Reset Database (Dev Only!)
```bash
npx prisma migrate reset
```

## 🔗 Resources

- Full docs: See `PRISMA.md`
- Data models: `prisma/schema.prisma`
- Client singleton: `src/db/client.ts`
- Service methods: `src/db/service.ts`
- Type hints: `src/db/types.ts`

## ✅ You're Ready!

The database is now set up with:
- ✅ Tenant model (multi-tenancy)
- ✅ Camera model (linked to Frigate)
- ✅ Event model (detection events)
- ✅ Type-safe database client
- ✅ Service layer for common operations
- ✅ Singleton connection management
- ✅ Automatic logging in development
