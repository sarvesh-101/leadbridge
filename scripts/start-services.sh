#!/bin/bash
# Start all services for LeadBridge platform

PROJECT_ROOT="C:/Users/Ganesh/Desktop/LEAD CONVERION"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

echo "Starting all services..."

# Start server (Node.js/Fastify on port 3000)
cd "$PROJECT_ROOT/server" || exit 1
nohup npx tsx src/index.ts > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$LOG_DIR/server.pid"
echo "Server started (port 3000) - PID: $(cat "$LOG_DIR/server.pid")"

# Start backend (Python/FastAPI on port 8000)
cd "$PROJECT_ROOT/backend" || exit 1
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$LOG_DIR/backend.pid"
echo "Backend started (port 8000) - PID: $(cat "$LOG_DIR/backend.pid")"

# Start frontend (Next.js on port 3001)
cd "$PROJECT_ROOT/frontend" || exit 1
nohup npx next dev --port 3001 > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$LOG_DIR/frontend.pid"
echo "Frontend started (port 3001) - PID: $(cat "$LOG_DIR/frontend.pid")"

echo ""
echo "All services starting. Check logs at: $LOG_DIR"
echo "  Server:  http://localhost:3000/health"
echo "  Backend: http://localhost:8000/health"
echo "  Frontend: http://localhost:3001"
