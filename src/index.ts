#!/usr/bin/env node
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import { getConfig } from './config/env.js';
import { ConfigManager } from './config/ConfigManager.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';

// TODO: Initialize logger
// TODO: Add graceful shutdown handlers
// TODO: Implement error handling and monitoring

const main = async (): Promise<void> => {
  console.log('🚀 Starting ingestor service...');

  try {
    // Load and validate configuration
    const envConfig = getConfig();
    console.log(`📋 Configuration loaded (LOG_LEVEL: ${envConfig.logging.logLevel})`);

    // Initialize ConfigManager with validated config
    const configManager = ConfigManager.getInstance(envConfig);
    const config = configManager.getConfig();

    console.log(`🔗 MQTT Broker: ${config.env.mqtt.brokerUrl}`);
    console.log(`🗄️  Database: ${config.env.database.postgresUrl.split('@')[1]}`);

    // Initialize database connection
    await connectDatabase();

    // TODO: Initialize MQTT client
    // TODO: Set up message handlers

    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Gracefully shutting down...');
      await disconnectDatabase();
      process.exit(0);
    });

    console.log('✅ Ingestor service running');
  } catch (error) {
    console.error('❌ Failed to start ingestor service:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
