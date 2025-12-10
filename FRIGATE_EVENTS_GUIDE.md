# Frigate Event Bus & Subscriber

## Overview

The `src/mqtt/bus.ts` and `src/mqtt/subscriber.ts` modules provide a complete event system for consuming Frigate MQTT events.

**Features:**
- Typed EventEmitter for 3 Frigate event types
- Automatic MQTT subscription to Frigate topics
- JSON parsing and validation
- Type-safe event listeners
- Singleton pattern for the event bus

---

## Architecture

```
MQTT Broker (Frigate)
        ↓
   [MQTT Client]
        ↓
[subscriber.ts] ← parses JSON, validates
        ↓
[bus.ts] ← emits typed events
        ↓
   Your Handlers
   - onFrigateEvent()
   - onFrigateReview()
   - onFrigateAvailable()
```

---

## Event Bus (`src/mqtt/bus.ts`)

### Type Definitions

**FrigateEvent** - Detection events from Frigate
```typescript
{
  before: { id, camera, frame_time, snapshot, label, top_score, ... },
  after: { id, camera, frame_time, snapshot, label, top_score, ... },
  type: 'new' | 'update' | 'end'
}
```

**FrigateReview** - Review/alert events
```typescript
{
  id: string,
  camera: string,
  frame_time: number,
  severity: 'alert' | 'detection',
  data: { type, objects },
  retracted: boolean
}
```

**FrigateAvailable** - Frigate availability status
```typescript
{
  available: boolean
}
```

### IngestorBus Class

Extended EventEmitter with typed methods:

```typescript
// Emit events (internal use)
bus.emitFrigateEvent(event)
bus.emitFrigateReview(review)
bus.emitFrigateAvailable(available)

// Listen for events
bus.onFrigateEvent((event) => { ... })
bus.onFrigateReview((review) => { ... })
bus.onFrigateAvailable((available) => { ... })

// Remove listeners
bus.offFrigateEvent(listener)
bus.offFrigateReview(listener)
bus.offFrigateAvailable(listener)

// Listen once
bus.onceFrigateEvent((event) => { ... })
bus.onceFrigateReview((review) => { ... })
bus.onceFrigateAvailable((available) => { ... })
```

### Getting the Bus

```typescript
import { ingestorBus } from './mqtt/bus.js';

// Use singleton directly
ingestorBus.onFrigateEvent((event) => {
  console.log('Event:', event);
});

// Or get instance function
import { getIngestorBus } from './mqtt/bus.js';
const bus = getIngestorBus();
```

---

## Subscriber (`src/mqtt/subscriber.ts`)

### Subscribing to Topics

```typescript
import { subscribeToFrigateEvents } from './mqtt/subscriber.js';
import { connectMqtt } from './mqtt/client.js';

const client = await connectMqtt();
await subscribeToFrigateEvents(client);

// Console output:
// 📡 Subscribing to Frigate MQTT topics...
// ✅ Subscribed to frigate/events
// ✅ Subscribed to frigate/reviews
// ✅ Subscribed to frigate/available/#
// ✅ All Frigate subscriptions successful
// 📡 Frigate event listener activated
```

### Subscribed Topics

| Topic | Event | Emitted | Purpose |
|-------|-------|---------|---------|
| `frigate/events` | `frigate:event` | FrigateEvent | Detection events |
| `frigate/reviews` | `frigate:review` | FrigateReview | Review/alerts |
| `frigate/available/#` | `frigate:available` | FrigateAvailable | Availability status |

### Unsubscribing

```typescript
import { unsubscribeFromFrigateEvents } from './mqtt/subscriber.js';

unsubscribeFromFrigateEvents(client);

// Console output:
// 📡 Unsubscribing from Frigate MQTT topics...
// ✅ Unsubscribed from frigate/events
// ✅ Unsubscribed from frigate/reviews
// ✅ Unsubscribed from frigate/available/#
// ✅ Frigate event listener deactivated
```

### Checking Subscription Status

```typescript
import { isFrigateSubscribed } from './mqtt/subscriber.js';

if (isFrigateSubscribed(client)) {
  console.log('Frigate subscriptions are active');
}
```

---

## Usage Examples

### Basic Event Listening

```typescript
import { ingestorBus } from './mqtt/bus.js';

// Listen for detection events
ingestorBus.onFrigateEvent((event) => {
  console.log(`Detection on ${event.after.camera}:`, event.after.label);
  console.log(`Score: ${event.after.top_score}`);
});

// Listen for reviews
ingestorBus.onFrigateReview((review) => {
  console.log(`Review on ${review.camera}:`, review.severity);
});

// Listen for availability
ingestorBus.onFrigateAvailable((available) => {
  console.log(`Frigate is ${available.available ? 'online' : 'offline'}`);
});
```

### Event Filtering

```typescript
ingestorBus.onFrigateEvent((event) => {
  // Only process 'end' events (completed detections)
  if (event.type === 'end') {
    console.log(`Detection ended for ${event.after.label}`);
  }
});
```

### Processing Events with Database

```typescript
import { dbService } from './db/service.js';
import { ingestorBus } from './mqtt/bus.js';

ingestorBus.onFrigateEvent(async (event) => {
  if (event.type === 'end') {
    // Save to database
    await dbService.createEvent(
      tenantId,
      cameraId,
      event.after.id,
      event.after.label,
      { frigate: event.after }
    );
  }
});
```

### One-time Event Listener

