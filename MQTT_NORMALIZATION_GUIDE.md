# MQTT Payload Normalization Guide

Complete guide for using the payload normalization module (`src/mqtt/normalize.ts`).

## Overview

The normalization module provides **pure functions** to convert raw Frigate MQTT payloads into consistent, type-safe schemas. Functions are **defensive** and **never throw** - they return `null` on invalid data.

## Core Functions

### normalizeEventMessage()

Normalizes Frigate detection events.

```typescript
import { normalizeEventMessage } from './src/mqtt/normalize.js';

const normalized = normalizeEventMessage(rawPayload, 'frigate/events/front_door');

if (normalized) {
  console.log(normalized);
  // {
  //   frigateId: 'default',
  //   camera: 'front_door',
  //   type: 'end',
  //   label: 'person',
  //   hasSnapshot: true,
  //   hasClip: true,
  //   startTime: 1702200000,
  //   endTime: 1702200010,
  //   raw: { ... },
  //   metadata: { ... }
  // }
}
```

**Returns**: `NormalizedFrigateEvent | null`

**Fields**:
- `frigateId` - Frigate instance ID (extracted from topic or 'default')
- `camera` - Camera name (extracted from topic)
- `type` - Event lifecycle: 'new' | 'update' | 'end'
- `label` - Primary detected object (person, car, dog, cat, etc.)
- `hasSnapshot` - True if snapshot is available
- `hasClip` - True if clip is available
- `startTime` - Event start (Unix seconds)
- `endTime` - Event end (Unix seconds)
- `raw` - Original MQTT payload (for audit trail)
- `metadata` - Optional detection metadata (labels, zones, confidence, etc.)

**Input Format**:
```typescript
// Raw Frigate payload
{
  type: 'end',
  label: 'person',
  snapshot: true,      // or has_snapshot
  clip: true,          // or has_clip
  start_time: 1702200000,
  end_time: 1702200010,
  before: { count: 1, person: 1 },
  after: { count: 1, person: 1 },
  zones: ['front_porch'],
  sub_label: 'person_sitting'
}
```

---

### normalizeReviewMessage()

Normalizes Frigate review/alert events.

```typescript
import { normalizeReviewMessage } from './src/mqtt/normalize.js';

const normalized = normalizeReviewMessage(rawPayload, 'frigate/reviews/front_door');

if (normalized) {
  console.log(normalized);
  // {
  //   frigateId: 'default',
  //   reviewId: 'review-123',
  //   camera: 'front_door',
  //   severity: 'alert',
  //   retracted: false,
  //   timestamp: 1702200000,
  //   raw: { ... },
  //   metadata: { ... }
  // }
}
```

**Returns**: `NormalizedFrigateReview | null`

**Fields**:
- `frigateId` - Frigate instance ID
- `reviewId` - Review/event identifier (required)
- `camera` - Camera name
- `severity` - Review type: 'alert' | 'detection' | 'review'
- `retracted` - True if review was retracted by user
- `timestamp` - Review creation time (Unix seconds)
- `raw` - Original MQTT payload
- `metadata` - Optional metadata (reviewer, note, event ID, confidence, etc.)

**Input Format**:
```typescript
// Raw Frigate review payload
{
  id: 'review-123',
  severity: 'alert',
  retracted: false,
  timestamp: 1702200000,
  reviewer_email: 'user@example.com',
  note: 'False positive',
  event_id: 'event-456',
  confidence: 0.95
}
```

---

### normalizeAvailabilityMessage()

Normalizes Frigate availability status.

```typescript
import { normalizeAvailabilityMessage } from './src/mqtt/normalize.js';

const normalized = normalizeAvailabilityMessage('true', 'frigate/available');

if (normalized) {
  console.log(normalized);
  // {
  //   frigateId: 'default',
  //   available: true,
  //   timestamp: 1702200000,
  //   raw: { value: 'true' }
  // }
}
```

**Returns**: `NormalizedFrigateAvailable | null`

**Fields**:
- `frigateId` - Frigate instance ID
- `available` - Online status (boolean)
- `timestamp` - Status check time (Unix seconds, current time)
- `raw` - Original MQTT payload

**Input Format**:
```typescript
// Frigate sends plain string
'true' or 'false'

// Or JSON object
{
  available: true,
  online: true,  // alternative field name
  version: '0.13.0'
}
```

---

### normalizeMessage()

Auto-routing function - detects message type and calls appropriate normalizer.

```typescript
import { normalizeMessage } from './src/mqtt/normalize.js';

const normalized = normalizeMessage(rawPayload, topic);

if (normalized) {
  // Check type to determine what was normalized
  if ('type' in normalized) {
    // NormalizedFrigateEvent
    console.log(`Detection: ${normalized.label} on ${normalized.camera}`);
  } else if ('reviewId' in normalized) {
    // NormalizedFrigateReview
    console.log(`Review: ${normalized.severity} on ${normalized.camera}`);
  } else if ('available' in normalized) {
    // NormalizedFrigateAvailable
    console.log(`Frigate ${normalized.available ? 'online' : 'offline'}`);
  }
}
```

