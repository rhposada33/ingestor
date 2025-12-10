# MQTT Normalization Quick Reference

**Fast lookup for the payload normalization module.**

## Import

```typescript
import {
  // Main functions
  normalizeEventMessage,
  normalizeReviewMessage,
  normalizeAvailabilityMessage,
  normalizeMessage,
  
  // Validators
  isValidNormalizedEvent,
  isValidNormalizedReview,
  isValidNormalizedAvailable,
  
  // Types
  NormalizedFrigateEvent,
  NormalizedFrigateReview,
  NormalizedFrigateAvailable
} from './src/mqtt/normalize.js';
```

## Main Functions

### normalizeEventMessage()
```typescript
const event = normalizeEventMessage(payload, topic);
// Returns: NormalizedFrigateEvent | null
```

### normalizeReviewMessage()
```typescript
const review = normalizeReviewMessage(payload, topic);
// Returns: NormalizedFrigateReview | null
```

### normalizeAvailabilityMessage()
```typescript
const available = normalizeAvailabilityMessage(payload, topic);
// Returns: NormalizedFrigateAvailable | null
```

### normalizeMessage()
```typescript
const normalized = normalizeMessage(payload, topic);
// Auto-detects and routes to appropriate normalizer
// Returns: NormalizedFrigateEvent | NormalizedFrigateReview | NormalizedFrigateAvailable | null
```

## Validation

```typescript
if (isValidNormalizedEvent(event)) {
  // Safe to save
}

if (isValidNormalizedReview(review)) {
  // Safe to save
}

if (isValidNormalizedAvailable(available)) {
  // Safe to save
}
```

## NormalizedFrigateEvent Fields

| Field | Type | Description |
|-------|------|-------------|
| `frigateId` | string | Frigate instance ID |
| `camera` | string | Camera name |
| `type` | 'new'\|'update'\|'end' | Event type |
| `label` | string | Primary detection label |
| `hasSnapshot` | boolean | Snapshot available? |
| `hasClip` | boolean | Clip available? |
| `startTime` | number\|null | Event start (Unix seconds) |
| `endTime` | number\|null | Event end (Unix seconds) |
| `raw` | object | Original MQTT payload |
| `metadata` | object | Optional: labels, zones, confidence |

## NormalizedFrigateReview Fields

| Field | Type | Description |
|-------|------|-------------|
| `frigateId` | string | Frigate instance ID |
| `reviewId` | string | Review ID (required) |
| `camera` | string | Camera name |
| `severity` | 'alert'\|'detection'\|'review' | Review type |
| `retracted` | boolean | Was review retracted? |
| `timestamp` | number\|null | Review time (Unix seconds) |
| `raw` | object | Original MQTT payload |
| `metadata` | object | Optional: email, note, event ID, confidence |

## NormalizedFrigateAvailable Fields

| Field | Type | Description |
|-------|------|-------------|
| `frigateId` | string | Frigate instance ID |
| `available` | boolean | Online status |
| `timestamp` | number | Status check time (Unix seconds) |
| `raw` | object | Original MQTT payload |
| `metadata` | object | Optional: previous state, duration, version |

## Common Patterns

### Basic Usage
```typescript
const normalized = normalizeEventMessage(payload, topic);
if (normalized) {
  console.log(`${normalized.label} on ${normalized.camera}`);
}
```

### With Validation
```typescript
const normalized = normalizeEventMessage(payload, topic);
if (isValidNormalizedEvent(normalized)) {
  await database.save(normalized);
}
```

### Auto-Routing
```typescript
const normalized = normalizeMessage(payload, topic);
if (normalized && 'type' in normalized) {
  // It's an event
}
```

### Error Handling
```typescript
const normalized = normalizeEventMessage(payload, topic);
if (!normalized) {
  console.warn('Failed to normalize', { topic, payload });
  return;
}
// Use normalized safely
```

## MQTT Topics

| Topic | Handler | Returns |
|-------|---------|---------|
| `frigate/events/<camera>` | `normalizeEventMessage()` | `NormalizedFrigateEvent` |
| `frigate/<id>/events/<camera>` | `normalizeEventMessage()` | `NormalizedFrigateEvent` |
| `frigate/reviews` | `normalizeReviewMessage()` | `NormalizedFrigateReview` |
| `frigate/<id>/reviews` | `normalizeReviewMessage()` | `NormalizedFrigateReview` |
| `frigate/available` | `normalizeAvailabilityMessage()` | `NormalizedFrigateAvailable` |
| `frigate/<id>/available` | `normalizeAvailabilityMessage()` | `NormalizedFrigateAvailable` |

## Properties

### Defensive Behavior

- ✅ Never throws
- ✅ Returns null on invalid input
- ✅ Logs warnings/errors
- ✅ Safe type coercion
- ✅ Sensible defaults

### Multi-Instance Support

```typescript
// Topic: frigate/my-instance/events/front_door
const event = normalizeEventMessage(payload, topic);
event.frigateId === 'my-instance' // ✓ true
```

### Raw Payload Preserved

```typescript
const event = normalizeEventMessage(payload, topic);
event.raw === payload // ✓ true (for audit trail)
```

## Complete Example

```typescript
import {
  normalizeEventMessage,
  isValidNormalizedEvent
} from './src/mqtt/normalize.js';

async function handleEvent(payload: Buffer, topic: string) {
  // 1. Parse JSON
  const raw = JSON.parse(payload.toString());
  
  // 2. Normalize
  const event = normalizeEventMessage(raw, topic);
  
  // 3. Validate
  if (!isValidNormalizedEvent(event)) {
    console.warn('Invalid event', { topic });
    return;
  }
  
  // 4. Process
  console.log(`Detection: ${event.label} on ${event.camera}`);
  
  // 5. Save
  await db.createEvent({
    tenantId: event.frigateId,
    cameraId: event.camera,
    data: JSON.stringify(event)
  });
}
```

## Performance

- **Time per normalization**: <1ms
- **Memory per event**: ~2KB
- **No external dependencies**: Pure functions
- **Async-safe**: Can run in parallel

## See Also

- Full guide: `MQTT_NORMALIZATION_GUIDE.md`
- Implementation: `src/mqtt/normalize.ts`
- Integration: `src/mqtt/subscriber.ts` (TODO)
