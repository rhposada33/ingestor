/**
 * Environment variable configuration with strong typing and validation
 */

export interface EnvironmentConfig {
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

/**
 * Validates that a required environment variable is set
 */
function getRequiredEnvVar(varName: string): string {
  const value = process.env[varName];

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${varName}. ` +
        `Please set it in your .env file or as an environment variable.`
    );
  }

  return value;
}

/**
 * Validates that an environment variable is set and is a valid URL
 */
function getRequiredUrlEnvVar(varName: string): string {
  const value = getRequiredEnvVar(varName);

  try {
    new URL(value);
  } catch {
    throw new Error(
      `Invalid URL for ${varName}: "${value}". ` +
        `Please provide a valid URL (e.g., mqtt://localhost:1883 or postgres://user:pass@host/db)`
    );
  }

  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getOptionalEnvVar(varName: string, defaultValue: string | null = null): string | null {
  const value = process.env[varName];
  return value && value.trim().length > 0 ? value : defaultValue;
}

/**
 * Validates and parses log level
 */
function getLogLevel(value: string): 'debug' | 'info' | 'warn' | 'error' {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  const normalizedValue = value.toLowerCase();

  if (!validLevels.includes(normalizedValue)) {
    throw new Error(
      `Invalid LOG_LEVEL: "${value}". ` +
        `Must be one of: ${validLevels.join(', ')}`
    );
  }

  return normalizedValue as 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Loads and validates all environment variables
 * Throws an error if required variables are missing or invalid
 */
export function loadEnvironmentVariables(): EnvironmentConfig {
  try {
    const config: EnvironmentConfig = {
      mqtt: {
        brokerUrl: getRequiredUrlEnvVar('MQTT_BROKER_URL'),
        username: getOptionalEnvVar('MQTT_USERNAME'),
        password: getOptionalEnvVar('MQTT_PASSWORD'),
      },
      database: {
        postgresUrl: getRequiredUrlEnvVar('POSTGRES_URL'),
      },
      logging: {
        logLevel: getLogLevel(getOptionalEnvVar('LOG_LEVEL', 'info') || 'info'),
      },
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development',
    };

    return config;
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Configuration Error:');
      console.error(error.message);
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      console.error('See .env.example for the required format.');
    }
    process.exit(1);
  }
}

/**
 * Get the environment configuration (singleton)
 */
let cachedConfig: EnvironmentConfig | null = null;

export function getConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnvironmentVariables();
  }
  return cachedConfig;
}
