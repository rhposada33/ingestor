/**
 * MQTT Module Exports and Integration Examples
 *
 * This file provides:
 * 1. Public exports from MQTT modules
 * 2. Integration functions for the main app
 * 3. Example usage patterns
 */

// Export all MQTT client functions
export * from './client.js';

// Export event bus and types
export * from './bus.js';

// Export subscriber functions
export * from './subscriber.js';

import { connectMqtt, disconnectMqtt, isMqttConnected } from './client.js';
import { subscribeToFrigateEvents, unsubscribeFromFrigateEvents } from './subscriber.js';
import { ingestorBus } from './bus.js';
import { getMqttClient } from './client.js';

/**
 * Initialize MQTT subsystem
 *
 * This function sets up the complete MQTT infrastructure:
 * 1. Connects to the MQTT broker
 * 2. Sets up event subscriptions (Frigate topics)
 * 3. Registers event listeners for application use
 *
 * Call this in your main application initialization (e.g., src/index.ts)
 *
 * @example
 * ```typescript
 * import { initializeMqttSubsystem } from './mqtt/index.js';
 * import { dbService } from './db/service.js';
 *
 * async function main() {
 *   const mqttClient = await initializeMqttSubsystem();
 *   console.log('MQTT subsystem ready');
 *
 *   // Listen for Frigate events and save to database
 *   ingestorBus.onFrigateEvent(async (event) => {
 *     if (event.type === 'end') {
 *       await dbService.createEvent({
 *         tenantId: 'default',
 *         cameraId: event.camera,
 *         data: JSON.stringify(event)
 *       });
 *     }
 *   });
 * }
 * ```
 */
export async function initializeMqttSubsystem() {
  console.log('🔌 Initializing MQTT subsystem...');

  try {
    // Step 1: Connect to MQTT broker
    const client = await connectMqtt();
    console.log('✅ Connected to MQTT broker');

    // Step 2: Subscribe to Frigate topics
    await subscribeToFrigateEvents(client);
    console.log('✅ Subscribed to Frigate events');

    // Step 3: Ensure client is ready
    if (!isMqttConnected()) {
      throw new Error('MQTT client connected but not in ready state');
    }

    console.log('✅ MQTT subsystem initialized successfully');
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize MQTT subsystem:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown MQTT subsystem
 *
 * This function performs cleanup:
 * 1. Unsubscribes from all Frigate topics
 * 2. Disconnects from MQTT broker
 * 3. Clears event listeners
 *
 * Call this when your application is shutting down
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   console.log('Shutting down...');
 *   await shutdownMqttSubsystem();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownMqttSubsystem() {
  console.log('🔌 Shutting down MQTT subsystem...');

  try {
    const client = getMqttClient();

    // Step 1: Unsubscribe from Frigate topics
    if (client) {
      await unsubscribeFromFrigateEvents(client);
      console.log('✅ Unsubscribed from Frigate events');
    }

    // Step 2: Disconnect from broker
    await disconnectMqtt();
    console.log('✅ Disconnected from MQTT broker');

    // Step 3: Remove all event listeners
    ingestorBus.removeAllListeners();
    console.log('✅ Cleared event listeners');

    console.log('✅ MQTT subsystem shutdown complete');
  } catch (error) {
    console.error('❌ Error during MQTT subsystem shutdown:', error);
    throw error;
  }
}

/**
 * Register a listener for Frigate detection events
 *
 * Convenience wrapper around ingestorBus.onFrigateEvent()
 * Useful for setting up multiple listeners in your main app
 *
 * @param callback Function to call when Frigate event is detected
 *
 * @example
 * ```typescript
 * import { onFrigateEvent } from './mqtt/index.js';
 *
 * onFrigateEvent((event) => {
 *   console.log(`Detection: ${event.type} on ${event.camera}`);
 *   // Process event...
 * });
 * ```
 */
export function onFrigateEvent(
  callback: (event: any) => void | Promise<void>
): void {
  ingestorBus.onFrigateEvent(callback);
}

/**
 * Register a listener for Frigate review/alert events
 *
 * Convenience wrapper around ingestorBus.onFrigateReview()
 * Useful for handling review requests and alerts
 *
 * @param callback Function to call when Frigate review is submitted
 *
 * @example
 * ```typescript
 * import { onFrigateReview } from './mqtt/index.js';
 *
 * onFrigateReview((review) => {
 *   console.log(`Review: ${review.severity} on ${review.camera}`);
 *   // Store review...
 * });
 * ```
 */
export function onFrigateReview(
  callback: (review: any) => void | Promise<void>
): void {
  ingestorBus.onFrigateReview(callback);
}

/**
 * Register a listener for Frigate availability status
 *
 * Convenience wrapper around ingestorBus.onFrigateAvailable()
 * Useful for monitoring camera availability
 *
 * @param callback Function to call when availability status changes
 *
 * @example
 * ```typescript
 * import { onFrigateAvailable } from './mqtt/index.js';
 *
 * onFrigateAvailable((status) => {
 *   console.log(`Camera available: ${status.available}`);
 *   // Update camera status in database...
 * });
 * ```
 */
export function onFrigateAvailable(
  callback: (status: any) => void | Promise<void>
): void {
  ingestorBus.onFrigateAvailable(callback);
}

/**
 * Initialize MQTT connection for the application
 * Call this during app startup
 */
export async function initializeMqtt() {
  try {
    console.log('🔌 Initializing MQTT connection...');
    
    // Connect to MQTT broker
    const client = await connectMqtt();
    
    console.log('✅ MQTT connection established');
    
    return client;
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Failed to initialize MQTT:', error.message);
    }
    throw error;
  }
}

/**
 * Gracefully shutdown MQTT connection
 * Call this during app shutdown (e.g., on SIGINT)
 */
export async function shutdownMqtt() {
  try {
    if (isMqttConnected()) {
      console.log('🛑 Shutting down MQTT connection...');
      await disconnectMqtt();
      console.log('✅ MQTT connection closed');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error during MQTT shutdown:', error.message);
    }
  }
}

/**
 * Example: Integration with main application
 * 
 * Usage in src/index.ts:
 * 
 * import { initializeMqtt, shutdownMqtt } from './mqtt/index.js';
 * 
 * async function main() {
 *   try {
 *     // Connect to database
 *     await connectDatabase();
 *     
 *     // Initialize MQTT
 *     await initializeMqtt();
 *     
 *     console.log('🚀 Ingestor service running');
 *     
 *     // Setup graceful shutdown
 *     process.on('SIGINT', async () => {
 *       console.log('⚠️  Shutdown signal received');
 *       await shutdownMqtt();
 *       await disconnectDatabase();
 *       process.exit(0);
 *     });
 *     
 *   } catch (error) {
 *     console.error('❌ Failed to start service:', error);
 *     process.exit(1);
 *   }
 * }
 */

// Example event handling (for future implementation)
/*
import { getMqttClient } from './client.js';

export function subscribeToFrigateEvents() {
  const client = getMqttClient();
  
  if (!client) {
    throw new Error('MQTT client not connected');
  }
  
  // Subscribe to Frigate event topic
  client.subscribe('frigate/events/#', (err) => {
    if (err) {
      console.error('Failed to subscribe:', err);
    } else {
      console.log('✅ Subscribed to Frigate events');
    }
  });
  
  // Handle incoming messages
  client.on('message', (topic, payload) => {
    const message = JSON.parse(payload.toString());
    console.log(`Received event from ${topic}:`, message);
    
    // Process event and save to database
    // processEvent(message);
  });
}
*/
