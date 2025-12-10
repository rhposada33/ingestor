# MQTT Integration Guide

Complete guide to integrating the MQTT subsystem into your main application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Module Architecture](#module-architecture)
3. [Integration Steps](#integration-steps)
4. [Lifecycle Management](#lifecycle-management)
5. [Event Handling](#event-handling)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Quick Start

### Minimal Integration

```typescript
// src/index.ts
import { initializeMqttSubsystem, shutdownMqttSubsystem } from './mqtt/index.js';

async function main() {
  try {
    // Start MQTT subsystem
    await initializeMqttSubsystem();

    // Graceful shutdown on termination
    process.on('SIGTERM', () => shutdownMqttSubsystem());
    process.on('SIGINT', () => shutdownMqttSubsystem());
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
```

## Module Architecture

The MQTT system is organized in layers:

```
┌─────────────────────────────────────────────────┐
│           Application Layer                     │
│  (Your event listeners and handlers)            │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│      MQTT Index Layer (mqtt/index.ts)           │
│  • initializeMqttSubsystem()                    │
│  • shutdownMqttSubsystem()                      │
│  • onFrigateEvent/Review/Available() helpers    │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
┌────────▼──┐ ┌──────▼────┐ ┌───▼──────────┐
│ Client    │ │ Subscriber│ │ Bus          │
│ (MQTT     │ │ (Topic    │ │ (EventEmitter)
│ connection)│ │ subscr.)  │ │ │
└────────────┘ └───────────┘ └──────────────┘
         │           │           │
         └───────────┴───────────┘
                     │
         ┌───────────▼───────────┐
         │   MQTT Broker         │
         │   (Frigate)           │
         └───────────────────────┘
```

### Module Files

| File | Purpose | Exports |
|------|---------|---------|
| `src/mqtt/client.ts` | Connection management | `connectMqtt`, `disconnectMqtt`, `getMqttClient`, `isMqttConnected`, `waitForMqttReady` |
| `src/mqtt/bus.ts` | Event emission | `IngestorBus`, `ingestorBus`, `getIngestorBus` |
| `src/mqtt/subscriber.ts` | Topic subscriptions | `subscribeToFrigateEvents`, `unsubscribeFromFrigateEvents`, `isFrigateSubscribed` |
| `src/mqtt/index.ts` | Integration layer | `initializeMqttSubsystem`, `shutdownMqttSubsystem`, `onFrigateEvent`, `onFrigateReview`, `onFrigateAvailable` |

## Integration Steps

### Step 1: Initialize MQTT at Application Startup

```typescript
// src/index.ts
import { initializeMqttSubsystem } from './mqtt/index.js';
import logger from './logger.js'; // Your logger

async function main() {
  logger.info('Starting ingestor application...');

  try {
    // Initialize MQTT subsystem
    // This connects to the broker and subscribes to Frigate topics
    await initializeMqttSubsystem();

    // Continue with other initialization...
    // await initializeDatabase();
    // await startServer();

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
```

### Step 2: Register Event Listeners

After initialization, register your event handlers:

```typescript
// src/index.ts
import {
  initializeMqttSubsystem,
  onFrigateEvent,
  onFrigateReview,
  onFrigateAvailable
} from './mqtt/index.js';
import { dbService } from './db/service.js';

async function main() {
  await initializeMqttSubsystem();

  // Listen for new detections
  onFrigateEvent(async (event) => {
    if (event.type === 'end') {
      // Save detection to database
      await dbService.createEvent({
        tenantId: 'default', // or get from event metadata
        cameraId: event.camera,
        data: JSON.stringify(event)
      });
    }
  });

  // Listen for reviews (user feedback)
  onFrigateReview(async (review) => {
    console.log(`Review received: ${review.severity} on ${review.camera}`);
    // Update event with review data
  });

  // Listen for camera availability
  onFrigateAvailable(async (status) => {
    console.log(`Camera ${status.camera} available: ${status.available}`);
    // Update camera status in database
  });
}
```

### Step 3: Handle Graceful Shutdown

```typescript
// src/index.ts
import { shutdownMqttSubsystem } from './mqtt/index.js';

async function main() {
  await initializeMqttSubsystem();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    try {
      // Unsubscribe and disconnect MQTT
      await shutdownMqttSubsystem();

      // Close other resources
      // await database.disconnect();

      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

## Lifecycle Management

### Connection Lifecycle

```
┌─────────────────────────────────────────┐
│ initializeMqttSubsystem()                │
│ ─ connects to MQTT broker                │
│ ─ subscribes to Frigate topics           │
│ ─ verifies ready state                   │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌────────────────┐
       │ MQTT Connected │  ◄─── App is ready to listen
       │ & Subscribed   │       for events
       └────────┬───────┘
                │
                │ (when app shuts down)
                ▼
    ┌──────────────────────┐
    │ shutdownMqttSubsystem()│
    │ ─ unsubscribes        │
    │ ─ disconnects         │
    │ ─ clears listeners    │
    └──────────────────────┘
```

### Key Points

1. **Initialization is blocking**: `initializeMqttSubsystem()` is async and waits for broker connection
2. **Subscriptions happen automatically**: Topics are subscribed immediately after connection
3. **Events can arrive anytime**: After init, Frigate events can arrive at any time
4. **Shutdown is graceful**: All unsubscriptions complete before disconnect

## Event Handling

### Available Event Types

#### 1. Frigate Detection Events

```typescript
import { onFrigateEvent } from './mqtt/index.js';

onFrigateEvent((event) => {
  // event.type: 'new' | 'update' | 'end'
  // event.camera: string
  // event.before?: { count: number; ... }
  // event.after?: { count: number; ... }

  if (event.type === 'new') {
    console.log(`New detection on ${event.camera}`);
  } else if (event.type === 'end') {
    console.log(`Detection ended on ${event.camera}`);
    // Save complete detection to database
  }
});
```

#### 2. Frigate Review Events

```typescript
import { onFrigateReview } from './mqtt/index.js';

onFrigateReview((review) => {
  // review.id: string (unique identifier)
  // review.camera: string
  // review.severity: 'alert' | 'detection' | 'review'
  // review.retracted: boolean
  // review.data: {...}

  if (!review.retracted) {
    console.log(`New review: ${review.severity} on ${review.camera}`);
  } else {
    console.log(`Review retracted: ${review.id}`);
  }
});
```

#### 3. Frigate Availability Events

```typescript
import { onFrigateAvailable } from './mqtt/index.js';

onFrigateAvailable((status) => {
  // status.available: boolean
  // Emitted when frigate becomes available or unavailable

  if (status.available) {
    console.log('Frigate service is online');
  } else {
    console.log('Frigate service is offline');
  }
});
```

### Multiple Listeners

You can register multiple listeners for the same event:

```typescript
// Listener 1: Save to database
onFrigateEvent(async (event) => {
  if (event.type === 'end') {
    await dbService.createEvent({ /* ... */ });
  }
});

// Listener 2: Send alert
onFrigateEvent(async (event) => {
  if (event.type === 'new') {
    await sendAlert(`Detection on ${event.camera}`);
  }
});

// Listener 3: Update metrics
onFrigateEvent((event) => {
  metrics.increment(`frigate.${event.camera}.detections`);
});
```

## Error Handling

### Connection Errors

```typescript
import { initializeMqttSubsystem } from './mqtt/index.js';

async function main() {
  try {
    await initializeMqttSubsystem();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Cannot connect')) {
        console.error('MQTT broker unreachable. Check MQTT_BROKER_URL');
      } else if (error.message.includes('Unauthorized')) {
        console.error('MQTT authentication failed. Check credentials');
      } else {
        console.error('MQTT initialization failed:', error.message);
      }
    }
    process.exit(1);
  }
}

main();
```

### Parse Errors

The subscriber module handles JSON parse errors gracefully:

```typescript
// If Frigate sends invalid JSON, it's logged and skipped
// Listener 3: Error handling in your event handler
onFrigateEvent((event) => {
  try {
    // Process event
  } catch (error) {
    console.error('Error processing event:', error);
    // Log to error tracking service
    // e.g., Sentry.captureException(error);
  }
});
```

### Retry Logic for Database Operations

```typescript
import { onFrigateEvent } from './mqtt/index.js';
import { dbService } from './db/service.js';

const MAX_RETRIES = 3;

async function saveEventWithRetry(event: any, retries = 0): Promise<void> {
  try {
    await dbService.createEvent({
      tenantId: 'default',
      cameraId: event.camera,
      data: JSON.stringify(event)
    });
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} for event ${event.camera}`);
      await new Promise(r => setTimeout(r, 1000 * (retries + 1))); // Exponential backoff
      await saveEventWithRetry(event, retries + 1);
    } else {
      console.error('Failed to save event after retries:', event);
      // Send to dead-letter queue or alert system
    }
  }
}

onFrigateEvent(async (event) => {
  if (event.type === 'end') {
    await saveEventWithRetry(event);
  }
});
```

## Testing

### Manual Testing with MQTT Client

```bash
# Install MQTT client tool (if not already installed)
npm install -g mqtt-cli

# Subscribe to see events
mqtt-cli sub -h localhost -t 'frigate/events' -v

# Or use another terminal tab:
mqtt-cli sub -h localhost -t 'frigate/reviews' -v
mqtt-cli sub -h localhost -t 'frigate/available/#' -v
```

### Publish Test Events

```bash
# Send a test detection event
mqtt-cli pub -h localhost \
  -t 'frigate/events' \
  -m '{
    "type": "end",
    "camera": "front_door",
    "before": {"count": 1},
    "after": {"count": 1}
  }'

# Send a test review event
mqtt-cli pub -h localhost \
  -t 'frigate/reviews' \
  -m '{
    "id": "test-123",
    "camera": "front_door",
    "severity": "alert",
    "retracted": false,
    "data": {}
  }'
```

### Application-Level Testing

```typescript
// test/mqtt.test.ts
import { initializeMqttSubsystem, onFrigateEvent } from '../src/mqtt/index.js';

describe('MQTT Integration', () => {
  it('should initialize MQTT subsystem', async () => {
    const result = await initializeMqttSubsystem();
    expect(result).toBeDefined();
    expect(result.connected).toBe(true);
  });

  it('should emit events when messages arrive', async () => {
    await initializeMqttSubsystem();

    const eventSpy = jest.fn();
    onFrigateEvent(eventSpy);

    // Publish test event (from another client)
    // Wait for event
    await new Promise(r => setTimeout(r, 100));

    expect(eventSpy).toHaveBeenCalled();
  });
});
```

## Troubleshooting

### MQTT Broker Connection Fails

**Symptom**: `Error: Cannot connect to MQTT broker`

**Solutions**:
1. Verify broker is running: `docker-compose ps`
2. Check MQTT_BROKER_URL: `echo $MQTT_BROKER_URL`
3. Verify network connectivity: `ping mqtt-broker`
4. Check broker logs: `docker-compose logs mqtt`

### Events Not Arriving

**Symptom**: Listeners registered but never called

**Solutions**:
1. Verify broker connection: `isMqttConnected()` should return true
2. Check Frigate is publishing: Monitor with external MQTT client
3. Verify event listener is registered before events arrive
4. Check console for parse errors

### High CPU Usage

**Symptom**: Node process using excessive CPU

**Potential causes**:
1. Event handler doing synchronous work (use async/await)
2. Infinite loop in event handler
3. Large number of events being buffered

**Solutions**:
```typescript
// ❌ Bad: Synchronous blocking work
onFrigateEvent((event) => {
  processLargeFile(event.data); // Blocks for milliseconds
});

// ✅ Good: Async work
onFrigateEvent(async (event) => {
  await processLargeFileAsync(event.data);
});
```

### Memory Leaks

**Symptom**: Memory usage grows over time

**Solutions**:
1. Ensure shutdown handler is called: Check `process.on('SIGTERM')`
2. Remove listeners when not needed: `ingestorBus.off('...')`
3. Limit event history: Don't buffer all events

### Disconnection and Reconnection

The MQTT client automatically reconnects if connection is lost:

```typescript
// The client will:
// 1. Attempt reconnect every 1 second
// 2. Timeout after 30 seconds
// 3. Log all reconnection attempts

// Check status at any time:
import { isMqttConnected } from './mqtt/index.js';

if (!isMqttConnected()) {
  console.log('MQTT is currently disconnected');
}
```

## Configuration Reference

All MQTT configuration comes from environment variables:

```bash
# Required
MQTT_BROKER_URL=mqtt://localhost:1883

# Optional (defaults to anonymous)
MQTT_USERNAME=frigate
MQTT_PASSWORD=frigate_password

# Optional
LOG_LEVEL=info
NODE_ENV=development
```

## Next Steps

1. **Integrate into main app**: Use `initializeMqttSubsystem()` in your main index.ts
2. **Add database persistence**: Connect event handlers to `dbService.createEvent()`
3. **Add monitoring**: Track event rates and errors
4. **Add tests**: Create test cases for event handling
5. **Deploy**: Use Docker Compose to deploy to production

---

**Need help?** See:
- `MQTT_CLIENT_GUIDE.md` - Low-level client API
- `FRIGATE_EVENTS_GUIDE.md` - Event types and structures
- `MQTT_SETUP.md` - Environment and configuration
