#!/usr/bin/env tsx

import mqtt from 'mqtt';
import 'dotenv/config';

/**
 * Publishes simulated Frigate MQTT payloads to test the ingestor
 * 
 * Usage: tsx scripts/publish-test-event.ts
 * 
 * Environment variables:
 * - MQTT_BROKER_URL: MQTT broker URL (default: mqtt://localhost:1883)
 * - MQTT_USERNAME: MQTT broker username (optional)
 * - MQTT_PASSWORD: MQTT broker password (optional)
 */

// Configuration from environment
// When running locally (outside Docker), use localhost
// When running in Docker, use the service name from docker-compose
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

console.log(`🚀 Connecting to MQTT broker: ${brokerUrl}`);

// Create MQTT client
const client = mqtt.connect(brokerUrl, {
  username: username && username !== '' ? username : undefined,
  password: password && password !== '' ? password : undefined,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
});

// Types for Frigate payloads
interface FrigateEvent {
  type: 'new' | 'update' | 'end';
  before: {
    id: string;
    camera: string;
    frame_time: number;
    label: string;
    top_score: number;
    false_positive: boolean;
    start_time: number;
    end_time: number | null;
  };
  after: {
    id: string;
    camera: string;
    frame_time: number;
    label: string;
    top_score: number;
    false_positive: boolean;
    start_time: number;
    end_time: number | null;
  };
}

interface FrigateReview {
  id: string;
  camera: string;
  severity: string;
  significant_motion_area?: number;
  false_positive?: boolean;
}

// Helper function to sleep between publishes
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Sample payloads
const frameTime = Math.floor(Date.now() / 1000 * 1000);
const eventNewPayload: FrigateEvent = {
  type: 'new',
  before: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime,
    label: 'person',
    top_score: 0.85,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: null,
  },
  after: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime,
    label: 'person',
    top_score: 0.87,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: null,
  },
};

const eventUpdatePayload: FrigateEvent = {
  type: 'update',
  before: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime,
    label: 'person',
    top_score: 0.87,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: null,
  },
  after: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime + 100,
    label: 'person',
    top_score: 0.89,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: null,
  },
};

const eventEndPayload: FrigateEvent = {
  type: 'end',
  before: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime + 100,
    label: 'person',
    top_score: 0.89,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: null,
  },
  after: {
    id: '1765399055.411563-pn9p44',
    camera: 'webcam',
    frame_time: frameTime + 200,
    label: 'person',
    top_score: 0.88,
    false_positive: false,
    start_time: frameTime / 1000,
    end_time: frameTime / 1000 + 5,
  },
};

const reviewPayload: FrigateReview = {
  id: '1765399055.411563-pn9p44',
  camera: 'webcam',
  severity: 'alert',
  significant_motion_area: 0.05,
  false_positive: false,
};

const availabilityOnline = { state: 'online' };
const availabilityOffline = { state: 'offline' };

// Main function
async function publishTestEvents(): Promise<void> {
  return new Promise((resolve, reject) => {
    client.on('connect', async () => {
      console.log('✅ Connected to MQTT broker');
      console.log('');

      try {
        // Publish event "new"
        console.log('📤 Publishing event "new"...');
        client.publish(`frigate/events/${eventNewPayload.after.camera}`, JSON.stringify(eventNewPayload), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish event "new":', err.message);
          } else {
            console.log('✅ Event "new" published to frigate/events');
          }
        });

        await sleep(500);

        // Publish event "update"
        console.log('📤 Publishing event "update"...');
        client.publish(`frigate/events/${eventUpdatePayload.after.camera}`, JSON.stringify(eventUpdatePayload), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish event "update":', err.message);
          } else {
            console.log('✅ Event "update" published to frigate/events');
          }
        });

        await sleep(500);

        // Publish event "end"
        console.log('📤 Publishing event "end"...');
        client.publish(`frigate/events/${eventEndPayload.after.camera}`, JSON.stringify(eventEndPayload), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish event "end":', err.message);
          } else {
            console.log('✅ Event "end" published to frigate/events');
          }
        });        await sleep(500);

  // Publish review
  console.log('📤 Publishing review...');
  client.publish(`frigate/reviews/${reviewPayload.camera}`, JSON.stringify(reviewPayload), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish review:', err.message);
          } else {
            console.log('✅ Review published to frigate/reviews');
          }
        });

        await sleep(500);

        // Publish availability "online"
        console.log('📤 Publishing availability "online"...');
        client.publish('frigate/available/ingestor-test', JSON.stringify(availabilityOnline), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish availability "online":', err.message);
          } else {
            console.log('✅ Availability "online" published to frigate/available/ingestor-test');
          }
        });

        await sleep(500);

        // Publish availability "offline"
        console.log('📤 Publishing availability "offline"...');
        client.publish('frigate/available/ingestor-test', JSON.stringify(availabilityOffline), { qos: 1 }, (err) => {
          if (err) {
            console.error('❌ Failed to publish availability "offline":', err.message);
          } else {
            console.log('✅ Availability "offline" published to frigate/available/ingestor-test');
          }
        });

        await sleep(1000);

        console.log('');
        console.log('🎉 All test events published successfully!');

        // Disconnect
        client.end();
        resolve();
      } catch (error) {
        console.error('❌ Error during publishing:', error);
        client.end();
        reject(error);
      }
    });

    client.on('error', (error) => {
      console.error('❌ MQTT connection error:', error.message);
      reject(error);
    });

    client.on('offline', () => {
      console.error('❌ MQTT client offline');
      reject(new Error('MQTT client offline'));
    });
  });
}

// Run the script
publishTestEvents().catch((error) => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
