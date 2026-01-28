import type { MqttClient } from 'mqtt';
import { ingestorBus } from './bus.js';
import type { FrigateEvent, FrigateReview, FrigateAvailable } from './bus.js';

/**
 * Subscription topics for Frigate MQTT events
 */
const FRIGATE_TOPICS = {
  events: 'frigate/events/#',
  reviews: 'frigate/reviews/#',
  available: 'frigate/available/#',
} as const;

/**
 * Map MQTT topic to event type and emitter method
 */
interface TopicHandler {
  pattern: string;
  eventName: 'frigate:event' | 'frigate:review' | 'frigate:available';
  parser: (payload: string) => unknown;
}

/**
 * Handles parsing and validation of Frigate events
 */
function parseFrigateEvent(payload: string): FrigateEvent {
  try {
    const data = JSON.parse(payload);
    // Basic validation that required fields exist
    // Type must be present, and either before/after or top-level camera/label
    const hasType = data.type && ['new', 'update', 'end'].includes(data.type);
    const hasTopLevelCamera = data.camera || (data.before && data.before.camera) || (data.after && data.after.camera);
    const hasTopLevelLabel = data.label || (data.before && data.before.label) || (data.after && data.after.label);

    if (!hasType || !hasTopLevelCamera || !hasTopLevelLabel) {
      throw new Error(
        `Invalid Frigate event structure: missing ${
          !hasType ? 'type, ' : ''
        }${!hasTopLevelCamera ? 'camera, ' : ''}${!hasTopLevelLabel ? 'label' : ''}`
      );
    }
    return data as FrigateEvent;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in Frigate event: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Handles parsing and validation of Frigate reviews
 */
function parseFrigateReview(payload: string): FrigateReview {
  try {
    const data = JSON.parse(payload);

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid Frigate review payload');
    }

    const before = (data as any).before;
    const after = (data as any).after;

    // Some Frigate versions send reviews wrapped in before/after objects
    if (!(data as any).id && (before?.id || after?.id)) {
      (data as any).id = before?.id ?? after?.id;
    }
    if (!(data as any).camera && (before?.camera || after?.camera)) {
      (data as any).camera = before?.camera ?? after?.camera;
    }
    if ((data as any).severity === undefined && (before?.severity || after?.severity)) {
      (data as any).severity = before?.severity ?? after?.severity;
    }

    return data as FrigateReview;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in Frigate review: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Handles parsing and validation of Frigate availability
 */
function parseFrigateAvailable(payload: string): FrigateAvailable {
  const trimmed = payload.trim().toLowerCase();

  // Frigate can send plain strings like "online"/"offline" or "true"/"false"
  if (trimmed === 'online' || trimmed === 'true' || trimmed === '1') {
    return { available: true };
  }

  if (trimmed === 'offline' || trimmed === 'false' || trimmed === '0') {
    return { available: false };
  }

  try {
    const data = JSON.parse(payload);
    const available =
      data?.available !== undefined
        ? data.available
        : data?.online !== undefined
          ? data.online
          : undefined;

    if (available === undefined) {
      throw new Error('Invalid Frigate availability structure');
    }

    if (typeof available === 'boolean') {
      return { available };
    }

    if (typeof available === 'string') {
      const normalized = available.trim().toLowerCase();
      if (['true', 'online', '1', 'yes', 'y'].includes(normalized)) {
        return { available: true };
      }
      if (['false', 'offline', '0', 'no', 'n'].includes(normalized)) {
        return { available: false };
      }
    }

    throw new Error('Invalid Frigate availability value');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in Frigate availability: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Topic handlers with parsers
 */
const topicHandlers: TopicHandler[] = [
  {
    pattern: FRIGATE_TOPICS.events,
    eventName: 'frigate:event',
    parser: parseFrigateEvent,
  },
  {
    pattern: FRIGATE_TOPICS.reviews,
    eventName: 'frigate:review',
    parser: parseFrigateReview,
  },
  {
    pattern: FRIGATE_TOPICS.available,
    eventName: 'frigate:available',
    parser: parseFrigateAvailable,
  },
];

/**
 * Subscribes to Frigate MQTT topics and emits events to the ingestor bus
 *
 * Subscribes to:
 * - frigate/events       - Frigate detection events
 * - frigate/reviews      - Frigate review events
 * - frigate/available/#  - Frigate availability status
 *
 * @param client - Connected MQTT client
 * @throws Error if client is not connected
 */
export async function subscribeToFrigateEvents(client: MqttClient): Promise<void> {
  if (!client.connected) {
    throw new Error('MQTT client is not connected');
  }

  console.log('📡 Subscribing to Frigate MQTT topics...');

  // Subscribe to each topic
  const subscriptions = Object.values(FRIGATE_TOPICS).map(
    (topic) =>
      new Promise<void>((resolve, reject) => {
        client.subscribe(topic, (err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
            reject(err);
          } else {
            console.log(`✅ Subscribed to ${topic}`);
            resolve();
          }
        });
      })
  );

  // Wait for all subscriptions to complete
  try {
    await Promise.all(subscriptions);
    console.log('✅ All Frigate subscriptions successful');
  } catch (error) {
    console.error('❌ Subscription error:', error);
    throw error;
  }

  // Set up message handler
  client.on('message', (topic: string, payload: Buffer) => {
    handleIncomingMessage(topic, payload.toString());
  });

  console.log('📡 Frigate event listener activated');
}

/**
 * Internal function to handle incoming MQTT messages
 * Parses JSON and emits to appropriate event handlers
 */
function handleIncomingMessage(topic: string, payload: string): void {
  try {
    // Match topic to handler
    for (const handler of topicHandlers) {
      let matches = false;

      // Wildcard matching for all topics (all use wildcard now)
      // Match both "frigate/events" and "frigate/events/*" patterns
      if (handler.pattern === 'frigate/events/#') {
        matches = topic === 'frigate/events' || topic.startsWith('frigate/events/');
      } else if (handler.pattern === 'frigate/reviews/#') {
        matches = topic === 'frigate/reviews' || topic.startsWith('frigate/reviews/');
      } else if (handler.pattern === 'frigate/available/#') {
        matches = topic === 'frigate/available' || topic.startsWith('frigate/available/');
      }

      if (!matches) continue;

      // Parse and emit
      try {
        const data = handler.parser(payload);
        const emitted = ingestorBus.emit(handler.eventName, data, topic);

        if (emitted) {
          console.log(`📨 Emitted ${handler.eventName} from topic: ${topic}`);
        } else {
          console.warn(`⚠️  No listeners for ${handler.eventName}`);
        }
      } catch (parseError) {
        if (parseError instanceof Error) {
          console.error(
            `❌ Failed to parse message from ${topic}: ${parseError.message}`
          );
        }
      }

      return; // Topic matched, don't check other handlers
    }

    // If no handler matched
    console.warn(`⚠️  No handler for topic: ${topic}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error processing message from ${topic}: ${error.message}`);
    }
  }
}

/**
 * Unsubscribe from all Frigate topics
 *
 * @param client - Connected MQTT client
 */
export function unsubscribeFromFrigateEvents(client: MqttClient): void {
  if (!client.connected) {
    console.warn('MQTT client is not connected, cannot unsubscribe');
    return;
  }

  console.log('📡 Unsubscribing from Frigate MQTT topics...');

  Object.values(FRIGATE_TOPICS).forEach((topic) => {
    client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Failed to unsubscribe from ${topic}:`, err.message);
      } else {
        console.log(`✅ Unsubscribed from ${topic}`);
      }
    });
  });

  console.log('✅ Frigate event listener deactivated');
}

/**
 * Check if subscribed to a specific Frigate topic
 * Note: MQTT client doesn't expose subscription list, so this is a helper
 *
 * @param client - MQTT client
 * @returns true if client is connected (assumes subscriptions are active)
 */
export function isFrigateSubscribed(client: MqttClient): boolean {
  return client.connected;
}
