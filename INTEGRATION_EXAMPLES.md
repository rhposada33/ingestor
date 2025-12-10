# Complete Integration Examples

Ready-to-use code examples for integrating the MQTT subsystem into your application.

## Table of Contents

1. [Basic Initialization](#basic-initialization)
2. [With Database Integration](#with-database-integration)
3. [With Logging](#with-logging)
4. [With Error Handling](#with-error-handling)
5. [With Metrics](#with-metrics)
6. [Full Production Example](#full-production-example)

## Basic Initialization

**File: `src/index.ts`**

```typescript
import { initializeMqttSubsystem, shutdownMqttSubsystem } from './mqtt/index.js';

async function main() {
  try {
    // Initialize MQTT
    await initializeMqttSubsystem();

    // Handle shutdown
    process.on('SIGTERM', shutdownMqttSubsystem);
    process.on('SIGINT', shutdownMqttSubsystem);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
```

## With Database Integration

**File: `src/index.ts`**

```typescript
import { initializeMqttSubsystem, shutdownMqttSubsystem, onFrigateEvent } from './mqtt/index.js';
import { dbService } from './db/service.js';

async function main() {
  try {
    // Initialize database
    const client = await dbService.connect();
    console.log('✅ Database connected');

    // Initialize MQTT
    await initializeMqttSubsystem();
    console.log('✅ MQTT initialized');

    // Register event handlers
    setupEventHandlers();

    // Handle shutdown
    const shutdown = async () => {
      console.log('Shutting down...');
      await shutdownMqttSubsystem();
      await dbService.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function setupEventHandlers() {
  // Save completed detections to database
  onFrigateEvent(async (event) => {
    if (event.type === 'end') {
      try {
        await dbService.createEvent({
          tenantId: 'default',
          cameraId: event.camera,
          data: JSON.stringify(event)
        });
        console.log(`✅ Saved event: ${event.camera}`);
      } catch (error) {
        console.error(`❌ Failed to save event:`, error);
      }
    }
  });
}

main();
```

## With Logging

**File: `src/index.ts`**

```typescript
import { initializeMqttSubsystem, shutdownMqttSubsystem, onFrigateEvent, onFrigateReview, onFrigateAvailable } from './mqtt/index.js';
import { dbService } from './db/service.js';
import logger from './logger.js'; // Your logger (Winston, Pino, etc.)

async function main() {
  logger.info('Starting ingestor...');

  try {
    // Initialize database
    await dbService.connect();
    logger.info('Database connected');

    // Initialize MQTT
    await initializeMqttSubsystem();
    logger.info('MQTT subsystem initialized');

    // Setup event handlers
    setupEventHandlers();

    logger.info('Application started successfully');

    // Handle shutdown
    const shutdown = async () => {
      logger.info('Shutdown signal received');
      await shutdownMqttSubsystem();
      await dbService.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Fatal error during startup', { error });
    process.exit(1);
  }
}

function setupEventHandlers() {
  // Detection events
  onFrigateEvent((event) => {
    switch (event.type) {
      case 'new':
        logger.debug('New detection', {
          camera: event.camera,
          objects: event.after?.count || 0
        });
        break;
      case 'update':
        logger.debug('Detection update', {
          camera: event.camera,
          objects: event.after?.count || 0
        });
        break;
      case 'end':
        logger.info('Detection completed', {
          camera: event.camera,
          duration: event.end_time ? event.end_time - event.start_time : 'unknown'
        });
        // Save to database
        break;
    }
  });

  // Review events
  onFrigateReview((review) => {
    logger.info('Frigate review', {
      id: review.id,
      camera: review.camera,
      severity: review.severity,
      retracted: review.retracted
    });
  });

  // Availability events
  onFrigateAvailable((status) => {
    logger.info('Frigate availability changed', {
      available: status.available
    });
  });
}

main();
```

## With Error Handling

**File: `src/index.ts`**

```typescript
import { initializeMqttSubsystem, shutdownMqttSubsystem, onFrigateEvent } from './mqtt/index.js';
import { dbService } from './db/service.js';
import logger from './logger.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function main() {
  try {
    // Initialize with retry logic
    await initializeWithRetry();

    // Setup handlers
    setupEventHandlers();

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Fatal startup error', { error });
    process.exit(1);
  }
}

async function initializeWithRetry(attempt = 1): Promise<void> {
  try {
    await dbService.connect();
    logger.info('Database connected');

    await initializeMqttSubsystem();
    logger.info('MQTT initialized');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      logger.warn(`Initialization failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`, { error });
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return initializeWithRetry(attempt + 1);
    }
    throw error;
  }
}

async function saveEventWithRetry(event: any, attempt = 1): Promise<void> {
  try {
    await dbService.createEvent({
      tenantId: 'default',
      cameraId: event.camera,
      data: JSON.stringify(event)
    });
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      logger.warn(`Failed to save event (attempt ${attempt}/${MAX_RETRIES}), retrying...`, {
        error,
        camera: event.camera
      });
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return saveEventWithRetry(event, attempt + 1);
    }
    logger.error('Failed to save event after retries', {
      error,
      camera: event.camera,
      event
    });
    // Could send to dead-letter queue or alert system
  }
}

function setupEventHandlers() {
  onFrigateEvent(async (event) => {
    if (event.type === 'end') {
      try {
        await saveEventWithRetry(event);
      } catch (error) {
        logger.error('Unhandled error in event handler', { error });
      }
    }
  });
}

async function gracefulShutdown() {
  logger.info('Shutdown signal received, cleaning up...');

  try {
    await shutdownMqttSubsystem();
    await dbService.disconnect();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

main();
```

## With Metrics

**File: `src/index.ts`**

```typescript
import { initializeMqttSubsystem, shutdownMqttSubsystem, onFrigateEvent, onFrigateReview } from './mqtt/index.js';
import { dbService } from './db/service.js';
import logger from './logger.js';

// Simple metrics collector
class Metrics {
  private counts: Record<string, number> = {};

  increment(key: string) {
    this.counts[key] = (this.counts[key] || 0) + 1;
  }

  get(key: string): number {
    return this.counts[key] || 0;
  }

  getAll(): Record<string, number> {
    return { ...this.counts };
  }

  reset() {
    this.counts = {};
  }
}

const metrics = new Metrics();

async function main() {
  try {
    await dbService.connect();
    await initializeMqttSubsystem();

    setupEventHandlers();
    setupMetricsReporting();

    process.on('SIGTERM', async () => {
      await shutdownMqttSubsystem();
      await dbService.disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error', { error });
    process.exit(1);
  }
}

function setupEventHandlers() {
  onFrigateEvent((event) => {
    metrics.increment('total_events');
    metrics.increment(`events_${event.type}`);
    metrics.increment(`camera_${event.camera}_events`);

    if (event.type === 'end') {
      metrics.increment('completed_detections');
    }
  });

  onFrigateReview((review) => {
    metrics.increment('total_reviews');
    metrics.increment(`review_${review.severity}`);

    if (review.retracted) {
      metrics.increment('reviews_retracted');
    }
  });
}

function setupMetricsReporting() {
  // Log metrics every 60 seconds
  setInterval(() => {
    const allMetrics = metrics.getAll();
    logger.info('Metrics snapshot', {
      timestamp: new Date().toISOString(),
      metrics: allMetrics
    });
  }, 60_000);
}

main();
```

## Full Production Example

**File: `src/index.ts`**

```typescript
import 'dotenv/config.js';
import {
  initializeMqttSubsystem,
  shutdownMqttSubsystem,
  onFrigateEvent,
  onFrigateReview,
  onFrigateAvailable
} from './mqtt/index.js';
import { dbService } from './db/service.js';
import logger from './logger.js';

// ==================== TYPES ====================

interface EventMetrics {
  totalEvents: number;
  eventsNew: number;
  eventsUpdate: number;
  eventsEnd: number;
  eventsProcessed: number;
  eventsFailed: number;
}

interface AppState {
  isInitialized: boolean;
  isShuttingDown: boolean;
  metrics: EventMetrics;
}

// ==================== STATE ====================

const appState: AppState = {
  isInitialized: false,
  isShuttingDown: false,
  metrics: {
    totalEvents: 0,
    eventsNew: 0,
    eventsUpdate: 0,
    eventsEnd: 0,
    eventsProcessed: 0,
    eventsFailed: 0
  }
};

// ==================== INITIALIZATION ====================

async function initializeApplication(): Promise<void> {
  logger.info('🚀 Starting ingestor application...');
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📝 Log level: ${process.env.LOG_LEVEL || 'info'}`);

  try {
    // Step 1: Initialize database
    logger.info('📦 Connecting to database...');
    await dbService.connect();
    logger.info('✅ Database connected successfully');

    // Step 2: Initialize MQTT
    logger.info('🔌 Initializing MQTT subsystem...');
    await initializeMqttSubsystem();
    logger.info('✅ MQTT subsystem initialized successfully');

    // Step 3: Setup event handlers
    logger.info('📡 Setting up event handlers...');
    setupEventHandlers();
    logger.info('✅ Event handlers configured');

    // Step 4: Setup metrics reporting
    setupMetricsReporting();

    // Step 5: Setup graceful shutdown
    setupShutdownHandlers();

    appState.isInitialized = true;
    logger.info('✅ Application initialized successfully');
    logger.info('📊 Ready to ingest Frigate events');
  } catch (error) {
    logger.error('❌ Failed to initialize application', { error });
    process.exit(1);
  }
}

// ==================== EVENT HANDLERS ====================

function setupEventHandlers(): void {
  // Detection events
  onFrigateEvent(async (event) => {
    try {
      // Update metrics
      appState.metrics.totalEvents++;
      switch (event.type) {
        case 'new':
          appState.metrics.eventsNew++;
          break;
        case 'update':
          appState.metrics.eventsUpdate++;
          break;
        case 'end':
          appState.metrics.eventsEnd++;
          // Save to database
          await handleDetectionEnded(event);
          appState.metrics.eventsProcessed++;
          break;
      }

      logger.debug('Event processed', {
        type: event.type,
        camera: event.camera
      });
    } catch (error) {
      appState.metrics.eventsFailed++;
      logger.error('Error processing event', {
        error,
        event
      });
    }
  });

  // Review events
  onFrigateReview((review) => {
    logger.info('Frigate review received', {
      id: review.id,
      camera: review.camera,
      severity: review.severity,
      retracted: review.retracted
    });
  });

  // Availability events
  onFrigateAvailable((status) => {
    logger.info('Frigate status changed', {
      available: status.available
    });
  });
}

async function handleDetectionEnded(event: any): Promise<void> {
  const MAX_RETRIES = 3;

  async function attempt(retryCount: number): Promise<void> {
    try {
      await dbService.createEvent({
        tenantId: 'default',
        cameraId: event.camera,
        data: JSON.stringify(event)
      });

      logger.debug('Event saved to database', {
        camera: event.camera,
        eventId: event.id
      });
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        logger.warn(`Failed to save event, retrying (${retryCount}/${MAX_RETRIES})`, {
          error,
          camera: event.camera
        });

        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retryCount)));
        return attempt(retryCount + 1);
      }

      logger.error('Failed to save event after retries', {
        error,
        camera: event.camera
      });

      // In production, send to dead-letter queue or alert system
      // await deadLetterQueue.add(event);
      // await alerting.sendAlert(`Failed to save event from ${event.camera}`);
    }
  }

  return attempt(0);
}

