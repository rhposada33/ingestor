# Configuration System

## Overview

The ingestor service uses a strongly-typed configuration system based on environment variables with built-in validation.

## Environment Variables

### MQTT Configuration (Required)

- **`MQTT_BROKER_URL`** - The MQTT broker connection URL
  - Format: `mqtt://host:port` or `mqtts://host:port` (for TLS)
  - Example: `mqtt://localhost:1883`
  - Required: ✅ Yes

- **`MQTT_USERNAME`** - MQTT broker authentication username
  - Example: `admin`
  - Required: ❌ No (optional)

- **`MQTT_PASSWORD`** - MQTT broker authentication password
  - Example: `password123`
  - Required: ❌ No (optional)

### Database Configuration (Required)

- **`DATABASE_URL`** - PostgreSQL connection string
  - Format: `postgres://user:password@host:port/database`
  - Example: `postgres://postgres:postgres@localhost:5432/sateliteyes_saas`
  - Required: ✅ Yes
  - Fallback: `POSTGRES_URL` (legacy)

### Application Configuration (Optional)

- **`LOG_LEVEL`** - Logging level
  - Valid values: `debug`, `info`, `warn`, `error`
  - Default: `info`
  - Required: ❌ No (optional)

- **`NODE_ENV`** - Node environment
  - Valid values: `development`, `production`, `test`
  - Default: `development`
  - Required: ❌ No (optional)

- **`TENANT_ID`** - Tenant ID to attach ingested events to
  - Example: `cldu4v9qj0001qz8r8j8r8r8j`
  - Required: ❌ No (optional)

## Setup

1. Copy the example configuration:
```bash
cp .env.example .env
```

2. Update `.env` with your actual values:
```
MQTT_BROKER_URL=mqtt://your-broker:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
DATABASE_URL=postgres://user:pass@localhost:5432/sateliteyes_saas
LOG_LEVEL=info
NODE_ENV=development
TENANT_ID=your-tenant-id
```

## Validation

The configuration system performs the following validations at startup:

1. **Required variables check** - Ensures all required variables are set
2. **URL validation** - Validates that MQTT and database URLs are valid
3. **Log level validation** - Ensures log level is one of the allowed values
4. **Readable error messages** - Provides clear error messages if validation fails

### Example Error Output

If `MQTT_BROKER_URL` is missing:

```
❌ Configuration Error:
Missing required environment variable: MQTT_BROKER_URL. 
Please set it in your .env file or as an environment variable.

Please check your .env file and ensure all required variables are set.
See .env.example for the required format.
```

If `MQTT_BROKER_URL` is invalid:

```
❌ Configuration Error:
Invalid URL for MQTT_BROKER_URL: "not-a-url". 
Please provide a valid URL (e.g., mqtt://localhost:1883 or postgres://user:pass@host/db)

Please check your .env file and ensure all required variables are set.
See .env.example for the required format.
```

## Accessing Configuration

In your code, import and use the configuration:

```typescript
import { getConfig } from './config/env.js';
import { ConfigManager } from './config/ConfigManager.js';

const envConfig = getConfig();
const configManager = ConfigManager.getInstance(envConfig);
const config = configManager.getConfig();

// Access configuration
const brokerUrl = config.env.mqtt.brokerUrl;
const databaseUrl = config.env.database.databaseUrl;
const logLevel = config.env.logging.logLevel;
```

## Type Safety

The configuration system is fully typed with TypeScript interfaces:

```typescript
interface EnvironmentConfig {
  mqtt: {
    brokerUrl: string;
    username: string | null;
    password: string | null;
  };
  database: {
    postgresUrl: string;
  };
  logging: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  nodeEnv: 'development' | 'production' | 'test';
}
```

This ensures type safety when accessing configuration values throughout your application.
