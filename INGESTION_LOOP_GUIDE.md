# Frigate Event Ingestion Loop - Complete Guide

## Overview

The ingestion loop in `src/index.ts` is the main entry point of the ingestor application. It orchestrates the complete pipeline from MQTT message reception to database persistence.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Load Environment & Configuration                  │
│  • dotenv.config() loads .env file                         │
│  • getConfig() validates required env vars                 │
│  • ConfigManager provides typed config access              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Connect to PostgreSQL via Prisma                   │
│  • connectDatabase() establishes connection                │
│  • Validates schema (Tenant, Camera, Event models)         │
│  • Enables database operations in handlers                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Initialize MQTT Subsystem                          │
│  • connectMqtt() connects to broker                        │
│  • subscribeToFrigateEvents() subscribes to topics:        │
│    - frigate/+/events (detection events)                   │
│    - frigate/+/reviews (review events)                     │
│    - frigate/+/available (availability status)             │
│  • Sets up internal MQTT event handlers                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Attach Ingestion Handlers to Bus Events            │
│                                                             │
│  ingestorBus.onFrigateEvent(async (rawEvent) => {         │
│    1. Normalize raw event via normalizeMessage()          │
│    2. Type-guard: ensure it's an event (has snapshot)     │
│    3. Persist via handleFrigateEvent(normalized)          │
│    4. Log success/failure                                 │
│  })                                                        │
│                                                             │
│  ingestorBus.onFrigateReview(async (rawReview) => {       │
│    1. Normalize raw review via normalizeMessage()         │
│    2. Type-guard: ensure it's a review (has reviewId)     │
│    3. Persist via handleFrigateReview(normalized)         │
│    4. Log success/failure                                 │
│  })                                                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Register Graceful Shutdown Handlers                │
│  • SIGINT (Ctrl+C)                                         │
│  • SIGTERM (process termination)                           │
│  • uncaughtException                                       │
│  • unhandledRejection                                      │
│                                                             │
│  Shutdown sequence:                                        │
│    1. Set isShuttingDown flag (prevent duplicate calls)   │
│    2. Unsubscribe from MQTT topics                        │
│    3. Disconnect from MQTT broker                         │
│    4. Close database connection                           │
│    5. Exit process                                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Service Running                                    │
│  • Waits for MQTT messages on subscribed topics            │
│  • Processes events through normalized handlers            │
│  • Logs status and errors                                  │
│  • Awaits termination signal                               │
└─────────────────────────────────────────────────────────────┘
```

## Runtime Message Flow

When an MQTT message arrives on a Frigate topic:

```
MQTT Broker
    │
    ├─ frigate/<name>/events/+/#
    │       │
    │       ▼
    │   subscriber.ts onMessage() handler
    │       │
    │       ├─ Parse JSON payload
    │       │
    │       └─ Emit to ingestorBus
    │               │
    │               ▼
    │       ingestorBus.emit('frigate:event', rawEvent)
    │               │
    │               ▼
    │       src/index.ts event listener
    │               │
    │               ├─ normalizeMessage(rawEvent, topic)
    │               │       │
    │               │       └─ Returns NormalizedFrigateEvent | null
    │               │
    │               ├─ Type guard (check 'hasSnapshot' in normalized)
    │               │
    │               ├─ handleFrigateEvent(normalized)
    │               │       │
    │               │       ├─ Resolve camera by name
    │               │       ├─ Auto-create tenant/camera if needed
    │               │       ├─ Upsert event to database
    │               │       └─ Return PersistedEvent
    │               │
    │               └─ Log result (success/failure)
    │
    └─ frigate/<name>/reviews
            │
            ▼
        Similar flow for reviews
