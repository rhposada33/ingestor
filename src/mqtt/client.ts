import mqtt from 'mqtt';
import type { MqttClient as MqttClientType } from 'mqtt';
import { getConfig } from '../config/env.js';

/**
 * Singleton MQTT client instance
 * Using global to prevent multiple instances in hot reload scenarios
 */
const globalForMqtt = global as unknown as {
  mqttClient: MqttClientType | undefined;
  mqttConnecting: Promise<MqttClientType> | undefined;
};

/**
 * Connects to MQTT broker and returns a connected client
 * Handles connection readiness with async/await pattern
 *
 * @returns Promise that resolves when MQTT client is connected
 * @throws Error if connection fails or config is invalid
 */
export async function connectMqtt(): Promise<MqttClientType> {
  // Return existing connection if already connected
  if (globalForMqtt.mqttClient?.connected) {
    console.log('📡 MQTT already connected, returning existing client');
    return globalForMqtt.mqttClient;
  }

  // If connection is in progress, return the same promise
  if (globalForMqtt.mqttConnecting) {
    console.log('📡 MQTT connection in progress, awaiting...');
    return globalForMqtt.mqttConnecting;
  }

  // Create new connection promise
  globalForMqtt.mqttConnecting = createMqttConnection();

  try {
    const client = await globalForMqtt.mqttConnecting;
    globalForMqtt.mqttClient = client;
    globalForMqtt.mqttConnecting = undefined;
    return client;
  } catch (error) {
    globalForMqtt.mqttConnecting = undefined;
    throw error;
  }
}

/**
 * Internal function to create and configure MQTT connection
 */
function createMqttConnection(): Promise<MqttClientType> {
  return new Promise((resolve, reject) => {
    try {
      const config = getConfig();
      const { brokerUrl, username, password } = config.mqtt;

      console.log('📡 Connecting to MQTT broker...');
      console.log(`   URL: ${brokerUrl}`);
      if (username) {
        console.log(`   Username: ${username}`);
      }

      // Create client with connection options
      const client = mqtt.connect(brokerUrl, {
        username: username || undefined,
        password: password || undefined,
        // Connection options
        reconnectPeriod: 1000, // Reconnect after 1 second
        connectTimeout: 30000, // Connection timeout 30 seconds
        keepalive: 60, // Keep alive ping every 60 seconds
        clientId: `ingestor-${Date.now()}`, // Unique client ID
        clean: true, // Start fresh session
        // Protocol version
        protocolVersion: 4, // MQTT 3.1.1
      });

      // Handle successful connection
      client.on('connect', () => {
        console.log('✅ Connected to MQTT broker');
        resolve(client);
      });

      // Handle reconnection
      client.on('reconnect', () => {
        console.log('🔄 Attempting to reconnect to MQTT broker...');
      });

      // Handle disconnection
      client.on('disconnect', () => {
        console.log('⚠️  Disconnected from MQTT broker');
      });

      // Handle errors
      client.on('error', (error: Error) => {
        console.error('❌ MQTT error:', error.message);
        // Don't reject on error since MQTT client will auto-reconnect
        // Only reject if it's during initial connection
        if (!client.connected) {
          reject(error);
        }
      });

      // Handle offline events (connection lost)
      client.on('offline', () => {
        console.log('⚠️  MQTT client went offline');
      });

      // Handle end event (clean disconnect)
      client.on('end', () => {
        console.log('🛑 MQTT client connection ended');
      });

      // Set timeout for connection attempt
      const connectionTimeout = setTimeout(() => {
        client.end();
        reject(
          new Error(
            `MQTT connection timeout (30s). Broker unreachable at ${brokerUrl}`
          )
        );
      }, 30000);

      // Clear timeout if connection succeeds
      client.once('connect', () => {
        clearTimeout(connectionTimeout);
      });

      // Clear timeout if connection fails
      client.once('error', () => {
        clearTimeout(connectionTimeout);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Disconnects from MQTT broker
 * Safe to call even if not connected
 *
 * @returns Promise that resolves when disconnection is complete
 */
export async function disconnectMqtt(): Promise<void> {
  return new Promise((resolve) => {
    if (!globalForMqtt.mqttClient) {
      console.log('📡 MQTT client not initialized');
      resolve();
      return;
    }

    console.log('📡 Disconnecting from MQTT broker...');

    if (globalForMqtt.mqttClient.connected) {
      globalForMqtt.mqttClient.end(true, () => {
        console.log('✅ Disconnected from MQTT broker');
        globalForMqtt.mqttClient = undefined;
        resolve();
      });
    } else {
      globalForMqtt.mqttClient.end(true);
      globalForMqtt.mqttClient = undefined;
      console.log('✅ MQTT client ended');
      resolve();
    }
  });
}

/**
 * Gets the current MQTT client instance
 * Returns null if not connected
 *
 * @returns MQTT client or null
 */
export function getMqttClient(): MqttClientType | null {
  return globalForMqtt.mqttClient || null;
}

/**
 * Checks if MQTT client is connected
 *
 * @returns true if connected, false otherwise
 */
export function isMqttConnected(): boolean {
  return globalForMqtt.mqttClient?.connected ?? false;
}

/**
 * Waits for MQTT connection to be ready
 * Useful for operations that require active connection
 *
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise that resolves when connected
 */
export async function waitForMqttReady(timeout = 30000): Promise<void> {
  const startTime = Date.now();

  while (!isMqttConnected()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(
        `MQTT connection not ready after ${timeout}ms. Broker may be unreachable.`
      );
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