```typescript
ingestorBus.onceFrigateEvent((event) => {
  console.log('First event received:', event.after.label);
  // This listener will only be called once
});
```

### Removing Listeners

```typescript
const listener = (event) => {
  console.log('Event:', event);
};

// Add listener
ingestorBus.onFrigateEvent(listener);

// Do something...

// Remove listener
ingestorBus.offFrigateEvent(listener);
```

---

## Complete Integration Example

```typescript
import { connectMqtt, disconnectMqtt } from './mqtt/client.js';
import { subscribeToFrigateEvents, unsubscribeFromFrigateEvents } from './mqtt/subscriber.js';
import { ingestorBus } from './mqtt/bus.js';

async function main() {
  try {
    // Connect to MQTT
    const client = await connectMqtt();
    console.log('✅ MQTT connected');

    // Subscribe to Frigate events
    await subscribeToFrigateEvents(client);

    // Listen for events
    ingestorBus.onFrigateEvent(async (event) => {
      console.log(`📨 Event: ${event.after.label} on ${event.after.camera}`);
      
      if (event.type === 'end') {
        // Process completed detection
        // e.g., save to database
      }
    });

    ingestorBus.onFrigateReview((review) => {
      console.log(`📋 Review: ${review.severity} on ${review.camera}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down...');
      unsubscribeFromFrigateEvents(client);
      await disconnectMqtt();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
```

---

## Error Handling

### Subscription Errors

```typescript
try {
  await subscribeToFrigateEvents(client);
} catch (error) {
  console.error('Failed to subscribe:', error.message);
  // Handle subscription failure
}
```

### Message Parsing Errors

The subscriber automatically handles JSON parse errors:

```
❌ Failed to parse message from frigate/events: Invalid JSON in Frigate event: ...
```

Invalid messages are logged but don't crash the application.

### Missing Listeners

```
⚠️  No listeners for frigate:event
```

This warning appears if a message arrives but no listeners are registered.

---

## Event Flow Diagram

```
1. MQTT Broker sends message to client
                ↓
2. Client receives on 'message' event
                ↓
3. Subscriber matches topic to handler
                ↓
4. Parser validates JSON & structure
                ↓
5. IngestorBus emits typed event
                ↓
6. Your listeners receive event
                ↓
7. Your code processes event
```

---

## Type Safety

All events are fully typed:

```typescript
// ✅ Type-safe - autocomplete works
ingestorBus.onFrigateEvent((event) => {
  event.after.label        // ✅ known property
  event.after.score        // ✅ known property
  event.before             // ✅ known property
  event.unknown            // ❌ TypeScript error - property doesn't exist
});
```

---

## Logging Output Examples

### Successful Subscription

```
📡 Subscribing to Frigate MQTT topics...
✅ Subscribed to frigate/events
✅ Subscribed to frigate/reviews
✅ Subscribed to frigate/available/#
✅ All Frigate subscriptions successful
📡 Frigate event listener activated
```

### Receiving Events

```
📨 Emitted frigate:event from topic: frigate/events
📨 Emitted frigate:review from topic: frigate/reviews
📨 Emitted frigate:available from topic: frigate/available/server
```

### Error Scenarios

```
❌ Failed to subscribe to frigate/events: Connection refused
❌ Failed to parse message from frigate/events: Invalid JSON in Frigate event: ...
⚠️  No listeners for frigate:event
⚠️  No handler for topic: unknown/topic
```

---

## Testing Events

### Manual MQTT Testing

```bash
# In terminal, publish a test event
mosquitto_pub -h localhost -t frigate/events -m '{
  "before": {"id": "test1", "camera": "front", "label": "person", "top_score": 0.9, "start_time": 1},
  "after": {"id": "test1", "camera": "front", "label": "person", "top_score": 0.95, "start_time": 1, "end_time": null},
  "type": "update"
}'
```

### Application Test

```typescript
// In your app, verify listener is called
let eventCount = 0;
ingestorBus.onFrigateEvent(() => {
  eventCount++;
});

// After publishing test event above:
console.log(`Received ${eventCount} events`); // Should be 1
```

---

## Files

| File | Purpose |
|------|---------|
| `src/mqtt/bus.ts` | Typed EventEmitter and event types |
| `src/mqtt/subscriber.ts` | MQTT subscription and parsing |

---

## API Reference

### Bus (`bus.ts`)

```typescript
// Types
interface FrigateEvent { ... }
interface FrigateReview { ... }
interface FrigateAvailable { ... }

// Class
class IngestorBus extends EventEmitter { ... }

// Singleton
const ingestorBus: IngestorBus
function getIngestorBus(): IngestorBus
```

### Subscriber (`subscriber.ts`)

```typescript
// Main functions
async function subscribeToFrigateEvents(client: MqttClient): Promise<void>
function unsubscribeFromFrigateEvents(client: MqttClient): void
function isFrigateSubscribed(client: MqttClient): boolean
```

---

## Next Steps

1. **Integrate into main app** - Add to `src/index.ts` startup
2. **Add database persistence** - Save events to database via `dbService`
3. **Add error recovery** - Handle connection failures
4. **Add filtering/routing** - Process specific events per tenant/camera
5. **Add monitoring** - Track event counts and latencies

---

**Status**: ✅ Complete & Ready  
**Build**: ✅ No TypeScript errors  
**Type Safety**: ✅ 100% strict mode  
**Testing**: ✅ Ready for manual testing