```

## Key Components

### 1. Configuration Loading (`src/config/`)
- **Input**: Environment variables (`.env` file)
- **Output**: Typed ConfigManager instance
- **Validates**: MQTT_BROKER_URL, POSTGRES_URL, LOG_LEVEL, NODE_ENV
- **Throws**: If required vars are missing

### 2. Database Connection (`src/db/client.ts`)
- **Function**: `connectDatabase()`
- **Effect**: Establishes Prisma connection to PostgreSQL
- **Validates**: Can execute queries (internal check)
- **Status**: Ready for CRUD operations

### 3. MQTT Subsystem (`src/mqtt/`)
- **Initialization**: `initializeMqttSubsystem()`
  1. Connects to MQTT broker
  2. Subscribes to Frigate topics
  3. Returns MQTT client instance
- **Topics Subscribed**:
  - `frigate/+/events` - Detection events
  - `frigate/+/reviews` - Review events
  - `frigate/+/available` - Availability status
- **Event Bus**: `ingestorBus` (EventEmitter) emits:
  - `'frigate:event'` - Detection event
  - `'frigate:review'` - Review event
  - `'frigate:available'` - Status change

### 4. Message Normalization (`src/mqtt/normalize.ts`)
- **Function**: `normalizeMessage(payload, topic)`
- **Input**: Raw MQTT payload + topic string
- **Output**: Typed normalized object or null
- **Handles**: Never throws, returns null on invalid data
- **Types**:
  - `NormalizedFrigateEvent` - Detection events
  - `NormalizedFrigateReview` - Review events
  - `NormalizedFrigateAvailable` - Status events

### 5. Event Handlers (`src/ingest/handler.ts`)
- **handleFrigateEvent(normalized)**
  - Resolves camera (auto-creates if needed)
  - Upserts event in database
  - Returns: `EventHandlerResult<PersistedEvent>`
  
- **handleFrigateReview(normalized)**
  - Resolves camera (auto-creates if needed)
  - Logs review metadata
  - Returns: `EventHandlerResult<PersistedReview>`

- **Helper Functions**:
  - `resolveCameraByName()` - Finds or creates camera record
  - `createOrUpdateEvent()` - Database upsert operation
  - Uses Prisma transactions for consistency

## Event Handler Implementation

### Detection Event Handler
```typescript
ingestorBus.onFrigateEvent(async (rawEvent: FrigateEvent) => {
  // 1. Normalize
  const normalized = normalizeMessage(rawEvent, `frigate/${rawEvent.after.camera}/events`);
  
  if (!normalized) {
    console.warn('Failed to normalize');
    return;
  }

  // 2. Type guard
  if (!('hasSnapshot' in normalized)) {
    console.warn('Not an event message');
    return;
  }

  // 3. Persist
  const result = await handleFrigateEvent(normalized);

  // 4. Log
  if (result.success) {
    console.log('✓ Event persisted', {
      eventId: result.data?.frigateId,
      camera: result.data?.cameraId,
      type: result.data?.type,
    });
  } else {
    console.warn('⚠️  Event handler failed:', result.error);
  }
});
```

### Review Event Handler
```typescript
ingestorBus.onFrigateReview(async (rawReview: FrigateReview) => {
  // 1. Normalize
  const normalized = normalizeMessage(rawReview, `frigate/${rawReview.camera}/reviews`);
  
  if (!normalized) {
    console.warn('Failed to normalize');
    return;
  }

  // 2. Type guard
  if (!('reviewId' in normalized)) {
    console.warn('Not a review message');
    return;
  }

  // 3. Persist
  const result = await handleFrigateReview(normalized);

  // 4. Log
  if (result.success) {
    console.log('✓ Review persisted', {
      reviewId: result.data?.reviewId,
      camera: result.data?.camera,
      severity: result.data?.severity,
    });
  } else {
    console.warn('⚠️  Review handler failed:', result.error);
  }
});
```

## Graceful Shutdown Sequence

When the service receives SIGINT or SIGTERM:

```
Signal received (SIGINT/SIGTERM)
    │
    ▼
shutdown(signal) called
    │
    ├─ Set isShuttingDown = true (prevent duplicate calls)
    │
    ├─ Print: "⏹️  ${signal} received - Gracefully shutting down..."
    │
    ├─ Shutdown MQTT:
    │  ├─ unsubscribeFromFrigateEvents(client)
    │  ├─ disconnectMqtt()
    │  └─ removeAllListeners()
    │
    ├─ Close Database:
    │  └─ disconnectDatabase()
    │
    ├─ Print shutdown complete banner
    │
    └─ process.exit(0) with success code
