# MQTT Client Module - Quick Start

## What Was Created

✅ **`src/mqtt/client.ts`** - MQTT connection management module  
✅ **`src/mqtt/index.ts`** - Integration examples and exports  
✅ **`MQTT_CLIENT_GUIDE.md`** - Complete documentation

---

## Quick Usage

### 1. Connect to MQTT Broker

```typescript
import { connectMqtt } from './src/mqtt/client.js';

// In your main app
const mqttClient = await connectMqtt();
console.log('Connected to MQTT!');
```

### 2. Check Connection Status

```typescript
import { isMqttConnected, getMqttClient } from './src/mqtt/client.js';

if (isMqttConnected()) {
  const client = getMqttClient();
  client?.publish('test/topic', 'Hello MQTT!');
}
```

### 3. Disconnect Gracefully

```typescript
import { disconnectMqtt } from './src/mqtt/client.js';

process.on('SIGINT', async () => {
  await disconnectMqtt();
  process.exit(0);
});
```

### 4. Wait for Ready (with timeout)

```typescript
import { connectMqtt, waitForMqttReady } from './src/mqtt/client.js';

const client = await connectMqtt();
await waitForMqttReady(10000); // Wait 10 seconds
console.log('MQTT is ready!');
```

---

## Integration Pattern

### In `src/index.ts`

```typescript
import { connectMqtt, disconnectMqtt } from './mqtt/client.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';

async function main() {
  try {
    // Start services
    await connectDatabase();
    await connectMqtt();
    
    console.log('🚀 Ingestor service running');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('⚠️  Shutting down...');
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

## Environment Configuration

The MQTT client reads from `.env`:

```bash
MQTT_BROKER_URL=mqtt://host.docker.internal:1883
MQTT_USERNAME=                    # Optional
MQTT_PASSWORD=                    # Optional
```

For local testing with Docker:
```bash
MQTT_BROKER_URL=mqtt://host.docker.internal:1883
```

For production:
```bash
MQTT_BROKER_URL=mqtt://mqtt-broker.example.com:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
```

---

## API Overview

| Function | Purpose | Returns |
|----------|---------|---------|
| `connectMqtt()` | Connect to broker | `Promise<MqttClient>` |
| `disconnectMqtt()` | Disconnect gracefully | `Promise<void>` |
| `getMqttClient()` | Get current client | `MqttClient \| null` |
| `isMqttConnected()` | Check connection status | `boolean` |
| `waitForMqttReady(timeout?)` | Wait for connection ready | `Promise<void>` |

---

## Features Implemented

✅ **Singleton Pattern** - Only one connection instance  
✅ **Connection Reuse** - Returns existing connection if already connected  
✅ **Async/Await** - Modern async patterns throughout  
✅ **Auto-Reconnection** - Automatic reconnect with 1s interval  
✅ **Timeout Handling** - 30s connection timeout with fallback  
✅ **Event Logging** - Comprehensive logging of all connection states  
✅ **Error Handling** - Proper error catching and propagation  
✅ **Graceful Shutdown** - Clean disconnection with callbacks  
✅ **No Subscriptions Yet** - Ready for subscription logic (next step)

---

## Connection Options

Configured automatically:

| Option | Value | Purpose |
|--------|-------|---------|
| Reconnect Interval | 1000 ms | How often to retry after disconnect |
| Connection Timeout | 30 seconds | Max time to wait for initial connection |
| Keep Alive | 60 seconds | Ping interval to keep connection alive |
| Protocol | MQTT 3.1.1 | Standard MQTT version |
| Session | Clean | Start fresh session each time |
| Client ID | `ingestor-{timestamp}` | Unique identifier |

---

## Event Output Examples

### Successful Connection
```
🔌 Connecting to MQTT broker...
   URL: mqtt://host.docker.internal:1883
✅ Connected to MQTT broker
```

### With Username
```
🔌 Connecting to MQTT broker...
   URL: mqtt://broker:1883
   Username: user@domain.com
✅ Connected to MQTT broker
```

### Reconnection
```
⚠️  Disconnected from MQTT broker
🔄 Attempting to reconnect to MQTT broker...
✅ Connected to MQTT broker
```

### Error Handling
```
🔌 Connecting to MQTT broker...
   URL: mqtt://unreachable:1883
❌ MQTT error: Connection refused
MQTT connection timeout (30s). Broker unreachable at mqtt://unreachable:1883
```

---

## Next Steps

After verifying MQTT connection works:

1. **Test with Real MQTT Broker**
   ```bash
   docker run -d -p 1883:1883 eclipse-mosquitto
   ```

2. **Update `.env` to point to your broker**
   ```bash
   MQTT_BROKER_URL=mqtt://localhost:1883
   ```

3. **Test Connection**
   ```bash
   docker compose up -d
   docker compose logs -f ingestor-app
   ```

4. **Next: Implement Topic Subscriptions**
   - Subscribe to Frigate event topics
   - Add message handlers
   - Process events and save to database

---

## File Structure

```
src/mqtt/
├── client.ts          ✅ Connection module (NEW)
├── index.ts           ✅ Integration examples (NEW)
├── MqttClient.ts      (existing - to be enhanced)
└── handlers.ts        (to be created - for message processing)
```

---

## Testing

### Manual Connection Test
```typescript
// In src/index.ts
async function main() {
  console.log('Testing MQTT connection...');
  const client = await connectMqtt();
  console.log('✅ Test successful!');
  await disconnectMqtt();
}
```

### Docker Test
```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f ingestor-app

# Should see:
# ✅ Database connected successfully
# 🔌 Connecting to MQTT broker...
# ✅ Connected to MQTT broker
```

---

## Troubleshooting

### "MQTT connection timeout"
- MQTT broker is not running or unreachable
- Check `MQTT_BROKER_URL` in `.env`
- Verify network connectivity to broker

### "Connection refused"
- Broker is not listening on specified port
- Check firewall rules
- Verify broker is running: `mosquitto_pub -h localhost -t test -m hello`

### "Authentication failed"
- Username/password is incorrect
- Broker requires credentials but none provided
- Check broker logs for auth errors

---

## Logs Meaning

| Log | Meaning | Action |
|-----|---------|--------|
| `📡 Connecting to MQTT broker...` | Starting connection attempt | Wait a moment |
| `✅ Connected to MQTT broker` | Successfully connected | Ready to use |
| `🔄 Attempting to reconnect...` | Lost connection, auto-retrying | Normal behavior |
| `❌ MQTT error` | Connection error occurred | Check broker/network |
| `⚠️  Disconnected from MQTT broker` | Connection lost | Module will reconnect |
| `🛑 MQTT client connection ended` | Clean disconnect (shutdown) | Normal on exit |

---

**Status**: ✅ **READY TO USE**  
**Testing**: Build successful, no TypeScript errors  
**Next**: Implement message subscriptions and handlers

For full documentation, see: **[MQTT_CLIENT_GUIDE.md](MQTT_CLIENT_GUIDE.md)**
