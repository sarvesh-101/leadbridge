/**
 * LeadBridge — Local Reverse Proxy
 * Serves frontend (port 3001) and backend API (port 3000)
 * on a single port (8080) for ngrok to tunnel.
 *
 * Routes:
 *   /api/*  → http://localhost:3000/api/*
 *   /ws     → http://localhost:3000 (WebSocket for frontend)
 *   /*      → http://localhost:3001 (Next.js frontend)
 */

const http = require("http");
const url = require("url");

const PROXY_PORT = 8080;
const FRONTEND_TARGET = "http://localhost:3001";
const BACKEND_TARGET = "http://localhost:3000";

const server = http.createServer((req, res) => {
  const requestUrl = req.url || "/";
  const parsed = url.parse(requestUrl);
  const path = parsed.pathname || "/";

  // Helper: proxy a request to a target
  function proxyTo(target) {
    const targetUrl = url.parse(target);
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: requestUrl,
      method: req.method,
      headers: { ...req.headers },
    };

    // Remove host header so target server uses its own
    delete options.headers["host"];

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status and headers, then pipe response body
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      console.error(`Proxy error to ${target}:`, err.message);
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Bad Gateway: ${err.message}`);
    });

    req.pipe(proxyReq);
  }

  // ─── API routes: proxy to backend ──────────────────────────
  if (path.startsWith("/api/") || path.startsWith("/ws") || path === "/health") {
    return proxyTo(BACKEND_TARGET);
  }

  // ─── Everything else: proxy to frontend (Next.js) ──────────
  proxyTo(FRONTEND_TARGET);
});

// ─── WebSocket support for Next.js HMR + API WebSocket ────────
server.on("upgrade", (req, socket, head) => {
  const wsUrl = req.url || "/";
  const wsPath = url.parse(wsUrl).pathname || "/";

  // Determine which target to use
  const target = wsPath.startsWith("/api/") || wsPath.startsWith("/ws")
    ? BACKEND_TARGET
    : FRONTEND_TARGET;

  const targetUrl = url.parse(target);

  const proxySocket = http.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: wsUrl,
    method: "GET",
    headers: { ...req.headers },
  });

  proxySocket.on("upgrade", (proxyRes, proxySocketStream) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "\r\n"
    );
    socket.pipe(proxySocketStream).pipe(socket);
  });

  proxySocket.on("error", (err) => {
    console.error("WebSocket proxy error:", err.message);
    socket.destroy();
  });

  proxySocket.end();
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         LeadBridge — Reverse Proxy Active        ║
╠══════════════════════════════════════════════════╣
║  Local          → http://localhost:${PROXY_PORT}        ║
║  Frontend       → ${FRONTEND_TARGET.padEnd(36)} ║
║  Backend API    → ${BACKEND_TARGET.padEnd(36)} ║
║                                                  ║
║  Routes:                                         ║
║    /api/*     → Backend API                      ║
║    /health    → Backend health                   ║
║    /*         → Frontend (Next.js)               ║
║                                                  ║
║  Ready for ngrok → http://localhost:${PROXY_PORT}        ║
╚══════════════════════════════════════════════════╝
`);
});
