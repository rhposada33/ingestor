# 🐳 Docker Quick Reference

## ⚡ Super Quick Start

```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

## 📦 What's Running

| Service | Container | Port | Status |
|---------|-----------|------|--------|
| PostgreSQL | ingestor-db | 5432 | Auto-starts |
| Ingestor App | ingestor-app | 3000 | Auto-starts (dev mode) |

## 🚀 Common Commands

### Start/Stop

```bash
docker-compose up -d              # Start in background
docker-compose up                 # Start with logs
docker-compose stop               # Stop containers
docker-compose down               # Stop and remove
docker-compose restart            # Restart all
```

### Development

```bash
docker-compose logs -f            # Follow logs
docker-compose logs -f ingestor   # App logs only
docker-compose logs -f postgres   # DB logs only
```

### Execute Commands

```bash
# Run npm commands
docker-compose exec ingestor npm run build
docker-compose exec ingestor npm run lint
docker-compose exec ingestor npm run prisma:migrate

# Open shell
docker-compose exec ingestor bash
docker-compose exec postgres psql -U postgres -d ingestor
```

### Database

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d ingestor

# View database files
docker volume ls | grep postgres
```

### Rebuild

```bash
# Rebuild images after dependency changes
docker-compose build
docker-compose up -d

# Force rebuild (no cache)
docker-compose build --no-cache
```

## 🔧 Scripts

```bash
# Interactive menu (OSX/Linux)
./docker-start.sh

# Options:
# 1) Start containers
# 2) Start with logs
# 3) Stop containers
# 4) Rebuild and start
# 5) View logs
# 6) Open shell
# 7) Reset database
```

## 🌐 Access Services

| Service | URL |
|---------|-----|
| Ingestor App | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 (after `npm run prisma:studio`) |
| PostgreSQL | localhost:5432 (from host) |
|  | postgres:5432 (from container) |

## 📋 File Structure

```
.
├── docker-compose.yml    # Multi-container setup
├── Dockerfile            # Build instructions
├── .dockerignore         # Docker build ignore
├── docker-start.sh       # Interactive helper script
├── DOCKER.md            # Detailed guide
└── .env                 # Environment variables (Docker-ready)
```

## 🐛 Troubleshooting

### "Port already in use"
```bash
# Change ports in docker-compose.yml
# Or kill existing container:
docker ps | grep ingestor
docker kill <CONTAINER_ID>
```

### "Can't connect to PostgreSQL"
```bash
# Check if postgres is healthy
docker-compose ps postgres

# View postgres logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres
```

### "Container keeps restarting"
```bash
# Check logs
docker-compose logs ingestor

# Rebuild
docker-compose build --no-cache
```

### "node_modules issues"
```bash
# Rebuild with clean install
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📦 Data Persistence

Database data is stored in Docker volume:
```bash
# List volumes
docker volume ls | grep postgres_data

# The data persists even if containers stop
# Only removed with: docker-compose down -v
```

## 🔄 Development Workflow

1. **Edit Code** - Changes to `src/` are auto-detected
2. **Save File** - Nodemon restarts the app
3. **Check Logs** - `docker-compose logs -f`
4. **See Results** - http://localhost:3000

## 🚢 Production Considerations

The Dockerfile is production-ready but development uses:
- `npm run dev` (nodemon with hot reload)
- Source code mounted (live editing)
- All logs to stdout

For production:
- Use `CMD ["node", "dist/index.js"]`
- Remove volume mounts
- Set `NODE_ENV=production`
- Use secret management for credentials

## 📊 Monitor Resources

```bash
# Real-time stats
docker stats

# Specific container
docker stats ingestor-app

# With formatting
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

## 🧹 Cleanup

```bash
# Stop all containers
docker-compose down

# Remove volumes (delete data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# System cleanup (removes unused resources)
docker system prune
docker system prune -a  # Also removes unused images
```

## 📖 Learn More

- Full guide: `DOCKER.md`
- Docker docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Prisma in Docker: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker

## ✅ Verification Checklist

- [ ] Docker installed and running
- [ ] `docker-compose up -d` succeeds
- [ ] `docker-compose ps` shows healthy containers
- [ ] `docker-compose logs` show no errors
- [ ] PostgreSQL health check passes
- [ ] App logs show "Ingestor service running"
- [ ] Can access http://localhost:3000 (once MQTT is implemented)

---

**Quick Help**: Run `./docker-start.sh` for interactive menu
