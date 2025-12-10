# MQTT Connection Module

## Overview

The `src/mqtt/client.ts` module provides a singleton MQTT client with robust connection management, automatic reconnection, and comprehensive logging.

## Features

✅ **Singleton Pattern** - Prevents multiple connections in hot reload scenarios  
✅ **Connection Management** - Async/await patterns for connection readiness  
✅ **Auto-Reconnection** - Automatic reconnect with configurable intervals  
✅ **Error Handling** - Comprehensive error logging and timeout handling  
✅ **Connection State** - Track connection status and provide query methods  
✅ **Graceful Shutdown** - Clean disconnection with callbacks

## API Reference

### `connectMqtt(): Promise<MqttClientType>`

Connects to the MQTT broker and returns a connected client.

**Features:**
- Reuses existing connection if already connected
- Prevents duplicate connection attempts
- Uses async/await for connection readiness
- Configurable timeouts and retry logic

**Example:**
```typescript
import { connectMqtt } from './src/mqtt/client.js';

// Connect to MQTT broker
const client = await connectMqtt();
console.log('Connected!');
```

**Returns:**
- `Promise<MqttClientType>` - Resolves when connected
- Throws error if connection fails or config is invalid

---

### `disconnectMqtt(): Promise<void>`

Gracefully disconnects from MQTT broker.

**Features:**
- Safe to call even if not connected
- Cleans up client resources
- Returns promise for async flow

**Example:**
```typescript
import { disconnectMqtt } from './src/mqtt/client.js';

// Disconnect from MQTT broker
await disconnectMqtt();
console.log('Disconnected!');
```

---

### `getMqttClient(): MqttClientType | null`

Gets the current MQTT client instance without connecting.

**Returns:**
- `MqttClientType | null` - Connected client or null

**Example:**
```typescript
import { getMqttClient } from './src/mqtt/client.js';

const client = getMqttClient();
if (client) {
  client.publish('topic', 'message');
}
```

---

### `isMqttConnected(): boolean`

Checks if MQTT client is currently connected.

**Returns:**
- `boolean` - true if connected, false otherwise

**Example:**
```typescript
import { isMqttConnected } from './src/mqtt/client.js';

if (isMqttConnected()) {
  console.log('Ready to publish/subscribe');
}
```

---

### `waitForMqttReady(timeout?: number): Promise<void>`

Waits for MQTT connection to be ready with timeout.

**Parameters:**
- `timeout` (optional) - Max wait time in milliseconds (default: 30000)

**Example:**
```typescript
import { waitForMqttReady } from './src/mqtt/client.js';

try {
  // Wait up to 10 seconds for connection
  await waitForMqttReady(10000);
  console.log('MQTT is ready!');
} catch (error) {
  console.error('MQTT not ready:', error.message);
}
```

---

## Configuration

The module reads from environment variables via `getConfig()`:

```typescript
config.mqtt = {
  brokerUrl: string;    // e.g., "mqtt://localhost:1883"
  username: string | null;   // Optional MQTT username
  password: string | null;   // Optional MQTT password
}
```

### Environment Variables

```bash
MQTT_BROKER_URL=mqtt://host.docker.internal:1883
MQTT_USERNAME=                    # Optional
MQTT_PASSWORD=                    # Optional
```

---

## Connection Options

The module uses these MQTT connection options:

| Option | Value | Purpose |
|--------|-------|---------|
| `reconnectPeriod` | 1000 ms | Auto-reconnect delay |
| `connectTimeout` | 30000 ms | Initial connection timeout |
| `keepalive` | 60 seconds | Keep-alive ping interval |
| `clientId` | `ingestor-{timestamp}` | Unique client identifier |
| `clean` | true | Start fresh session |
| `protocolVersion` | 4 | MQTT 3.1.1 |

---

## Event Handling

The client automatically handles these MQTT events:

### `connect`
Fired when successfully connected to broker.
```
✅ Connected to MQTT broker
```

### `reconnect`
Fired when attempting to reconnect after disconnection.
```
🔄 Attempting to reconnect to MQTT broker...
```

### `disconnect`
Fired when broker initiates disconnection.
```
⚠️  Disconnected from MQTT broker
```

### `error`
Fired on connection errors.
```
❌ MQTT error: <error message>
```

### `offline`
Fired when connection is lost.
```
⚠️  MQTT client went offline
```

### `end`
Fired on clean disconnection.
```
🛑 MQTT client connection ended
```

---

## Usage Examples

### Basic Connection

```typescript
import { connectMqtt, isMqttConnected } from './src/mqtt/client.js';

async function main() {
  try {
    // Connect to MQTT broker
    const client = await connectMqtt();
    
    if (isMqttConnected()) {
      console.log('Ready to use MQTT!');
    }
  } catch (error) {
    console.error('Failed to connect:', error.message);
  }
}

main();
```

### With Timeout

```typescript
import { connectMqtt, waitForMqttReady } from './src/mqtt/client.js';

async function main() {
  try {
    const client = await connectMqtt();
    
    // Wait for it to be ready (with 5 second timeout)
    await waitForMqttReady(5000);
    
    console.log('MQTT ready for operations!');
  } catch (error) {
    console.error('MQTT timeout:', error.message);
  }
}
```

