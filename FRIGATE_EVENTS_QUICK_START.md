# Frigate Events - Quick Reference

## What Was Created

✅ **`src/mqtt/bus.ts`** - Typed EventEmitter for Frigate events  
✅ **`src/mqtt/subscriber.ts`** - MQTT subscription & JSON parsing  
✅ **`FRIGATE_EVENTS_GUIDE.md`** - Complete documentation  

---

## Event Types

```typescript
// Detection event
FrigateEvent {
  before: { id, camera, label, top_score, ... },
  after: { id, camera, label, top_score, ... },
  type: 'new' | 'update' | 'end'
}

// Review/Alert
FrigateReview {
  id, camera, severity: 'alert' | 'detection', ...
}

// Availability
FrigateAvailable {
  available: boolean
}
```

---

## Quick Start

### 1. Subscribe to Events

```typescript
import { subscribeToFrigateEvents } from './mqtt/subscriber.js';
import { connectMqtt } from './mqtt/client.js';

const client = await connectMqtt();
await subscribeToFrigateEvents(client);
```

### 2. Listen for Events

```typescript
import { ingestorBus } from './mqtt/bus.js';

ingestorBus.onFrigateEvent((event) => {
  console.log(`Detection: ${event.after.label}`);
});

ingestorBus.onFrigateReview((review) => {
  console.log(`Review: ${review.severity}`);
});

ingestorBus.onFrigateAvailable((available) => {
  console.log(`Status: ${available.available ? 'online' : 'offline'}`);
});
```

### 3. Process Events

```typescript
ingestorBus.onFrigateEvent(async (event) => {
  if (event.type === 'end') {
    // Save to database
    await dbService.createEvent(
      tenantId,
      cameraId,
      event.after.id,
      event.after.label,
      event
    );
  }
});
```

---

## MQTT Topics Subscribed

| Topic | Event Type |
|-------|-----------|
| `frigate/events` | FrigateEvent |
| `frigate/reviews` | FrigateReview |
| `frigate/available/#` | FrigateAvailable |

---

## API Functions

```typescript
// Subscribe
await subscribeToFrigateEvents(client)

// Unsubscribe
unsubscribeFromFrigateEvents(client)

// Check status
isFrigateSubscribed(client)
```

---

## Event Bus Methods

```typescript
// Listen
ingestorBus.onFrigateEvent(listener)
ingestorBus.onFrigateReview(listener)
ingestorBus.onFrigateAvailable(listener)

// Listen once
ingestorBus.onceFrigateEvent(listener)
ingestorBus.onceFrigateReview(listener)
ingestorBus.onceFrigateAvailable(listener)

// Remove listener
ingestorBus.offFrigateEvent(listener)
ingestorBus.offFrigateReview(listener)
ingestorBus.offFrigateAvailable(listener)
```

---

## Complete Example

```typescript
import { connectMqtt, disconnectMqtt } from './mqtt/client.js';
import { subscribeToFrigateEvents } from './mqtt/subscriber.js';
import { ingestorBus } from './mqtt/bus.js';

async function main() {
  // Connect & subscribe
  const client = await connectMqtt();
  await subscribeToFrigateEvents(client);

  // Process events
  ingestorBus.onFrigateEvent(async (event) => {
    if (event.type === 'end') {
      console.log(`${event.after.label} detected on ${event.after.camera}`);
    }
  });

  // Shutdown
  process.on('SIGINT', async () => {
    await disconnectMqtt();
    process.exit(0);
  });
}

main();
```

---

## Event Structure

### Detection Event
```json
{
  "before": {
    "id": "123abc",
    "camera": "front_door",
    "label": "person",
    "top_score": 0.85
  },
  "after": {
    "id": "123abc",
    "camera": "front_door",
    "label": "person",
    "top_score": 0.95
  },
  "type": "update"
}
```

### Review Event
```json
{
  "id": "review123",
  "camera": "front_door",
  "severity": "alert",
  "data": {
    "type": "detection",
    "objects": ["person"]
  }
}
```

### Availability Event
```json
{
  "available": true
}
```

---

## Error Handling

```typescript
try {
  await subscribeToFrigateEvents(client);
} catch (error) {
  console.error('Subscription failed:', error.message);
}
```

Parse errors are logged automatically:
```
❌ Failed to parse message from frigate/events: Invalid JSON
```

---

## Testing

### Publish Test Event

```bash
mosquitto_pub -h localhost -t frigate/events -m '{
  "before": {"id": "test", "camera": "front", "label": "person", "top_score": 0.9, "start_time": 1},
  "after": {"id": "test", "camera": "front", "label": "person", "top_score": 0.95, "start_time": 1},
  "type": "update"
}'
```

---

**Build Status**: ✅ No errors  
**Type Safety**: ✅ 100% TypeScript strict  
**Ready to use**: ✅ Yes
