# Ingestor Service

Node.js TypeScript service for ingesting MQTT messages and persisting data to a database.

## Project Structure

```
src/
├── index.ts           # Application entrypoint
├── config/           # Configuration management
│   ├── ConfigManager.ts
│   └── env.ts
├── mqtt/            # MQTT client and message handling
│   ├── MqttClient.ts
│   └── MessageHandler.ts
└── db/              # Database connection and migrations
    ├── Database.ts
    └── migrations.ts
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Start production server:
```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Check code quality
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Configuration

All configuration is managed through environment variables. See `.env.example` for available options.

## Development

- **TypeScript** - Strict mode enabled for type safety
- **ESLint** - Code quality checks
- **Prettier** - Code formatting
- **Nodemon** - Automatic restart on file changes
- **dotenv** - Environment variable loading
