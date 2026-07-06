#!/bin/bash
# Start all services for LeadBridge platform (development mode)
# For production, use: docker compose -f docker/docker-compose.yml up -d

PROJECT_ROOT="$(dirname "$0")/.."
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

echo "Starting LeadBridge development services..."

# Start infrastructure (PostgreSQL + Redis) via Docker Compose
echo "Starting PostgreSQL and Redis..."
cd "$PROJECT_ROOT" || exit 1
docker compose -f docker/docker-compose.yml up -d postgres redis
echo "Infrastructure started"

# Start server (Node.js/Fastify on port 3000)
cd "$PROJECT_ROOT/server" || exit 1
nohup npx tsx src/index.ts > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$LOG_DIR/server.pid"
echo "Server started (port 3000) - PID: $(cat "$LOG_DIR/server.pid")"

# Start frontend (Next.js on port 3001)
cd "$PROJECT_ROOT/frontend" || exit 1
nohup npx next dev --port 3001 > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
echo "Frontend started (port 3001) - PID: $(cat "$LOG_DIR/frontend.pid")"

echo ""
echo "All services starting. Check logs at: $LOG_DIR"
echo "  Server:  http://localhost:3000/health"
echo "  Frontend: http://localhost:3001"
echo ""
echo "To stop: kill \$(cat $LOG_DIR/server.pid) \$(cat $LOG_DIR/frontend.pid)"
echo "To stop infrastructure: docker compose -f docker/docker-compose.yml down"
