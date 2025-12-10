# 🚀 QUICK START - INGESTOR SERVICE

## Your Service is Running! ✅

```
docker compose ps
→ ingestor-db   ✅ UP (healthy)
→ ingestor-app  ✅ UP (running)
```

---

## Essential Commands

### Start
```bash
docker compose up -d
```

### Stop
```bash
docker compose stop
```

### View Logs
```bash
docker compose logs -f
```

### Access Database
```bash
docker compose exec postgres psql -U postgres -d ingestor
```

### Open Prisma GUI
```bash
docker compose exec ingestor-app npm run prisma:studio
```

### Reset Everything
```bash
docker compose down -v && docker compose up -d --build
```

---

## Service Endpoints

- **App**: http://localhost:3000
- **Database**: localhost:5432
- **Prisma Studio**: http://localhost:5555 (when running)

---

## File Structure

```
src/
├── index.ts                    Main entry point
├── config/env.ts              Configuration
└── db/
    ├── client.ts              Database connection
    ├── service.ts             Database operations
    └── types.ts               Type docs

prisma/
└── schema.prisma              Database schema (Tenant, Camera, Event)
```

---

## Database Access

```bash
# From local machine
psql -h localhost -p 5432 -U postgres -d ingestor

# From inside container
docker compose exec postgres psql -U postgres -d ingestor

# Default password: postgres
```

---

## Hot Reload Development

```bash
# Terminal 1: Watch logs
docker compose logs -f ingestor-app

# Terminal 2: Edit code (changes auto-reload)
vim src/mqtt/MqttClient.ts
```

---

## Common Tasks

### Build TypeScript
```bash
docker compose exec ingestor-app npm run build
```

### Lint Code
```bash
docker compose exec ingestor-app npm run lint
```

### Format Code
```bash
docker compose exec ingestor-app npm run format
```

### Run Command in App
```bash
docker compose exec ingestor-app npm run <script>
```

### Check Node Version
```bash
docker compose exec ingestor-app node --version
```

---

## Next: MQTT Integration

1. Edit `src/mqtt/MqttClient.ts`
2. Implement MQTT connection
3. Parse Frigate events
4. Save to database with `dbService`

Example:
```typescript
import { dbService } from '../db/service.js';

async function onMessage(topic, payload) {
  const event = JSON.parse(payload.toString());
  await dbService.createEvent(
    event.tenantId,
    event.cameraId,
    event.frigateId,
    event.type,
    event.rawPayload
  );
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 5432 in use | Change in docker-compose.yml |
| Port 3000 in use | Change in docker-compose.yml |
| App won't start | `docker compose logs ingestor-app` |
| Database error | `docker compose logs postgres` |
| Need clean start | `docker compose down -v && docker compose up -d` |

---

## Documentation Files

- `START_HERE.md` - Full setup guide
- `DOCKER_RUNNING.md` - Current status & verification
- `DOCKER_FIX_SUMMARY.md` - What was fixed
- `DOCKER.md` - Detailed Docker guide
- `PRISMA_REFERENCE.md` - Database queries
- `✅_COMPLETE.md` - Setup completion summary

---

**Status**: ✅ Ready | **Date**: Dec 9, 2025 | **Next**: Implement MQTT
