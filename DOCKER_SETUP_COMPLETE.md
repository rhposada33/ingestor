# 🐳 Docker Setup Complete

## ✅ What Was Created

### Docker Configuration Files
1. **docker-compose.yml** - Multi-container orchestration
   - PostgreSQL service (healthy, persistent data)
   - Ingestor service (dev mode with hot reload)
   - Automatic health checks
   - Network isolation

2. **Dockerfile** - Multi-stage build
   - Builder stage (compile)
   - Production stage (optimized)
   - Health checks included
   - Ready for production

3. **.dockerignore** - Build optimization
   - Excludes unnecessary files
   - Keeps image small

4. **docker-start.sh** - Interactive menu script
   - Choose start/stop/rebuild
   - View logs
   - Reset database

### Documentation
1. **DOCKER.md** - 300+ line comprehensive guide
2. **DOCKER_QUICK_REFERENCE.md** - Command cheatsheet
3. **README.md** - Updated with Docker first

---

## 🚀 Getting Started

### One-Command Setup

```bash
cd /home/rafa/satelitrack/ingestor
docker-compose up -d
```

That's it! Services start automatically:
- PostgreSQL on localhost:5432
- Ingestor app on port 3000
- Auto-health checks
- Hot reload enabled

### Verify It's Working

```bash
# Check containers
docker-compose ps

# Expected output:
# NAME              STATUS
# ingestor-db       Up (healthy)
# ingestor-app      Up

# View logs
docker-compose logs -f
```

### Stop When Done

```bash
docker-compose down
```

---

## 📁 Docker Files Created

```
ingestor/
├── docker-compose.yml               ✨ NEW - Orchestration
├── Dockerfile                       ✨ NEW - Build config
├── .dockerignore                    ✨ NEW - Optimize build
├── docker-start.sh                  ✨ NEW - Helper script
├── DOCKER.md                        ✨ NEW - Full guide (300+ lines)
├── DOCKER_QUICK_REFERENCE.md        ✨ NEW - Cheatsheet
└── README.md                        📝 UPDATED - Docker first
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         ingestor-network                │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────┐  ┌────────────┐  │
│  │  ingestor-app    │  │ postgres   │  │
│  │                  │→ │            │  │
│  │  - Node.js       │  │ - psql 16  │  │
│  │  - npm run dev   │  │ - persistent│  │
│  │  - Hot reload    │  │   volume   │  │
│  │  - Port 3000     │  │ - Port 5432│  │
│  └──────────────────┘  └────────────┘  │
│                                         │
└─────────────────────────────────────────┘

Volume: postgres_data (persistent)
Network: bridge (internal)
```

---

## 🔧 Common Tasks

### Start Fresh

```bash
# Complete reset
docker-compose down -v    # Delete data
docker-compose up -d      # Fresh start
```

### View Logs

```bash
docker-compose logs -f            # All services
docker-compose logs -f ingestor   # App only
docker-compose logs -f postgres   # Database only
```

### Run Commands

```bash
# NPM commands
docker-compose exec ingestor npm run build
docker-compose exec ingestor npm run lint

# Prisma commands
docker-compose exec ingestor npm run prisma:migrate
docker-compose exec ingestor npm run prisma:studio

# PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d ingestor
```

### Development

Code changes auto-reload:
```bash
# Edit file
vim src/index.ts

# Changes auto-detected (nodemon)
# Watch logs
docker-compose logs -f
```

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **PostgreSQL** | Version 16 Alpine (lightweight) |
| **Data Persistence** | Docker volume (survives restarts) |
| **Health Checks** | Auto-restart on failure |
| **Hot Reload** | Nodemon watches for changes |
| **Networking** | Internal bridge + port exposure |
| **Multi-Stage Build** | Optimized Docker image |
| **Environment Vars** | Auto-loaded from .env |
| **Logs** | Docker Compose log aggregation |

---

## 🎯 Environment Configuration

The `.env` file is already configured for Docker:

```bash
# Database (Docker service name)
POSTGRES_URL=postgres://postgres:postgres@postgres:5432/ingestor

# MQTT (for host.docker.internal)
MQTT_BROKER_URL=mqtt://host.docker.internal:1883

# App
NODE_ENV=development
LOG_LEVEL=info
```

**For MQTT on host machine:**
- macOS/Windows: Use `host.docker.internal`
- Linux: Use `172.17.0.1` or full IP

---

## 📊 Volumes & Data

```bash
# List volumes
docker volume ls | grep postgres_data

# Inspect volume
docker volume inspect ingestor_postgres_data

# Data location
# Linux: /var/lib/docker/volumes/ingestor_postgres_data/_data
# macOS/Windows: Docker Desktop manages it
```

To delete data:
```bash
docker-compose down -v
```

---

## 🔍 Inspect Services

```bash
# Show config
docker-compose config

# List containers
docker-compose ps

# Container details
docker inspect ingestor-app
docker inspect ingestor-db

# Resource usage
docker stats
```

---

## 🛠️ Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose logs

# Common issues:
# 1. Port in use: Change in docker-compose.yml
# 2. Insufficient RAM: Close other apps
# 3. Docker not running: Start Docker Desktop
```

### Database Connection Fails

```bash
# Check PostgreSQL health
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres

# Wait for startup (can take 10 seconds)
sleep 15
docker-compose ps
```

### Hot Reload Not Working

```bash
# Rebuild images
docker-compose build --no-cache

# Restart
docker-compose down
docker-compose up -d
```

### Need Fresh Database

```bash
# Complete reset
docker-compose down -v
docker-compose up -d
```

---

## 📈 Performance

### Optimize Build

```bash
# Skip cache rebuild
docker-compose build --no-cache

# Rebuild without cache
docker system prune -a  # Clean up old images
docker-compose build
```

### Monitor Resources

```bash
# Real-time stats
docker stats

# Specific container
docker stats ingestor-app
```

---

## 🚀 Next Steps

1. ✅ **Docker**: Setup complete
2. ✅ **Database**: PostgreSQL running
3. ✅ **Configuration**: .env ready
4. ⏳ **MQTT Integration**: Implement handlers
5. ⏳ **Testing**: Verify with test data
6. ⏳ **Production**: Prepare for deployment

---

## 📚 Documentation

- **Quick Start**: This file (you are here)
- **Full Guide**: `DOCKER.md`
- **Command Reference**: `DOCKER_QUICK_REFERENCE.md`
- **Project Overview**: `README.md`

---

## ✅ Verification

Your Docker setup is complete and ready:

- ✅ docker-compose.yml configured
- ✅ Dockerfile multi-stage build
- ✅ PostgreSQL service ready
- ✅ Ingestor service ready
- ✅ Environment variables set
- ✅ Health checks configured
- ✅ Documentation complete

### Start with:

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f
```

---

**Status**: ✅ **READY TO USE**

Run: `docker-compose up -d`