// ==================== METRICS ====================

function setupMetricsReporting(): void {
  // Report metrics every 60 seconds
  const interval = setInterval(() => {
    if (appState.isShuttingDown) {
      clearInterval(interval);
      return;
    }

    logger.info('📊 Metrics snapshot', {
      timestamp: new Date().toISOString(),
      ...appState.metrics
    });
  }, 60_000);

  // Also log on shutdown
  process.on('exit', () => {
    logger.info('📊 Final metrics', {
      timestamp: new Date().toISOString(),
      ...appState.metrics
    });
  });
}

// ==================== SHUTDOWN ====================

function setupShutdownHandlers(): void {
  const gracefulShutdown = async (signal: string) => {
    if (appState.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    appState.isShuttingDown = true;
    logger.info(`\n⏹️  ${signal} received, initiating graceful shutdown...`);

    try {
      // Step 1: Stop accepting new work
      logger.info('🛑 Stopping event handlers...');

      // Step 2: Shutdown MQTT (stop receiving events)
      logger.info('🔌 Shutting down MQTT subsystem...');
      await shutdownMqttSubsystem();
      logger.info('✅ MQTT shutdown complete');

      // Step 3: Close database connections
      logger.info('📦 Disconnecting from database...');
      await dbService.disconnect();
      logger.info('✅ Database disconnected');

      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown', { error });
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception', { error });
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled rejection', { reason });
    gracefulShutdown('unhandledRejection');
  });
}

// ==================== MAIN ====================

initializeApplication();
```

## Using These Examples

1. **Choose the example** that best fits your needs
2. **Copy the code** into your `src/index.ts`
3. **Adjust imports** as needed (logger path, db service path)
4. **Update configuration** (tenantId, camera names, etc.)
5. **Run the application**: `npm run dev`

## Testing the Integration

After implementing one of these examples:

```bash
# 1. Start the application
npm run dev

# 2. In another terminal, publish a test event
mqtt-cli pub -h localhost \
  -t 'frigate/events' \
  -m '{
    "type": "end",
    "camera": "front_door",
    "before": {"count": 1},
    "after": {"count": 1},
    "id": "test-event-1",
    "start_time": 1000,
    "end_time": 2000
  }'

# 3. Check the application logs
# You should see:
# - Event received and parsed
# - Saved to database
# - Metrics updated
```

## Next Steps

1. **Adapt to your needs**: Modify event handlers for your use case
2. **Add authentication**: Implement multi-tenant support
3. **Add monitoring**: Integrate with your monitoring system (Prometheus, DataDog, etc.)
4. **Deploy**: Use Docker Compose to deploy to production
5. **Scale**: Add message queues (RabbitMQ, Kafka) for high throughput

---

For more details, see:
- `MQTT_INTEGRATION_GUIDE.md` - Complete integration guide
- `FRIGATE_EVENTS_GUIDE.md` - Event types and structures
- `MQTT_CLIENT_GUIDE.md` - Low-level MQTT API
