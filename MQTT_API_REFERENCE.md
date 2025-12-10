# MQTT Client Module - API Reference Card

## Overview

**File**: `src/mqtt/client.ts`  
**Purpose**: Singleton MQTT connection management with async/await patterns  
**Status**: ✅ Complete, compiled, ready to use  

---

## Core API

### `connectMqtt(): Promise<MqttClientType>`

Connects to MQTT broker and returns connected client.

```typescript
import { connectMqtt } from './src/mqtt/client.js';

const client = await connectMqtt();
// Logs: ✅ Connected to MQTT broker
```

**Behavior:**
- Returns existing connection if already connected
- Prevents duplicate connection attempts
- 30 second timeout for initial connection
- Auto-reconnects on disconnection (1s interval)

**Throws:**
- `Error` if connection fails or config is invalid

---

### `disconnectMqtt(): Promise<void>`

Gracefully disconnects from MQTT broker.

```typescript
import { disconnectMqtt } from './src/mqtt/client.js';

await disconnectMqtt();
// Logs: ✅ Disconnected from MQTT broker
```

**Behavior:**
- Safe to call even if not connected
- Cleans up client resources
- Returns promise for async flow

---

### `getMqttClient(): MqttClientType | null`

Gets current MQTT client instance (returns null if not connected).

```typescript
import { getMqttClient } from './src/mqtt/client.js';

const client = getMqttClient();
if (client) {
  client.publish('test/topic', 'Hello');
}
```

**Returns:**
- `MqttClientType` if connected
- `null` if not connected

---

### `isMqttConnected(): boolean`

Checks if MQTT client is currently connected.

```typescript
import { isMqttConnected } from './src/mqtt/client.js';

if (isMqttConnected()) {
  // Ready to publish/subscribe
}
```

**Returns:**
- `true` if connected
- `false` if disconnected

---

### `waitForMqttReady(timeout?: number): Promise<void>`

Waits for MQTT connection to be ready with optional timeout.

```typescript
import { waitForMqttReady } from './src/mqtt/client.js';

try {
  // Wait up to 10 seconds
  await waitForMqttReady(10000);
  console.log('Ready!');
} catch (error) {
  console.error('Timeout:', error.message);
}
```

**Parameters:**
- `timeout` (optional): Max wait in milliseconds (default: 30000)

**Throws:**
- `Error` if timeout exceeded

---

## Usage Patterns

### Pattern 1: Simple Connection

```typescript
import { connectMqtt, disconnectMqtt } from './src/mqtt/client.js';

async function main() {
  const client = await connectMqtt();
  console.log('Connected');
  
  await disconnectMqtt();
  console.log('Disconnected');
}

main();
```

### Pattern 2: Check Status Before Using

```typescript
import { getMqttClient, connectMqtt } from './src/mqtt/client.js';

async function publishMessage() {
  let client = getMqttClient();
  
  if (!client) {
    client = await connectMqtt();
  }
  
  client.publish('sensors/temp', '25.5');
}
```

### Pattern 3: With Timeout

```typescript
import { connectMqtt, waitForMqttReady } from './src/mqtt/client.js';

async function main() {
  const client = await connectMqtt();
  
  try {
    await waitForMqttReady(5000);
    console.log('MQTT ready for operations');
  } catch {
    console.error('MQTT not responding');
  }
}
```

### Pattern 4: Graceful Shutdown

```typescript
import { connectMqtt, disconnectMqtt } from './src/mqtt/client.js';

async function main() {
  const client = await connectMqtt();
  
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await disconnectMqtt();
    process.exit(0);
  });
}
```

### Pattern 5: Integration with App Lifecycle

```typescript
import { connectMqtt, disconnectMqtt } from './src/mqtt/client.js';

// In src/index.ts
async function main() {
  try {
    await connectDatabase();
    await connectMqtt();
    console.log('✅ Services started');
    
    process.on('SIGINT', async () => {
      await disconnectMqtt();
      await disconnectDatabase();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
```

---

## Configuration

### Environment Variables

```bash
MQTT_BROKER_URL=mqtt://localhost:1883      # Required
MQTT_USERNAME=user@example.com              # Optional
MQTT_PASSWORD=secret                        # Optional
```

### Connection Options (Internal)

| Option | Value | Purpose |
|--------|-------|---------|
| `reconnectPeriod` | 1000 ms | Retry interval |
| `connectTimeout` | 30000 ms | Initial connection timeout |
| `keepalive` | 60 sec | Keep-alive ping interval |
| `clientId` | `ingestor-{timestamp}` | Unique identifier |
| `clean` | true | Start fresh session |
| `protocolVersion` | 4 | MQTT 3.1.1 |

---

## Events Logged

