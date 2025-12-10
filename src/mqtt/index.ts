/**
 * Example: How to use the MQTT client in your application
 * 
 * This file demonstrates the proper integration pattern for the MQTT client module.
 * You can adapt this for your actual use case.
 */

import { connectMqtt, disconnectMqtt, isMqttConnected } from './client.js';

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