```

## Error Handling

### Startup Errors
If any step in main() throws:
1. Catch error and log
2. Attempt cleanup (DB & MQTT)
3. Exit with code 1 (failure)

### Event Processing Errors
Each handler is wrapped in try/catch:
- Normalization failures: Log warning, ignore event
- Type guard failures: Log warning, skip handler
- Database errors: Log failure, continue processing
- Unexpected errors: Log error, continue processing

### Process-Level Errors
Registered handlers catch:
- `uncaughtException` - Unexpected sync errors
- `unhandledRejection` - Unhandled promise rejections
- Both trigger graceful shutdown

## Logging Output

### Startup
```
╔════════════════════════════════════════════╗
║  🚀 Frigate Event Ingestor Starting...  ║
╚════════════════════════════════════════════╝

📋 Loading configuration...
   ✓ LOG_LEVEL: debug
   ✓ MQTT Broker: mqtt://localhost:1883
   ✓ Database: PostgreSQL
   ✓ NODE_ENV: development

🗄️  Connecting to PostgreSQL...
   ✓ Database connection established

🔌 Initializing MQTT subsystem...
   ✓ MQTT subsystem ready

⚡ Setting up event handlers...
   ✓ Event handlers attached

╔════════════════════════════════════════════╗
║  ✅ Ingestor Service Running Successfully ║
╚════════════════════════════════════════════╝

📊 Status:
   • MQTT: Connected and subscribed
   • Database: Connected
   • Event handlers: Active

📝 Logs:
   • Detection events: printed on persistence
   • Review events: printed on persistence
   • Errors: printed in real-time

⏹️  Press Ctrl+C to gracefully shutdown
```

### During Operation
```
✓ Event persisted {
  eventId: 'event_abc123',
  camera: 'cam-1',
  type: 'end'
}

✓ Review persisted {
  reviewId: 'review_xyz789',
  camera: 'cam-1',
  severity: 'detection'
}

⚠️  Failed to normalize Frigate event: {
  camera: 'cam-2',
  eventId: 'event_def456',
  type: 'new'
}
```

### Shutdown
```
⏹️  SIGINT received - Gracefully shutting down...

🔌 Disconnecting from MQTT...
   ✓ MQTT disconnected

🗄️  Closing database connection...
   ✓ Database connection closed

╔════════════════════════════════════════════╗
║  ✅ Ingestor Service Shutdown Complete   ║
╚════════════════════════════════════════════╝
```

## Running the Service

### Development Mode (with hot reload)
```bash
npm run dev
```

### Production Build & Run
```bash
npm run build
npm start
```

### Docker
```bash
docker-compose up -d ingestor-app
docker logs -f ingestor-app
```

## Environment Variables

Required in `.env`:
```bash
# MQTT
MQTT_BROKER_URL=mqtt://mosquitto:1883

# Database
POSTGRES_USER=frigate
POSTGRES_PASSWORD=frigate_password
POSTGRES_DB=frigate_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_URL=postgresql://frigate:frigate_password@postgres:5432/frigate_db

# Logging
LOG_LEVEL=info

# Environment
NODE_ENV=production
```

## Design Principles

1. **Never Crash**: All handlers wrapped in try/catch
2. **Type Safe**: Full TypeScript strict mode
3. **Defensive**: Auto-creates tenants/cameras, returns null on errors
4. **Observable**: Comprehensive logging at each step
5. **Graceful**: Clean shutdown with signal handling
6. **Transactional**: Uses Prisma transactions for consistency
7. **Non-Blocking**: Async handlers don't block MQTT loop
8. **Idempotent**: Uses upsert pattern for safe retries

## Future Enhancements

1. **Add Review Model**: Create Prisma model for reviews
2. **Add SystemStatus/AvailabilityLog Model**: Track availability history
3. **Metrics Collection**: Count events, measure latency
4. **Dead-Letter Queue**: Store failed events for retry
5. **Batch Processing**: Accumulate and process multiple events
6. **Circuit Breaker**: Stop processing if database unavailable
7. **Backpressure Handling**: Slow down MQTT consumption if backed up
8. **Multi-Instance Support**: Handle multiple Frigate instances

## References

- MQTT Module: `src/mqtt/`
- Normalization: `src/mqtt/normalize.ts`
- Event Handler: `src/ingest/handler.ts`
- Database: `src/db/client.ts` and `prisma/schema.prisma`
