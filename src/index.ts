#!/usr/bin/env node
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { ConfigManager } from './config/ConfigManager.js';
import { MqttClient } from './mqtt/MqttClient.js';
import { Database } from './db/Database.js';

// TODO: Initialize logger
// TODO: Add graceful shutdown handlers
// TODO: Implement error handling and monitoring

const main = async (): Promise<void> => {
  console.log('Starting ingestor service...');

  try {
    // TODO: Initialize configuration
    const config = ConfigManager.getInstance();

    // TODO: Initialize database
    const db = new Database(config);

    // TODO: Initialize MQTT client
    const mqtt = new MqttClient(config);

    // TODO: Set up error handlers
    process.on('SIGINT', async () => {
      console.log('Gracefully shutting down...');
      // TODO: Cleanup resources
      process.exit(0);
    });

    console.log('Ingestor service running');
  } catch (error) {
    console.error('Failed to start ingestor service:', error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
