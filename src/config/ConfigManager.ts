import type { EnvironmentConfig } from './env.js';

// TODO: Define application-level configuration interface
export interface IConfig {
  // Environment configuration
  env: EnvironmentConfig;
  // TODO: Add additional application configuration properties
}

// TODO: Implement configuration loading and validation
export class ConfigManager {
  private static instance: ConfigManager;
  private config: IConfig;

  private constructor(envConfig: EnvironmentConfig) {
    this.config = {
      env: envConfig,
      // TODO: Initialize other configuration sections
    };
  }

  public static getInstance(envConfig: EnvironmentConfig): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(envConfig);
    }
    return ConfigManager.instance;
  }

  public getConfig(): IConfig {
    return this.config;
  }

  public getEnv(): EnvironmentConfig {
    return this.config.env;
  }

  // TODO: Add getter methods for specific configuration sections
}
