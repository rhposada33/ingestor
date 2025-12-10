# Ingestion Loop - Quick Reference

## File: `src/index.ts` (235 lines)

Complete entry point with 6-step orchestration: Config → DB → MQTT → Handlers → Shutdown → Running

## 6-Step Process

### Step 1: Load Configuration
```typescript
const envConfig = getConfig();
const configManager = ConfigManager.getInstance(envConfig);
const config = configManager.getConfig();
```
✓ Validates all environment variables
✓ Provides typed config object

### Step 2: Connect to PostgreSQL
```typescript
await connectDatabase();
```
✓ Establishes Prisma connection
✓ Ready for CRUD operations

### Step 3: Initialize MQTT
```typescript
await initializeMqttSubsystem();
```
✓ Connects to broker
✓ Subscribes to Frigate topics
✓ ingestorBus ready to emit events

### Step 4: Attach Event Handlers

#### Detection Events
```typescript
ingestorBus.onFrigateEvent(async (rawEvent: FrigateEvent) => {
  const normalized = normalizeMessage(rawEvent, `frigate/${rawEvent.after.camera}/events`);
  if (!normalized || !('hasSnapshot' in normalized)) return;
  const result = await handleFrigateEvent(normalized);
  if (result.success) console.log('✓ Event persisted');
});
```

#### Review Events
```typescript
ingestorBus.onFrigateReview(async (rawReview: FrigateReview) => {
  const normalized = normalizeMessage(rawReview, `frigate/${rawReview.camera}/reviews`);
  if (!normalized || !('reviewId' in normalized)) return;
  const result = await handleFrigateReview(normalized);
  if (result.success) console.log('✓ Review persisted');
});
```

### Step 5: Graceful Shutdown

Handlers registered for:
- `SIGINT` (Ctrl+C)
- `SIGTERM` (process termination)
- `uncaughtException` (sync errors)
- `unhandledRejection` (promise errors)

Shutdown sequence:
1. Set isShuttingDown flag
2. Unsubscribe & disconnect MQTT
3. Close database connection
4. Exit cleanly

### Step 6: Running

Service waits for signals and processes messages:
- MQTT messages arrive
- Event listeners normalize
- Handlers persist to DB
- Logs printed in real-time
- Graceful shutdown on signal

## Key Design Patterns

### Type Guards
Use `in` operator to discriminate union types:
```typescript
if (!('hasSnapshot' in normalized)) {
  console.warn('Not an event');
  return;
}
```

### Error Handling
Every handler wrapped in try/catch:
```typescript
try {
  // ... handler logic
} catch (error) {
  console.error('❌ Unexpected error:', error);
}
```

### Graceful Degradation
Failed events don't crash service:
```typescript
if (!normalized) {
  console.warn('Failed to normalize');
  return; // Skip this event, continue
}
```

### Idempotent Persistence
Handlers use upsert pattern:
```typescript
const result = await handleFrigateEvent(normalized);
// Safe to retry with same data
```

## Environment Variables

```bash
MQTT_BROKER_URL=mqtt://mosquitto:1883
POSTGRES_URL=postgresql://user:pass@postgres:5432/db
LOG_LEVEL=info
NODE_ENV=production
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker-compose up -d
docker logs -f ingestor-app
```

## Logs Output

### Startup
```
🚀 Frigate Event Ingestor Starting...
📋 Loading configuration...
🗄️  Connecting to PostgreSQL...
🔌 Initializing MQTT subsystem...
⚡ Setting up event handlers...
✅ Ingestor Service Running Successfully
```

### Processing
```
✓ Event persisted { eventId: 'abc123', camera: 'cam-1', type: 'end' }
✓ Review persisted { reviewId: 'xyz789', camera: 'cam-1', severity: 'detection' }
⚠️  Failed to normalize Frigate event: ...
❌ Unexpected error in event handler: ...
```

### Shutdown
```
⏹️  SIGINT received - Gracefully shutting down...
🔌 Disconnecting from MQTT...
🗄️  Closing database connection...
✅ Ingestor Service Shutdown Complete
```

## Status Codes

