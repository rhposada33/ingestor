#!/usr/bin/env node
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { getConfig } from './config/env.js';
import { ConfigManager } from './config/ConfigManager.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { initializeMqttSubsystem, shutdownMqttSubsystem, ingestorBus } from './mqtt/index.js';
import { normalizeMessage } from './mqtt/normalize.js';
import { handleFrigateEvent, handleFrigateReview } from './ingest/handler.js';
import type { FrigateEvent, FrigateReview } from './mqtt/bus.js';

/**
 * Main ingestion loop
 * Orchestrates:
 * 1. Environment & configuration loading
 * 2. Database connectivity
 * 3. MQTT broker connection
 * 4. Event subscription
 * 5. Message normalization
 * 6. Database persistence
 */
const main = async (): Promise<void> => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  🚀 Frigate Event Ingestor Starting...  ║');
  console.log('╚════════════════════════════════════════════╝\n');

  let isShuttingDown = false;

  try {
    // ============================================================
    // STEP 1: Load and validate environment configuration
    // ============================================================
    console.log('📋 Loading configuration...');
    const envConfig = getConfig();
    console.log(`   ✓ LOG_LEVEL: ${envConfig.logging.logLevel}`);

    // Initialize ConfigManager with validated config
    const configManager = ConfigManager.getInstance(envConfig);
    const config = configManager.getConfig();

    console.log(`   ✓ MQTT Broker: ${config.env.mqtt.brokerUrl}`);
    console.log(`   ✓ Database: PostgreSQL`);
    console.log(`   ✓ NODE_ENV: ${config.env.nodeEnv}`);

    // ============================================================
    // STEP 2: Connect to PostgreSQL database via Prisma
    // ============================================================
    console.log('\n🗄️  Connecting to PostgreSQL...');
    await connectDatabase();
    console.log('   ✓ Database connection established');

    // ============================================================
    // STEP 3: Initialize MQTT subsystem
    // ============================================================
    console.log('\n🔌 Initializing MQTT subsystem...');
    await initializeMqttSubsystem();
    console.log('   ✓ MQTT subsystem ready');

    // ============================================================
    // STEP 4: Attach ingestion handlers to ingestorBus events
    // ============================================================
    console.log('\n⚡ Setting up event handlers...');

    // Handle Frigate detection events
    ingestorBus.onFrigateEvent(async (rawEvent: FrigateEvent) => {
      try {
        // Normalize the raw event from MQTT
        const normalized = normalizeMessage(rawEvent, `frigate/${rawEvent.after.camera}/events`);

        if (!normalized) {
          console.warn('⚠️  Failed to normalize Frigate event:', {
            camera: rawEvent.after.camera,
            eventId: rawEvent.after.id,
            type: rawEvent.type,
          });
          return;
        }

        // Type guard: ensure it's an event, not review or availability
        if (!('hasSnapshot' in normalized)) {
          console.warn('⚠️  Received non-event message in onFrigateEvent handler');
          return;
        }

        // Persist normalized event to database
        const result = await handleFrigateEvent(normalized);

        if (result.success) {
          console.log('✓ Event persisted', {
            eventId: result.data?.frigateId,
            camera: result.data?.cameraId,
            type: result.data?.type,
          });
        } else {
          console.warn('⚠️  Event handler failed:', {
            error: result.error,
            reason: result.reason,
            eventId: rawEvent.after.id,
          });
        }
      } catch (error) {
        console.error('❌ Unexpected error in event handler:', error);
      }
    });

    // Handle Frigate review events
    ingestorBus.onFrigateReview(async (rawReview: FrigateReview) => {
      try {
        // Normalize the raw review from MQTT
        const normalized = normalizeMessage(rawReview, `frigate/${rawReview.camera}/reviews`);

        if (!normalized) {
          console.warn('⚠️  Failed to normalize review event:', {
            camera: rawReview.camera,
            reviewId: rawReview.id,
            severity: rawReview.severity,
          });
          return;
        }

        // Type guard: ensure it's a review, not event or availability
        if (!('reviewId' in normalized)) {
          console.warn('⚠️  Received non-review message in onFrigateReview handler');
          return;
        }

        // Persist normalized review to database
        const result = await handleFrigateReview(normalized);

        if (result.success) {
          console.log('✓ Review persisted', {
            reviewId: result.data?.reviewId,
            camera: result.data?.camera,
            severity: result.data?.severity,
          });
        } else {
          console.warn('⚠️  Review handler failed:', {
            error: result.error,
            reason: result.reason,
            reviewId: rawReview.id,
          });
        }
      } catch (error) {
        console.error('❌ Unexpected error in review handler:', error);
      }
    });

    console.log('   ✓ Event handlers attached');

    // ============================================================
    // STEP 5: Graceful shutdown handlers
    // ============================================================
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n⏹️  ${signal} received - Gracefully shutting down...\n`);

      try {
        // Step 1: Shutdown MQTT
        console.log('🔌 Disconnecting from MQTT...');
        await shutdownMqttSubsystem();
        console.log('   ✓ MQTT disconnected');

        // Step 2: Close database connection
        console.log('\n🗄️  Closing database connection...');
        await disconnectDatabase();
        console.log('   ✓ Database connection closed');

        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║  ✅ Ingestor Service Shutdown Complete   ║');
        console.log('╚════════════════════════════════════════════╝\n');

        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register graceful shutdown handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException').catch(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection').catch(() => process.exit(1));
    });

    // ============================================================
    // STEP 6: Startup complete
    // ============================================================
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  ✅ Ingestor Service Running Successfully ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n📊 Status:');
    console.log('   • MQTT: Connected and subscribed');
    console.log('   • Database: Connected');
    console.log('   • Event handlers: Active');
    console.log('\n📝 Logs:');
    console.log('   • Detection events: printed on persistence');
    console.log('   • Review events: printed on persistence');
    console.log('   • Errors: printed in real-time');
    console.log('\n⏹️  Press Ctrl+C to gracefully shutdown\n');
  } catch (error) {
    console.error('❌ Failed to start ingestor service:', error);
    console.error('\nShutting down due to startup error...');

    try {
      await disconnectDatabase().catch(() => {});
      await shutdownMqttSubsystem().catch(() => {});
    } catch (_) {
      // Ignore cleanup errors during startup failure
    }

    process.exit(1);
  }
};

// Start the application
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
