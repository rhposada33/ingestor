#!/usr/bin/env tsx

import mqtt from 'mqtt';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Normalize database URL for local runs (replace docker service name with localhost)
function normalizeDbUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/postgres:\/\/([^@]+)@postgres:/, 'postgres://$1@localhost:');
}

// Set the correct database URL before creating Prisma client
if (process.env.POSTGRES_URL) {
  const normalized = normalizeDbUrl(process.env.POSTGRES_URL);
  if (normalized) process.env.POSTGRES_URL = normalized;
}

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Default broker selection mirrors other scripts: use localhost when running locally
const defaultBrokerUrl = process.env.DOCKER_ENV === 'true' ? 'mqtt://mosquitto:1883' : 'mqtt://localhost:1883';

function normalizeBrokerUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace('mqtt://mosquitto', 'mqtt://localhost').replace('mqtts://mosquitto', 'mqtts://localhost');
}

const brokerUrl = normalizeBrokerUrl(process.env.MQTT_BROKER_URL) || defaultBrokerUrl;
const username = process.env.MQTT_USERNAME || undefined;
const password = process.env.MQTT_PASSWORD || undefined;

async function publishAndVerify() {
  console.log(`Connecting to MQTT broker ${brokerUrl}`);
  const client = mqtt.connect(brokerUrl, { username, password, connectTimeout: 5000 });

  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('error', (err) => reject(err));
  });

  console.log('Connected to MQTT broker, publishing test event...');

  const testId = `test-${Date.now()}`;
  const camera = 'webcam';
  const frameTime = Math.floor(Date.now() / 1000 * 1000); // milliseconds
  const payload = {
    type: 'new',
    before: {
      id: testId,
      camera,
      frame_time: frameTime,
      label: 'person',
      top_score: 0.95,
      false_positive: false,
      start_time: frameTime / 1000,
      end_time: null,
    },
    after: {
      id: testId,
      camera,
      frame_time: frameTime,
      label: 'person',
      top_score: 0.95,
      false_positive: false,
      start_time: frameTime / 1000,
      end_time: null,
    },
  } as const;

  client.publish(`frigate/events/${camera}`, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) console.error('Publish error', err);
    else console.log('Published test event', testId);
  });

  // Wait for ingestor to pick up and persist
  console.log('Waiting 6 seconds for ingestor to process the message...');
  await sleep(6000);

  // Query DB for event with frigateId === testId
  try {
    const found = await prisma.event.findFirst({ where: { frigateId: testId } });
    if (found) {
      console.log('✅ Event found in database:', {
        id: found.id,
        frigateId: found.frigateId,
        type: found.type,
        label: found.label,
        startTime: found.startTime,
        createdAt: found.createdAt,
      });
      process.exit(0);
    } else {
      console.log('❌ Event not found in database.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Error querying database:', err);
    process.exit(1);
  } finally {
    client.end();
    await prisma.$disconnect();
  }
}

publishAndVerify().catch((err) => {
  console.error('Test ingest failed:', err);
  process.exit(1);
});
