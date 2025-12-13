# Ingestor Service

Node.js TypeScript service for ingesting MQTT messages from Frigate and persisting data to PostgreSQL.

## 🐳 Docker Setup (Recommended) ⭐

Everything is containerized with PostgreSQL included:

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**That's it!** PostgreSQL runs on localhost:5432, ingestor on port 3000.

📖 See `DOCKER_QUICK_REFERENCE.md` for more commands, `DOCKER.md` for detailed guide.

---

## Manual Setup (Without Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (separate installation required)
- MQTT broker

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection
```

### 3. Initialize database
```bash
npm run db:push
```

### 4. Start development
```bash
npm run dev
```

---

## Project Structure

```
ingestor/
├── 🐳 Docker Files
│   ├── docker-compose.yml         # Multi-container setup
│   ├── Dockerfile                 # Application container
│   ├── .dockerignore              # Docker build ignore
│   └── docker-start.sh            # Interactive menu
│
├── 📁 src/
│   ├── index.ts                   # Application entrypoint
│   ├── config/
│   │   ├── ConfigManager.ts       # Configuration singleton
│   │   └── env.ts                 # Environment variables
│   ├── mqtt/
│   │   ├── MqttClient.ts          # MQTT client (TODO)
│   │   └── MessageHandler.ts      # Message routing (TODO)
│   └── db/
│       ├── client.ts              # Prisma singleton
│       ├── service.ts             # Database operations
│       └── types.ts               # Type documentation
│
├── 📁 prisma/
│   └── schema.prisma              # Database schema
│
├── 📚 Documentation
│   ├── README.md                  # This file
│   ├── DOCKER.md                  # Docker detailed guide
│   ├── DOCKER_QUICK_REFERENCE.md  # Docker quick ref
│   ├── CONFIGURATION.md           # Environment variables
│   ├── PRISMA.md                  # Prisma guide
│   └── More guides...
│
└── Configuration
    ├── package.json               # Dependencies
    ├── tsconfig.json              # TypeScript config
    ├── .env                       # Docker-ready env vars
    └── .env.example               # Template
```

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **ORM**: Prisma 5.7 with PostgreSQL 16
- **Containerization**: Docker + Docker Compose
- **Message Queue**: MQTT
- **Code Quality**: ESLint + Prettier
- **Development**: Nodemon + tsx

## Quick Commands

### Docker (Recommended)

```bash
# Start/Stop
docker-compose up -d               # Start
docker-compose down                # Stop

# Logs & Status
docker-compose ps                  # Check status
docker-compose logs -f             # Follow logs

# Development
docker-compose exec ingestor npm run dev        # Hot reload
docker-compose exec ingestor npm run build      # Compile
docker-compose exec ingestor npm run lint       # Check code

# Database  
docker-compose exec ingestor npm run prisma:migrate    # Migration
docker-compose exec ingestor npm run prisma:studio     # GUI
docker-compose exec postgres psql -U postgres          # PostgreSQL CLI
```

### Local Development

```bash
npm run dev              # Start with hot reload
npm run build           # Compile TypeScript
npm run lint            # Check code

npm run db:push         # Create/update database
npm run prisma:migrate  # Create migration
npm run prisma:studio   # Open Prisma GUI
```

## Database Schema

### Tenant Model
- Multi-tenancy support
- Represents organization/customer

### Camera Model
- Represents Frigate camera
- Unique key per tenant
- One-to-many with events

### Event Model
- Frigate detection events
- Full payload stored as JSON
- Timestamps and availability flags

See `PRISMA.md` for detailed schema documentation.

## Configuration

### Environment Variables

**Required:**
- `POSTGRES_URL` - Database connection string
- `MQTT_BROKER_URL` - MQTT broker URL

**Optional:**
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `NODE_ENV` - Environment (development, production, test)

See `CONFIGURATION.md` for details.

## Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build           # Compile TypeScript
npm start               # Run production build

# Code Quality
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix issues
npm run format          # Prettier format

# Database
npm run db:push         # Push schema to database
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Create migration
npm run prisma:studio   # Open Prisma Studio
```

## Usage Example

```typescript
import { dbService } from './src/db/service.js';

// Create a tenant
const tenant = await dbService.createTenant('ACME Corp');

// Create a camera
const camera = await dbService.createCamera(
  tenant.id,
  'front-door',
  'Front Door Camera'
);

// Create an event
const event = await dbService.createEvent(
  tenant.id,
  camera.id,
  'frigate-event-123',
  'person',
  { /* mqtt payload */ }
);

// Query recent events
const recent = await dbService.getEventsByCamera(camera.id, 100);
```

## Documentation

| Document | Purpose |
|----------|---------|
| **DOCKER.md** | Complete Docker guide |
| **DOCKER_QUICK_REFERENCE.md** | Docker commands cheatsheet |
| **CONFIGURATION.md** | Environment variables |
| **PRISMA.md** | Database and ORM guide |
| **PRISMA_QUICKSTART.md** | Prisma quick start |

## Code Quality

- **TypeScript** - Strict mode enabled
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Nodemon** - Auto-restart on changes
- **dotenv** - Environment management

---

**Status**: ✅ Ready for Development

Start with: `docker-compose up -d`

npx tsx scripts/publish-payload.ts <topic> <file>