**Route Logic**:
- Topic contains `/events/` → `normalizeEventMessage()`
- Topic contains `/reviews` → `normalizeReviewMessage()`
- Topic contains `/available` → `normalizeAvailabilityMessage()`

---

## Validation Functions

### isValidNormalizedEvent()

Validates normalized event is ready for persistence.

```typescript
import { normalizeEventMessage, isValidNormalizedEvent } from './src/mqtt/normalize.js';

const normalized = normalizeEventMessage(payload, topic);

if (isValidNormalizedEvent(normalized)) {
  // Safe to save to database
  await saveEvent(normalized);
}
```

### isValidNormalizedReview()

Validates normalized review is ready for persistence.

```typescript
import { normalizeReviewMessage, isValidNormalizedReview } from './src/mqtt/normalize.js';

const normalized = normalizeReviewMessage(payload, topic);

if (isValidNormalizedReview(normalized)) {
  // Safe to save to database
  await saveReview(normalized);
}
```

### isValidNormalizedAvailable()

Validates normalized availability is ready for persistence.

```typescript
import { normalizeAvailabilityMessage, isValidNormalizedAvailable } from './src/mqtt/normalize.js';

const normalized = normalizeAvailabilityMessage(payload, topic);

if (isValidNormalizedAvailable(normalized)) {
  // Safe to save to database
  await saveStatus(normalized);
}
```

---

## Usage in MQTT Subscriber

Integrate normalization into your subscriber:

```typescript
import { ingestorBus } from './bus.js';
import { 
  normalizeEventMessage, 
  normalizeReviewMessage,
  normalizeAvailabilityMessage,
  isValidNormalizedEvent,
  isValidNormalizedReview,
  isValidNormalizedAvailable
} from './normalize.js';

export async function subscribeToFrigateEvents(client: MqttClient): Promise<void> {
  const topicHandlers = [
    {
      topic: 'frigate/+/events/+',
      handler: async (payload: Buffer, topic: string) => {
        try {
          const raw = JSON.parse(payload.toString());
          const normalized = normalizeEventMessage(raw, topic);

          if (isValidNormalizedEvent(normalized)) {
            // Emit to bus
            ingestorBus.emitFrigateEvent(normalized);
          } else {
            console.warn('Invalid normalized event', { topic, normalized });
          }
        } catch (error) {
          console.error('Failed to process event', { error, topic });
        }
      }
    },
    {
      topic: 'frigate/+/reviews',
      handler: async (payload: Buffer, topic: string) => {
        try {
          const raw = JSON.parse(payload.toString());
          const normalized = normalizeReviewMessage(raw, topic);

          if (isValidNormalizedReview(normalized)) {
            ingestorBus.emitFrigateReview(normalized);
          }
        } catch (error) {
          console.error('Failed to process review', { error, topic });
        }
      }
    },
    {
      topic: 'frigate/+/available',
      handler: async (payload: Buffer, topic: string) => {
        try {
          const raw = payload.toString();
          const normalized = normalizeAvailabilityMessage(raw, topic);

          if (isValidNormalizedAvailable(normalized)) {
            ingestorBus.emitFrigateAvailable(normalized);
          }
        } catch (error) {
          console.error('Failed to process availability', { error, topic });
        }
      }
    }
  ];

  // Subscribe to each topic
  for (const { topic, handler } of topicHandlers) {
    client.subscribe(topic);
    client.on('message', (msgTopic: string, payload: Buffer) => {
      if (matchTopic(topic, msgTopic)) {
        handler(payload, msgTopic).catch(error => {
          console.error('Handler error', { error, topic: msgTopic });
        });
      }
    });
  }
}
```

---

## Error Handling

All normalization functions are **defensive** - they never throw. Instead:

1. **Invalid input** → Returns `null`
2. **Missing field** → Uses sensible default or sets to `null`
3. **Type mismatch** → Coerces to expected type or returns `null`
4. **Unexpected error** → Logs warning and returns `null`

```typescript
const normalized = normalizeEventMessage(payload, topic);

if (normalized === null) {
  // Handle invalid data - log, skip, or send to dead-letter queue
  console.warn('Failed to normalize event', { payload, topic });
  return;
}

// Safe to use normalized
console.log(`Event from ${normalized.camera}`);
```

---

## Handling Multiple Frigate Instances

The normalization module extracts `frigateId` from MQTT topic:

```
frigate/events/front_door           → frigateId: 'default'
frigate/my-instance/events/camera-1 → frigateId: 'my-instance'
frigate/office/available            → frigateId: 'office'
```

Use `frigateId` to route events to correct tenant/instance:

```typescript
const normalized = normalizeEventMessage(payload, topic);

if (normalized) {
  const instance = await getInstanceById(normalized.frigateId);
  const camera = await getCamera(instance.id, normalized.camera);
  
  await saveEvent({
    tenantId: instance.tenantId,
    cameraId: camera.id,
    normalizedData: normalized
  });
}
```

---

## Futures & TODO Items

The module includes TODOs for future schema tightening:

### Event Normalization TODOs