| Event | Log | Meaning |
|-------|-----|---------|
| `connect` | ✅ Connected to MQTT broker | Successfully connected |
| `reconnect` | 🔄 Attempting to reconnect... | Retrying after disconnect |
| `disconnect` | ⚠️  Disconnected from MQTT broker | Connection lost by broker |
| `error` | ❌ MQTT error: {message} | Connection/auth error |
| `offline` | ⚠️  MQTT client went offline | Lost connection |
| `end` | 🛑 MQTT client connection ended | Clean shutdown |

---

## Error Scenarios

### Scenario 1: Connection Timeout

```typescript
try {
  await connectMqtt();
} catch (error) {
  console.error(error.message);
  // "MQTT connection timeout (30s). Broker unreachable at mqtt://..."
}
```

### Scenario 2: Invalid Broker URL

```typescript
// Set: MQTT_BROKER_URL=invalid://url
try {
  await connectMqtt();
} catch (error) {
  console.error(error.message);
  // Error from MQTT client
}
```

### Scenario 3: Authentication Failed

```typescript
// Set: MQTT_BROKER_URL=mqtt://broker:1883 with wrong credentials
try {
  await connectMqtt();
} catch (error) {
  console.error(error.message);
  // "MQTT error: Connection refused"
}
```

### Scenario 4: Ready Timeout

```typescript
try {
  await waitForMqttReady(5000);
} catch (error) {
  console.error(error.message);
  // "MQTT connection not ready after 5000ms..."
}
```

---

## Type Definitions

```typescript
// MQTT client type from npm package
import type { MqttClient } from 'mqtt';

// Function signatures
async function connectMqtt(): Promise<MqttClient>
async function disconnectMqtt(): Promise<void>
function getMqttClient(): MqttClient | null
function isMqttConnected(): boolean
async function waitForMqttReady(timeout?: number): Promise<void>
```

---

## Singleton Pattern

Module uses global singleton to ensure single connection:

```typescript
const globalForMqtt = global as unknown as {
  mqttClient: MqttClientType | undefined;
  mqttConnecting: Promise<MqttClientType> | undefined;
};
```

**Benefits:**
- Only one connection regardless of multiple imports
- Reuses existing connection automatically
- Prevents race conditions in hot reload
- Clean memory management

---

## Common Tasks

### Start App with MQTT

```typescript
// src/index.ts
import { connectMqtt, disconnectMqtt } from './mqtt/client.js';

async function main() {
  await connectMqtt();
  // ... rest of app
}

process.on('SIGINT', disconnectMqtt);
```

### Publish Message

```typescript
import { getMqttClient } from './src/mqtt/client.js';

const client = getMqttClient();
if (client?.connected) {
  client.publish('topic/name', JSON.stringify(data));
}
```

### Wait for Connection Before Using

```typescript
import { connectMqtt, waitForMqttReady } from './src/mqtt/client.js';

const client = await connectMqtt();
await waitForMqttReady();
// Now safe to use client
```

### Check Connection Status

```typescript
import { isMqttConnected, getMqttClient } from './src/mqtt/client.js';

if (isMqttConnected()) {
  const client = getMqttClient();
  // Use client
}
```

---

## Testing Checklist

- [ ] Docker running with MQTT broker
- [ ] `MQTT_BROKER_URL` set in `.env`
- [ ] `npm run build` compiles without errors
- [ ] `docker compose logs` shows MQTT connection
- [ ] Can see "✅ Connected to MQTT broker" in logs
- [ ] Can call `connectMqtt()` without errors
- [ ] Can call `disconnectMqtt()` without errors
- [ ] `isMqttConnected()` returns correct status

---

## Troubleshooting Quick Ref

| Problem | Check |
|---------|-------|
| Connection timeout | Is MQTT broker running? Is URL correct? |
| Connection refused | Is broker accepting connections? Is port open? |
| Auth error | Is username/password correct? |
| Module not found | Did you run `npm install`? |
| TypeScript errors | Did you run `npm run build`? |

---

## Next Steps

1. **Test Connection**
   ```bash
   docker compose up -d
   docker compose logs -f
   ```

2. **Verify Connection**
   - Look for "✅ Connected to MQTT broker"

3. **Add Subscriptions**
   - See next module: `src/mqtt/handlers.ts`

4. **Process Events**
   - Implement message handlers
   - Save to database

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/mqtt/client.ts` | Core connection module |
| `src/mqtt/index.ts` | Integration examples |
| `MQTT_CLIENT_GUIDE.md` | Full documentation |
| `MQTT_SETUP.md` | Quick start guide |

---

**Status**: ✅ Complete  
**Compilation**: ✅ No errors  
**Ready to use**: ✅ Yes  
**Next module**: Message handlers & subscriptions
