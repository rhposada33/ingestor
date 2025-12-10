# MQTT System Architecture & Reference

Complete technical reference for the MQTT subsystem architecture, design decisions, and API reference.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Module Responsibilities](#module-responsibilities)
3. [Data Flow](#data-flow)
4. [Type Definitions](#type-definitions)
5. [API Reference](#api-reference)
6. [Design Patterns](#design-patterns)
7. [Configuration](#configuration)
8. [Performance & Limits](#performance--limits)
9. [Deployment](#deployment)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│  (Your business logic: event processing, database saves, etc)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   mqtt/index.ts │
                    │   Integration   │
                    │   Facade        │
                    └────────┬────────┘
                             │
           ┌─────────────────┼──────────────────┐
           │                 │                  │
   ┌───────▼────┐   ┌───────▼────┐   ┌───────▼────┐
   │  client.ts │   │   bus.ts   │   │subscriber.ts
   │ Connection │   │  EventBus  │   │  Handlers  │
   │ Management │   │            │   │            │
   └────────────┘   └────────────┘   └────────────┘
           │              │                │
           └──────────────┼────────────────┘
                          │
                ┌─────────▼─────────┐
                │  MQTT Broker      │
                │  (Frigate/Emqx)   │
                └───────────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Singleton Pattern**: Only one connection to the broker at a time
3. **Type Safety**: Full TypeScript strict mode compliance
4. **Async/Await**: Non-blocking operations throughout
5. **Error Resilience**: Graceful degradation on errors
6. **Observability**: Comprehensive logging at all levels

## Module Responsibilities

### client.ts - Connection Management

**Purpose**: Manages the lifecycle of the MQTT connection

**Responsibilities**:
- Establish connection to broker
- Handle reconnection logic
- Manage connection state
- Provide connection status queries
- Implement exponential backoff for retries

**Key Exports**:
```typescript
async function connectMqtt(): Promise<MqttClient>
async function disconnectMqtt(): Promise<void>
function getMqttClient(): MqttClient | null
function isMqttConnected(): boolean
async function waitForMqttReady(timeout?: number): Promise<void>
```

**Connection Options**:
```typescript
{
  reconnectPeriod: 1000,           // 1 second between retries
  connectTimeout: 30000,            // 30 second connection timeout
  keepalive: 60,                    // 60 second keep-alive
  clean: true,                      // Clean session (no message queueing)
  clientId: `ingestor-${pid}`,     // Unique client ID with PID
  protocol: 'mqtt',                // MQTT 3.1.1 protocol
  rejectUnauthorized: !isDev        // SSL verification (off in dev)
}
```

**State Management**:
```
┌─────────────────────────────────────────┐
│  Global Connection State                │
├─────────────────────────────────────────┤
│ let mqttClientInstance: MqttClient | null│
│ let isReady: boolean = false            │
│ let readyPromise: Promise<void> | null  │
└─────────────────────────────────────────┘
```

### bus.ts - Event Emission

**Purpose**: Provides typed, application-level event handling

**Responsibilities**:
- Define Frigate event types (Event, Review, Available)
- Provide type-safe event emission
- Provide type-safe event listening
- Manage event listener lifecycle
- Provide singleton access to bus instance

**Key Exports**:
```typescript
class IngestorBus extends EventEmitter
interface FrigateEvent
interface FrigateReview
interface FrigateAvailable
const ingestorBus: IngestorBus
function getIngestorBus(): IngestorBus
```

**Event Types**:
```typescript
// Detection event
interface FrigateEvent {
  type: 'new' | 'update' | 'end';
  camera: string;
  before?: { count: number; [...]; };
  after?: { count: number; [...]; };
  id?: string;
  start_time?: number;
  end_time?: number;
}

// Review/alert event
interface FrigateReview {
  id: string;
  camera: string;
  severity: 'alert' | 'detection' | 'review';
  retracted: boolean;
  data: Record<string, unknown>;
}

// Availability status
interface FrigateAvailable {
  available: boolean;
}
```

**Methods** (from IngestorBus):
```typescript
// Emit events (internal use)
emitFrigateEvent(event: FrigateEvent): void
emitFrigateReview(review: FrigateReview): void
emitFrigateAvailable(status: FrigateAvailable): void

// Listen for events
onFrigateEvent(listener: (event: FrigateEvent) => void): this
onFrigateReview(listener: (review: FrigateReview) => void): this
onFrigateAvailable(listener: (status: FrigateAvailable) => void): this

// Remove listeners
offFrigateEvent(listener: (event: FrigateEvent) => void): this
offFrigateReview(listener: (review: FrigateReview) => void): this
offFrigateAvailable(listener: (status: FrigateAvailable) => void): this

// One-time listeners
onceFrigateEvent(listener: (event: FrigateEvent) => void): this
onceFrigateReview(listener: (review: FrigateReview) => void): this
onceFrigateAvailable(listener: (status: FrigateAvailable) => void): this
```

### subscriber.ts - Topic Subscriptions

**Purpose**: Handles MQTT topic subscriptions and message parsing

**Responsibilities**:
- Subscribe to Frigate topics
- Parse incoming JSON messages
- Validate message structure
- Route messages to appropriate event emitters
- Track subscription state
- Handle parsing errors gracefully

**Key Exports**:
```typescript
async function subscribeToFrigateEvents(client: MqttClient): Promise<void>
async function unsubscribeFromFrigateEvents(client: MqttClient): Promise<void>
function isFrigateSubscribed(): boolean
```

**Subscribed Topics**:
```
frigate/events          → Detection events (new, update, end)
frigate/reviews         → Review/alert events
frigate/available/#     → Availability status (# = wildcard)
```

**Message Processing Pipeline**:
```
MQTT Message
    │
    ├─► JSON.parse()
    │
    ├─► Topic matching
    │   ├─ frigate/events → parseFrigateEvent()
    │   ├─ frigate/reviews → parseFrigateReview()
    │   └─ frigate/available/* → parseFrigateAvailable()
    │
    ├─► Validation
    │   ├─ Type checking
    │   ├─ Required fields
    │   └─ Error logging
    │
    └─► Event Emission to Bus
        └─ ingestorBus.emit*(...)
```

**Parser Functions**:
```typescript
function parseFrigateEvent(payload: string): FrigateEvent
function parseFrigateReview(payload: string): FrigateReview
function parseFrigateAvailable(payload: string): FrigateAvailable
```

### index.ts - Integration Facade

**Purpose**: Provides high-level API for application integration

**Responsibilities**:
- Export all public APIs
- Provide initialization functions
- Provide convenience wrappers
- Coordinate subsystem startup/shutdown
- Provide example integration patterns

**Key Exports**:
```typescript
// Core initialization
async function initializeMqttSubsystem(): Promise<MqttClient>
async function shutdownMqttSubsystem(): Promise<void>

// Convenience listeners
function onFrigateEvent(callback: (event: FrigateEvent) => void): void
function onFrigateReview(callback: (review: FrigateReview) => void): void
function onFrigateAvailable(callback: (status: FrigateAvailable) => void): void

// Re-exports from other modules
export * from './client.js'
export * from './bus.js'
export * from './subscriber.js'
```

## Data Flow

### Startup Flow

```typescript
initializeMqttSubsystem()
    │
    ├─► connectMqtt()
    │   ├─ Create MQTT client
    │   ├─ Connect to broker
    │   ├─ Wait for 'connect' event
    │   └─ Return client instance
    │
    ├─► subscribeToFrigateEvents(client)
    │   ├─ Subscribe to frigate/events
    │   ├─ Subscribe to frigate/reviews
    │   ├─ Subscribe to frigate/available/#
    │   └─ Attach message handlers
    │
    ├─► isMqttConnected() check
    │   └─ Verify connection state
    │
    └─► Return client (ready for use)
```

### Event Reception Flow

```
MQTT Broker publishes to frigate/events
    │
    ├─► MQTT Client receives message
    │
    ├─► Topic handler invoked
    │   └─ handleIncomingMessage(topic, payload)
    │
    ├─► Route to parser
    │   ├─ Match topic to parser
    │   └─ Call appropriate parser
    │
    ├─► Parse & validate
    │   ├─ JSON.parse(payload)
    │   ├─ Type checking
    │   └─ Log errors if invalid
    │
    ├─► Emit to bus
    │   └─ ingestorBus.emit('frigate:event', parsedData)
    │
    └─► Application listener receives event
        └─ Defined via onFrigateEvent(callback)
```

### Shutdown Flow

```typescript
shutdownMqttSubsystem()
    │
    ├─► unsubscribeFromFrigateEvents(client)
    │   ├─ client.unsubscribe('frigate/events')
    │   ├─ client.unsubscribe('frigate/reviews')
    │   ├─ client.unsubscribe('frigate/available/#')
    │   └─ Mark as unsubscribed
    │
    ├─► disconnectMqtt()
    │   ├─ client.end()
    │   ├─ Wait for 'end' event
    │   └─ Clear client instance
    │
    ├─► ingestorBus.removeAllListeners()
    │   └─ Clear all event listeners
    │
    └─► Done (graceful shutdown complete)
```

## Type Definitions

### FrigateEvent Type

```typescript
interface FrigateEvent {
  // Event lifecycle type
  type: 'new' | 'update' | 'end';

  // Camera identifier
  camera: string;

  // Object counts before event
  before?: {
    count: number;
    person?: number;
    car?: number;
    dog?: number;
    cat?: number;
    [key: string]: any;
  };

  // Object counts after event
  after?: {
    count: number;
    person?: number;
    car?: number;
    dog?: number;
    cat?: number;
    [key: string]: any;
  };

  // Event metadata
  id?: string;
  start_time?: number;  // Unix timestamp in seconds
  end_time?: number;    // Unix timestamp in seconds
  thumbnail?: string;   // Base64 encoded or URL
  [key: string]: any;   // Additional Frigate fields
}
```

### FrigateReview Type

```typescript
interface FrigateReview {
  // Unique review identifier
  id: string;

  // Camera that generated the review
  camera: string;

  // Severity level
  severity: 'alert' | 'detection' | 'review';

  // Whether review was retracted by user
  retracted: boolean;

  // Additional review data
  data: Record<string, unknown>;

  // Other possible fields
  [key: string]: any;
}
```

### FrigateAvailable Type

```typescript
interface FrigateAvailable {
  // Whether Frigate is currently available
  available: boolean;

  // Possible additional fields
  [key: string]: any;
}
```

## API Reference

### Connection Management (client.ts)

#### connectMqtt()

```typescript
async function connectMqtt(): Promise<MqttClient>
```

Establishes connection to MQTT broker.

**Returns**: Promise resolving to MQTT client instance

**Throws**: Error if connection fails

**Example**:
```typescript
const client = await connectMqtt();
console.log('Connected!');
```

---

#### disconnectMqtt()

```typescript
async function disconnectMqtt(): Promise<void>
```

Gracefully disconnects from MQTT broker.

**Returns**: Promise that resolves when disconnected

**Throws**: Error if disconnection fails

**Example**:
```typescript
await disconnectMqtt();
console.log('Disconnected');
```

---

#### getMqttClient()

```typescript
function getMqttClient(): MqttClient | null
```

Gets the current MQTT client instance.

**Returns**: Client instance or null if not connected

**Example**:
```typescript
const client = getMqttClient();
if (client) {
  client.publish('test/topic', 'hello');
}
```

---

#### isMqttConnected()

```typescript
function isMqttConnected(): boolean
```

Checks if currently connected to broker.

**Returns**: true if connected and ready, false otherwise

**Example**:
```typescript
if (!isMqttConnected()) {
  console.log('Not connected');
}
```

---

#### waitForMqttReady()

```typescript
async function waitForMqttReady(timeout?: number): Promise<void>
```

Waits for MQTT client to be ready.

**Parameters**:
- `timeout` (optional): Timeout in milliseconds (default: 30000)

**Returns**: Promise that resolves when ready

**Throws**: Error if timeout exceeded

**Example**:
```typescript
await waitForMqttReady(10000);
console.log('Client is ready!');
```

---

### Event Bus (bus.ts)

#### getIngestorBus()

```typescript
function getIngestorBus(): IngestorBus
```

Gets the singleton event bus instance.

**Returns**: IngestorBus instance

**Example**:
```typescript
const bus = getIngestorBus();
bus.onFrigateEvent((event) => console.log(event));
```

---

#### ingestorBus (singleton export)

```typescript
const ingestorBus: IngestorBus
```

The singleton event bus instance, directly exported for convenience.

**Example**:
```typescript
import { ingestorBus } from './mqtt/bus.js';
ingestorBus.onFrigateEvent((event) => {
  console.log(`Detection on ${event.camera}`);
});
```

---

#### IngestorBus.onFrigateEvent()

```typescript
ingestorBus.onFrigateEvent(
  listener: (event: FrigateEvent) => void | Promise<void>
): IngestorBus
```

Register a listener for Frigate detection events.

**Parameters**:
- `listener`: Function to call when event is emitted

**Returns**: The bus instance (for chaining)

**Example**:
```typescript
ingestorBus
  .onFrigateEvent(async (event) => {
    if (event.type === 'end') {
      await handleDetectionEnded(event);
    }
  })
  .onFrigateReview(async (review) => {
    await handleReview(review);
  });
```

---

#### IngestorBus.onFrigateReview()

```typescript
ingestorBus.onFrigateReview(
  listener: (review: FrigateReview) => void | Promise<void>
): IngestorBus
```

Register a listener for Frigate review events.

**Parameters**:
- `listener`: Function to call when review event is emitted

**Returns**: The bus instance (for chaining)

---

#### IngestorBus.onFrigateAvailable()

```typescript
ingestorBus.onFrigateAvailable(
  listener: (status: FrigateAvailable) => void | Promise<void>
): IngestorBus
```

Register a listener for Frigate availability status changes.

**Parameters**:
- `listener`: Function to call when availability changes

**Returns**: The bus instance (for chaining)

---

#### IngestorBus.offFrigateEvent()

```typescript
ingestorBus.offFrigateEvent(
  listener: (event: FrigateEvent) => void
): IngestorBus
```

Remove a listener for Frigate detection events.

**Parameters**:
- `listener`: The same listener function passed to onFrigateEvent()

**Returns**: The bus instance (for chaining)

**Example**:
```typescript
const handler = (event: FrigateEvent) => { /* ... */ };
ingestorBus.onFrigateEvent(handler);
// Later...
ingestorBus.offFrigateEvent(handler);
```

---

### Subscriptions (subscriber.ts)

#### subscribeToFrigateEvents()

```typescript
async function subscribeToFrigateEvents(
  client: MqttClient
): Promise<void>
```

Subscribe to all Frigate event topics.

**Parameters**:
- `client`: MQTT client instance

**Returns**: Promise that resolves when subscriptions are set up

**Topics subscribed**:
- `frigate/events`
- `frigate/reviews`
- `frigate/available/#`

**Example**:
```typescript
const client = await connectMqtt();
await subscribeToFrigateEvents(client);
console.log('Subscribed to Frigate events');
```

---

#### unsubscribeFromFrigateEvents()

```typescript
async function unsubscribeFromFrigateEvents(
  client: MqttClient
): Promise<void>
```

Unsubscribe from all Frigate event topics.

**Parameters**:
- `client`: MQTT client instance

**Returns**: Promise that resolves when unsubscribed

**Example**:
```typescript
await unsubscribeFromFrigateEvents(client);
console.log('Unsubscribed from Frigate events');
```

---

#### isFrigateSubscribed()

```typescript
function isFrigateSubscribed(): boolean
```

Check if currently subscribed to Frigate topics.

**Returns**: true if subscribed, false otherwise

**Example**:
```typescript
if (isFrigateSubscribed()) {
  console.log('Ready to receive events');
}
```

---

### Integration (index.ts)

#### initializeMqttSubsystem()

```typescript
async function initializeMqttSubsystem(): Promise<MqttClient>
```

Initialize the complete MQTT subsystem.

**Returns**: Promise resolving to MQTT client instance

**Does**:
1. Connects to MQTT broker
2. Subscribes to Frigate topics
3. Verifies ready state
4. Logs initialization progress

**Example**:
```typescript
const client = await initializeMqttSubsystem();
console.log('MQTT subsystem ready');
```

---

#### shutdownMqttSubsystem()

```typescript
async function shutdownMqttSubsystem(): Promise<void>
```

Gracefully shutdown the MQTT subsystem.

**Returns**: Promise that resolves when shutdown is complete

**Does**:
1. Unsubscribes from topics
2. Disconnects from broker
3. Clears event listeners
4. Logs shutdown progress

**Example**:
```typescript
await shutdownMqttSubsystem();
console.log('MQTT shutdown complete');
```

---

#### onFrigateEvent()

```typescript
function onFrigateEvent(
  callback: (event: FrigateEvent) => void | Promise<void>
): void
```

Convenience wrapper for listening to detection events.

**Parameters**:
- `callback`: Function to call when events arrive

**Example**:
```typescript
import { onFrigateEvent } from './mqtt/index.js';

onFrigateEvent((event) => {
  console.log(`Detection: ${event.type} on ${event.camera}`);
});
```

---

#### onFrigateReview()

```typescript
function onFrigateReview(
  callback: (review: FrigateReview) => void | Promise<void>
): void
```

Convenience wrapper for listening to review events.

**Parameters**:
- `callback`: Function to call when reviews arrive

---

#### onFrigateAvailable()

```typescript
function onFrigateAvailable(
  callback: (status: FrigateAvailable) => void | Promise<void>
): void
```

Convenience wrapper for listening to availability changes.

**Parameters**:
- `callback`: Function to call when availability changes

---

## Design Patterns

### Singleton Pattern

The MQTT client and event bus use the singleton pattern to ensure only one instance:

```typescript
// Only one client instance per process
let mqttClientInstance: MqttClient | null = null;

async function connectMqtt(): Promise<MqttClient> {
  if (mqttClientInstance) {
    return mqttClientInstance;
  }
  // Create and return new instance
  mqttClientInstance = mqtt.connect(...);
  return mqttClientInstance;
}
```

### Observer Pattern

The event bus extends EventEmitter to provide type-safe event observation:

```typescript
class IngestorBus extends EventEmitter {
  onFrigateEvent(listener: (event: FrigateEvent) => void): this {
    this.on('frigate:event', listener);
    return this;
  }
}
```

### Facade Pattern

The index.ts module provides a facade to simplify integration:

```typescript
// Complex initialization hidden behind simple function
async function initializeMqttSubsystem(): Promise<MqttClient> {
  const client = await connectMqtt();
  await subscribeToFrigateEvents(client);
  return client;
}
```

### Graceful Degradation

Errors are handled gracefully with logging:

```typescript
try {
  const parsed = JSON.parse(payload);
  // Process...
} catch (error) {
  console.error('Failed to parse message:', error);
  // Continue processing other messages
}
```

## Configuration

### Environment Variables

```bash
# MQTT Broker Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=frigate          # Optional
MQTT_PASSWORD=frigate_password # Optional

# Application Configuration
NODE_ENV=development           # development|production
LOG_LEVEL=info                # debug|info|warn|error

# Database Configuration (if using dbService)
POSTGRES_URL=postgresql://user:pass@localhost:5432/db
```

### Broker Configuration

The MQTT client is configured with these settings:

```typescript
{
  reconnectPeriod: 1000,        // Attempt reconnect every 1s
  connectTimeout: 30000,         // Give up after 30s
  keepalive: 60,                 // Send keepalive every 60s
  clean: true,                   // Don't queue messages
  clientId: `ingestor-${pid}`,   // Unique ID with process ID
  protocol: 'mqtt',              // Use MQTT 3.1.1
  rejectUnauthorized: !isDev,    // Verify SSL in production
  username: env.MQTT_USERNAME,   // From environment
  password: env.MQTT_PASSWORD    // From environment
}
```

## Performance & Limits

### Message Rate Limits

- **Per-device**: No inherent limit (depends on Frigate configuration)
- **Per-connection**: Limited by broker (typically 1000+ msg/sec)
- **Per-topic**: Unlimited by client library

### Memory Consumption

- **MQTT Client**: ~2-5 MB baseline
- **Event Bus (no listeners)**: <1 MB
- **Per event listener**: ~100 bytes (+ closure size)
- **Message queue (in-flight)**: ~1 KB per message

### Typical Resource Usage

```
Baseline (no activity):
├─ Memory: 5-10 MB
└─ CPU: <0.1%

Active (100 events/sec):
├─ Memory: 15-20 MB
├─ CPU: 1-3%
└─ Latency: <100ms event-to-listener

High Load (1000 events/sec):
├─ Memory: 30-50 MB
├─ CPU: 10-20%
└─ Latency: 100-500ms (processing-dependent)
```

### Optimization Tips

1. **Use async handlers**: Don't block in listeners
2. **Batch database saves**: Save multiple events together
3. **Monitor memory**: Check for listener leaks
4. **Limit listeners**: Remove unused listeners

## Deployment

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY tsconfig.json .

# Build
RUN npm run build

# Run
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mqtt-broker:
    image: emqx:latest
    ports:
      - "1883:1883"
    environment:
      EMQX_ALLOW_ANONYMOUS: "true"

  ingestor:
    build: .
    depends_on:
      - mqtt-broker
    environment:
      MQTT_BROKER_URL: mqtt://mqtt-broker:1883
      NODE_ENV: production
```

### Environment Validation

Always validate configuration on startup:

```typescript
async function validateConfiguration(): Promise<void> {
  const required = ['MQTT_BROKER_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  console.log('Configuration validated');
}
```

---

## See Also

- `MQTT_INTEGRATION_GUIDE.md` - Integration into your application
- `FRIGATE_EVENTS_GUIDE.md` - Event types and examples
- `INTEGRATION_EXAMPLES.md` - Complete code examples
- `MQTT_CLIENT_GUIDE.md` - Low-level client API