```typescript
// @todo Add strict validation: enum for type values (new|update|end)
// @todo Add strict validation: enum for label values (person|car|dog|cat|etc)
// @todo Validate timestamp ranges (endTime >= startTime)
// @todo Add confidence/accuracy scores if available in raw payload
// @todo Add detection region/box coordinates when Frigate includes them
```

### Review Normalization TODOs

```typescript
// @todo Add strict validation: enum for severity (alert|detection|review)
// @todo Validate review timestamp
// @todo Add user identifier if available
// @todo Add review comment/note field
```

### Availability Normalization TODOs

```typescript
// @todo Add more detail on disconnection reasons
// @todo Add Frigate version information
// @todo Add uptime/availability metrics
```

These can be implemented as:

1. **Stricter validation** → Update validation functions
2. **Additional fields** → Expand metadata objects
3. **Enum types** → Create TypeScript enums for known values
4. **Timestamp validation** → Add range checking

---

## Examples

### Complete Event Handler

```typescript
import { normalizeEventMessage, isValidNormalizedEvent } from './normalize.js';
import { dbService } from '../db/service.js';

export async function handleFrigateEvent(payload: Record<string, unknown>, topic: string) {
  // 1. Normalize payload
  const normalized = normalizeEventMessage(payload, topic);

  // 2. Validate
  if (!isValidNormalizedEvent(normalized)) {
    console.warn('Invalid event data', { topic, payload });
    return;
  }

  // 3. Only process complete events
  if (normalized.type !== 'end') {
    console.debug('Skipping non-terminal event', {
      camera: normalized.camera,
      type: normalized.type
    });
    return;
  }

  // 4. Get or create camera
  let camera = await dbService.getCameraByName(
    normalized.frigateId,
    normalized.camera
  );

  if (!camera) {
    camera = await dbService.createCamera(
      normalized.frigateId,
      normalized.camera,
      `${normalized.camera} (auto-created)`
    );
  }

  // 5. Save event
  await dbService.createEvent({
    tenantId: normalized.frigateId,
    cameraId: camera.id,
    eventId: payload.id,
    data: JSON.stringify(normalized),
    hasSnapshot: normalized.hasSnapshot,
    hasClip: normalized.hasClip,
    startedAt: normalized.startTime ? new Date(normalized.startTime * 1000) : null,
    endedAt: normalized.endTime ? new Date(normalized.endTime * 1000) : null
  });

  console.info('Event saved', {
    camera: normalized.camera,
    label: normalized.label,
    duration: normalized.endTime && normalized.startTime 
      ? normalized.endTime - normalized.startTime 
      : 'unknown'
  });
}
```

### Batch Normalization

```typescript
import { normalizeMessage } from './normalize.js';

export async function processMqttMessages(
  messages: Array<{ payload: Record<string, unknown>; topic: string }>
) {
  const results = {
    events: [],
    reviews: [],
    available: [],
    invalid: []
  };

  for (const { payload, topic } of messages) {
    const normalized = normalizeMessage(payload, topic);

    if (!normalized) {
      results.invalid.push({ topic, payload });
      continue;
    }

    if ('type' in normalized) {
      results.events.push(normalized);
    } else if ('reviewId' in normalized) {
      results.reviews.push(normalized);
    } else if ('available' in normalized) {
      results.available.push(normalized);
    }
  }

  return results;
}
```

---

## Type Definitions

All types are exported from the module:

```typescript
export interface NormalizedFrigateEvent {
  frigateId: string;
  camera: string;
  type: 'new' | 'update' | 'end';
  label: string;
  hasSnapshot: boolean;
  hasClip: boolean;
  startTime: number | null;
  endTime: number | null;
  raw: Record<string, unknown>;
  metadata?: {
    topLabel?: string;
    topConfidence?: number;
    detectedLabels?: Record<string, number>;
    zones?: string[];
    subLabel?: string;
  };
}

export interface NormalizedFrigateReview {
  frigateId: string;
  reviewId: string;
  camera: string;
  severity: 'alert' | 'detection' | 'review';
  retracted: boolean;
  timestamp: number | null;
  raw: Record<string, unknown>;
  metadata?: {
    reviewerEmail?: string;
    note?: string;
    eventId?: string;
    confidence?: number;
  };
}

export interface NormalizedFrigateAvailable {
  frigateId: string;
  available: boolean;
  timestamp: number;
  raw: Record<string, unknown>;
  metadata?: {
    previousState?: boolean;
    duration?: number;
    version?: string;
  };
}
```

---

## Next Steps

1. **Integrate into subscriber** - Update `subscriber.ts` to use normalization
2. **Add database persistence** - Save normalized data to PostgreSQL
3. **Add schema validation** - Implement TODOs for stricter validation
4. **Add metrics** - Track normalization success rates
5. **Add tests** - Create test cases for edge cases

---

See also:
- `src/mqtt/normalize.ts` - Implementation
- `src/mqtt/bus.ts` - Event emitter
- `src/mqtt/subscriber.ts` - Topic subscriptions
- `src/mqtt/client.ts` - MQTT connection

