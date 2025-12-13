#!/usr/bin/env tsx

import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

/**
 * Publishes a JSON payload from a file to a specified MQTT topic
 * 
 * Usage: ts-node publish-payload.ts <topic> <file>
 * 
 * Examples:
 *   ts-node scripts/publish-payload.ts frigate/events test-payloads/event-new.json
 *   tsx scripts/publish-payload.ts frigate/reviews test-payloads/review.json
 * 
 * Environment variables:
 * - MQTT_BROKER_URL: MQTT broker URL (default: mqtt://localhost:1883)
 * - MQTT_USERNAME: MQTT broker username (optional)
 * - MQTT_PASSWORD: MQTT broker password (optional)
 */

// Configuration from environment
const defaultBrokerUrl = process.env.DOCKER_ENV === 'true' ? 'mqtt://mosquitto:1883' : 'mqtt://localhost:1883';

function normalizeBrokerUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // If the URL targets the docker service name but we're running locally,
  // map it to localhost so the host can reach the container-mapped port.
  return url.replace('mqtt://mosquitto', 'mqtt://localhost').replace('mqtts://mosquitto', 'mqtts://localhost');
}

const brokerUrl = normalizeBrokerUrl(process.env.MQTT_BROKER_URL) || defaultBrokerUrl;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Missing required arguments');
  console.error('');
  console.error('Usage: ts-node publish-payload.ts <topic> <file>');
  console.error('');
  console.error('Examples:');
  console.error('  ts-node scripts/publish-payload.ts frigate/events test-payloads/event-new.json');
  console.error('  ts-node scripts/publish-payload.ts frigate/reviews test-payloads/review.json');
  console.error('');
  process.exit(1);
}

const topic = args[0];
let filePath = args[1];

// If relative path doesn't start with ./, make it relative to project root
if (!filePath.startsWith('/')) {
  filePath = path.resolve(process.cwd(), filePath);
}

// Validate file exists
if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

// Load and validate JSON
let payload: unknown;
try {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  payload = JSON.parse(fileContent);
  console.log(`✓ JSON validated successfully`);
} catch (error) {
  console.error(`❌ Failed to parse JSON file: ${filePath}`);
  if (error instanceof SyntaxError) {
    console.error(`   Error: ${error.message}`);
  }
  process.exit(1);
}

console.log(`🚀 Connecting to MQTT broker: ${brokerUrl}`);

// Create MQTT client
const client = mqtt.connect(brokerUrl, {
  username: username && username !== '' ? username : undefined,
  password: password && password !== '' ? password : undefined,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
});

// Event handlers
client.on('connect', () => {
  console.log(`✓ Connected to MQTT broker`);
  
  // Publish payload
  const payloadString = JSON.stringify(payload);
  console.log(`📤 Publishing to topic: ${topic}`);
  console.log(`   Payload size: ${payloadString.length} bytes`);
  
  client.publish(topic, payloadString, { qos: 1 }, (error) => {
    if (error) {
      console.error(`❌ Failed to publish: ${error.message}`);
      process.exit(1);
    } else {
      console.log(`✓ Payload published successfully`);
      
      // Gracefully disconnect
      client.end(() => {
        console.log(`✓ Disconnected from broker`);
        process.exit(0);
      });
    }
  });
});

client.on('error', (error) => {
  console.error(`❌ MQTT error: ${error.message}`);
  process.exit(1);
});

client.on('offline', () => {
  console.error(`❌ MQTT client went offline`);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error(`❌ Connection timeout`);
  process.exit(1);
}, 10000);