### Get Existing Client

```typescript
import { getMqttClient, connectMqtt } from './src/mqtt/client.js';

async function publishMessage() {
  let client = getMqttClient();
  
  if (!client) {
    // Connect if not already connected
    client = await connectMqtt();
  }
  
  client.publish('sensors/temperature', '25.5');
}
```

### Graceful Shutdown

```typescript
import { connectMqtt, disconnectMqtt } from './src/mqtt/client.js';

async function main() {
  const client = await connectMqtt();
  
  // ... do work ...
  
  // Clean shutdown
  process.on('SIGINT', async () => {
    await disconnectMqtt();
    process.exit(0);
  });
}
```

### Integration with Existing Application

```typescript
import { connectMqtt, disconnectMqtt } from './src/mqtt/client.js';

export async function initializeMqtt() {
  try {
    const client = await connectMqtt();
    console.log('🔗 MQTT connection established');
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize MQTT:', error.message);
    process.exit(1);
  }
}

export async function shutdownMqtt() {
  try {
    await disconnectMqtt();
    console.log('🛑 MQTT connection closed');
  } catch (error) {
    console.error('❌ Error during MQTT shutdown:', error);
  }
}
```

---

## Error Handling

### Connection Timeout

```typescript
try {
  const client = await connectMqtt();
} catch (error) {
  // Connection failed after 30 seconds
  console.error(error.message);
  // e.g., "MQTT connection timeout (30s). Broker unreachable at mqtt://..."
}
```

### Ready Timeout

```typescript
try {
  await waitForMqttReady(5000);
} catch (error) {
  // Not connected within 5 seconds
  console.error(error.message);
  // e.g., "MQTT connection not ready after 5000ms. Broker may be unreachable."
}
```

### Configuration Error

```typescript
try {
  const client = await connectMqtt();
} catch (error) {
  // Config validation failed
  console.error(error.message);
  // e.g., "Missing required environment variable: MQTT_BROKER_URL"
}
```

---

## Connection Flow Diagram

```
┌─────────────────────────────────────────────┐
│         Call connectMqtt()                   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
        ┌────────────────────┐
        │ Already Connected? │
        └────┬───────────────┘
             │ No
             ↓
    ┌─────────────────────────┐
    │ Connection in Progress? │
    └────┬────────────────────┘
         │ No
         ↓
  ┌──────────────────────────┐
  │ Load Configuration       │
  │ - MQTT_BROKER_URL        │
  │ - MQTT_USERNAME (opt)    │
  │ - MQTT_PASSWORD (opt)    │
  └───┬──────────────────────┘
      │
      ↓
  ┌──────────────────────┐
  │ Create MQTT Client   │
  │ with connect options │
  └───┬─────────────────┘
      │
      ↓
  ┌─────────────────────────────────┐
  │ Wait for 'connect' Event        │
  │ (with 30s timeout)              │
  └─┬───────────────────────────────┘
    │
    ├─ Success → ✅ Connected
    └─ Timeout → ❌ Error
```

---

## Singleton Pattern

The module uses a singleton pattern to ensure only one MQTT connection exists:

```typescript
const globalForMqtt = global as unknown as {
  mqttClient: MqttClientType | undefined;
  mqttConnecting: Promise<MqttClientType> | undefined;
};
```

**Benefits:**
- No duplicate connections
- Reuses existing connection
- Prevents race conditions during hot reload
- Clean memory management

---

## Testing

### Mock MQTT Connection

```typescript
import { jest } from '@jest/globals';
import * as mqttClient from './src/mqtt/client';

describe('MQTT Connection', () => {
  it('should connect to broker', async () => {
    const client = await mqttClient.connectMqtt();
    expect(client).toBeDefined();
    expect(mqttClient.isMqttConnected()).toBe(true);
    
    await mqttClient.disconnectMqtt();
  });
});
```

---

## Troubleshooting

### "MQTT connection timeout"
- Check if MQTT broker is running
- Verify MQTT_BROKER_URL is correct
- Check firewall/network access to broker

### "Cannot connect - No credentials"
- Ensure MQTT_USERNAME and MQTT_PASSWORD are set if required
- Verify broker authentication configuration

### "Multiple connections in hot reload"
- Module uses singleton pattern, connections should reuse
- Check for multiple imports or module resets

---

## Next Steps

Once this module is working, you can:

1. **Add Message Subscription**: Implement topic subscription logic
2. **Create Message Handlers**: Process incoming Frigate events
3. **Implement Publishing**: Send acknowledgments or status updates
4. **Add Error Recovery**: Handle connection failures gracefully

See `src/mqtt/handlers.ts` (to be created) for message processing.

---

## Files

| File | Purpose |
|------|---------|
| `src/mqtt/client.ts` | MQTT connection management |
| `src/mqtt/MqttClient.ts` | Message handler class (existing) |
| `src/mqtt/index.ts` | Public exports (to be created) |

---

**Status**: ✅ Complete  
**Testing**: Manual testing recommended with real MQTT broker  
**Next**: Implement message handlers and subscriptions