- Exit 0: Successful shutdown or completion
- Exit 1: Startup failed or shutdown error
- SIGINT (Ctrl+C): Signal received, initiating shutdown
- SIGTERM: Termination signal, initiating shutdown

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Config validation fails | Exit 1 immediately |
| Database connect fails | Exit 1 after cleanup |
| MQTT connect fails | Exit 1 after cleanup |
| Event normalize fails | Skip event, log warning |
| Handler throws error | Catch, log, continue |
| DB operation fails | Log failure, continue |
| Process crash | Catch, graceful shutdown, exit 1 |

## File Structure

```
src/
├── index.ts                 # Main entry point (235 lines)
├── config/
│   ├── env.ts              # Env validation
│   └── ConfigManager.ts    # Config management
├── db/
│   ├── client.ts           # Prisma connection
│   └── service.ts          # DB operations
├── mqtt/
│   ├── client.ts           # MQTT connection
│   ├── bus.ts              # Event bus (ingestorBus)
│   ├── subscriber.ts       # Topic subscriptions
│   ├── normalize.ts        # Message normalization
│   └── index.ts            # MQTT subsystem exports
└── ingest/
    └── handler.ts          # Event handlers (589 lines)

docs/
├── INGESTION_LOOP_GUIDE.md (comprehensive)
├── INGESTION_LOOP_QUICK_REF.md (this file)
├── MQTT_NORMALIZATION_GUIDE.md
└── MQTT_NORMALIZATION_QUICK_REF.md
```

## Data Flow Summary

```
MQTT Broker
    ↓
subscriber.ts (topic handler)
    ↓
ingestorBus.emit('frigate:event' | 'frigate:review')
    ↓
index.ts (event listeners)
    ├─ normalizeMessage() → typed object
    ├─ Type guard check
    ├─ handleFrigateEvent() or handleFrigateReview()
    │   ├─ resolveCameraByName()
    │   ├─ Auto-create tenant/camera if needed
    │   └─ Upsert to database
    └─ Log result
```

## Next Steps

1. ✅ Environment configured
2. ✅ Database connected
3. ✅ MQTT subsystem initialized
4. ✅ Event handlers attached
5. ✅ Graceful shutdown registered
6. ⏭️ Start service: `npm run dev` or `docker-compose up`
7. ⏭️ Monitor logs for events
8. ⏭️ Add metrics/monitoring (future)
9. ⏭️ Add Review model to schema (future)
10. ⏭️ Add dead-letter queue for failures (future)

## Testing the Ingestion Loop

### 1. Start Services
```bash
docker-compose up -d
```

### 2. Check Service Status
```bash
docker logs -f ingestor-app
```

### 3. Publish Test Event
```bash
mosquitto_pub -h localhost -t "frigate/test-camera/events/new/1734000000" -m '{
  "before": {"id":"event1","camera":"test-camera","frame_time":1734000000,"label":"person","top_score":0.95,"false_positive":false,"start_time":1733999900,"end_time":null},
  "after": {"id":"event1","camera":"test-camera","frame_time":1734000000,"label":"person","top_score":0.95,"false_positive":false,"start_time":1733999900,"end_time":null},
  "type":"new"
}'
```

### 4. Verify in Logs
```
✓ Event persisted { eventId: 'event1', camera: 'test-camera', type: 'new' }
```

### 5. Query Database
```bash
psql -h localhost -U frigate -d frigate_db -c "SELECT * FROM events ORDER BY created_at DESC LIMIT 5;"
```

## Troubleshooting

### Service won't start
- Check .env file exists and is valid
- Verify POSTGRES_URL points to running database
- Verify MQTT_BROKER_URL is accessible

### No events appear in database
- Check logs for "Failed to normalize"
- Verify MQTT topic matches: `frigate/<camera>/events`
- Ensure message is valid JSON

### Database connection fails
- Check PostgreSQL is running: `docker ps | grep postgres`
- Verify credentials in .env
- Check database exists: `createdb frigate_db`

### MQTT connection fails
- Check MQTT broker is running: `docker ps | grep mosquitto`
- Verify MQTT_BROKER_URL is correct
- Check broker logs: `docker logs mosquitto`

### Service crashes
- Check logs for uncaught exceptions
- Verify all required dependencies installed
- Check Node.js version (should be 20+)

## Related Documentation

- [MQTT Integration Guide](./MQTT_INTEGRATION_HANDLER_GUIDE.md) (coming)
- [MQTT Normalization Guide](./MQTT_NORMALIZATION_GUIDE.md)
- [Database Schema](../prisma/schema.prisma)
- [Event Handler Implementation](./src/ingest/handler.ts)
