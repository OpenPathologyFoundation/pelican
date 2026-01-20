# @pathology/session-service

**Session Awareness Service**

WebSocket hub for FDP Layer 2 cross-context awareness. Tracks open cases per user and broadcasts warnings for multi-case and case-mismatch scenarios.

Based on Pathology Portal Platform Specification v2.1, Section 5.2.3.

## Features

- **Real-time Session Tracking**: Track which cases each user has open
- **Multi-Case Detection**: Warn when a user has multiple cases open simultaneously
- **Case Mismatch Alerts**: Notify when a new case is opened in another window
- **Heartbeat Monitoring**: Detect stale connections and clean up automatically
- **Connection Limits**: Prevent resource exhaustion with per-user connection limits

## Installation

```bash
npm install @pathology/session-service
```

## Quick Start

### Running the Server

```bash
# Using npm script
npm run dev

# Using CLI
npx tsx src/cli.ts --port 8765

# With options
npx tsx src/cli.ts --port 8765 --host 0.0.0.0 --heartbeat-timeout 60000
```

### Programmatic Usage

```typescript
import { SessionAwarenessServer } from '@pathology/session-service';

const server = new SessionAwarenessServer({
  port: 8765,
  host: '0.0.0.0',
  heartbeatTimeout: 60000,
  cleanupInterval: 30000,
  maxConnectionsPerUser: 10,
});

// Start the server
await server.start();

console.log('Session service running on ws://localhost:8765');

// Get server statistics
const stats = server.getStats();
console.log('Active connections:', stats.connections);
console.log('Active users:', stats.users);

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});
```

## Configuration

```typescript
interface ServerConfig {
  /** WebSocket server port */
  port: number;

  /** Host to bind to */
  host: string;

  /** Time before connection considered stale (ms) */
  heartbeatTimeout: number;

  /** Interval for cleanup checks (ms) */
  cleanupInterval: number;

  /** Maximum connections per user */
  maxConnectionsPerUser: number;
}
```

### Default Configuration

```typescript
const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 8765,
  host: '0.0.0.0',
  heartbeatTimeout: 60000,
  cleanupInterval: 30000,
  maxConnectionsPerUser: 10,
};
```

## WebSocket Protocol

### Client → Server Messages

#### Register

Register a window with a case:

```json
{
  "type": "register",
  "payload": {
    "userId": "user-12345",
    "windowId": "window-abc",
    "caseId": "CASE-001",
    "slideId": "SLIDE-001",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Deregister

Unregister a window:

```json
{
  "type": "deregister",
  "payload": {
    "userId": "user-12345",
    "windowId": "window-abc"
  }
}
```

#### Heartbeat

Keep connection alive:

```json
{
  "type": "heartbeat",
  "payload": {
    "userId": "user-12345",
    "windowId": "window-abc"
  }
}
```

#### Focus

Notify that a window gained focus:

```json
{
  "type": "focus",
  "payload": {
    "userId": "user-12345",
    "windowId": "window-abc"
  }
}
```

### Server → Client Messages

#### Warning

Sent when a multi-case or mismatch condition is detected:

```json
{
  "type": "warning",
  "payload": {
    "type": "multi-case",
    "cases": [
      { "caseId": "CASE-001", "windowId": "window-abc" },
      { "caseId": "CASE-002", "windowId": "window-xyz" }
    ],
    "message": "Multiple cases are open in this session"
  }
}
```

Warning types:
- `multi-case`: User has multiple different cases open
- `case-mismatch`: New case opened while another case was being viewed

#### Registered

Confirmation of successful registration:

```json
{
  "type": "registered",
  "payload": {
    "windowId": "window-abc",
    "caseId": "CASE-001"
  }
}
```

#### Error

Error response:

```json
{
  "type": "error",
  "payload": {
    "code": "CONNECTION_LIMIT",
    "message": "Maximum connections per user exceeded"
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  SessionAwarenessServer                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────────────────────────────────────────────────┐ │
│   │                   WebSocket Server                     │ │
│   │                    (ws library)                        │ │
│   └───────────────────────────┬───────────────────────────┘ │
│                               │                              │
│   ┌───────────────────────────┼───────────────────────────┐ │
│   │                   SessionManager                       │ │
│   │  • Connection handling                                 │ │
│   │  • Message routing                                     │ │
│   │  • Warning generation                                  │ │
│   └───────────────────────────┬───────────────────────────┘ │
│                               │                              │
│   ┌───────────────────────────┼───────────────────────────┐ │
│   │                    SessionStore                        │ │
│   │  • Registration storage                                │ │
│   │  • User → Windows mapping                              │ │
│   │  • Heartbeat tracking                                  │ │
│   │  • Stale connection cleanup                            │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### SessionStore

In-memory storage for session registrations:

```typescript
import { SessionStore } from '@pathology/session-service';

const store = new SessionStore({
  heartbeatTimeout: 60000,
  maxConnectionsPerUser: 10,
});

// Register a window
store.register({
  userId: 'user-123',
  windowId: 'window-abc',
  caseId: 'CASE-001',
  slideId: 'SLIDE-001',
  timestamp: new Date().toISOString(),
});

// Get user's registrations
const registrations = store.getUserRegistrations('user-123');

// Update heartbeat
store.updateHeartbeat('user-123', 'window-abc');

// Clean up stale connections
const removed = store.cleanupStale();
```

### SessionManager

Handles WebSocket connections and message routing:

```typescript
import { SessionManager } from '@pathology/session-service';

const manager = new SessionManager(store);

// Handle incoming connection
manager.handleConnection(websocket, connectionId);

// Handle incoming message
manager.handleMessage(connectionId, message);

// Handle disconnection
manager.handleDisconnection(connectionId);
```

## CLI Options

```
Usage: session-service [options]

Options:
  -p, --port <number>              Port to listen on (default: 8765)
  -h, --host <string>              Host to bind to (default: "0.0.0.0")
  -t, --heartbeat-timeout <ms>     Heartbeat timeout in ms (default: 60000)
  -c, --cleanup-interval <ms>      Cleanup interval in ms (default: 30000)
  -m, --max-connections <number>   Max connections per user (default: 10)
  --help                           Display help
```

## Integration with FDP Library

The session service is designed to work with [@pathology/fdp-lib](../fdp-lib/README.md):

```typescript
// Client-side (browser)
import { FocusDeclarationProtocol } from '@pathology/fdp-lib';

const fdp = new FocusDeclarationProtocol({
  sessionServiceUrl: 'ws://localhost:8765',
  userId: 'user-12345',
});

// FDP will automatically:
// 1. Connect to session service
// 2. Register when initialized with a case
// 3. Send heartbeats to maintain connection
// 4. Receive and display warnings
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Health Monitoring

The server provides statistics for monitoring:

```typescript
const stats = server.getStats();

// Returns:
{
  connections: 42,        // Total active connections
  users: 15,              // Unique users
  registrations: 38,      // Active registrations
  uptime: 3600000,        // Server uptime in ms
}
```

## Production Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 8765
CMD ["node", "dist/cli.js"]
```

### Docker Compose

```yaml
session-service:
  build: ./packages/session-service
  ports:
    - "8765:8765"
  environment:
    - PORT=8765
    - HEARTBEAT_TIMEOUT=60000
  restart: unless-stopped
```

### Health Check

```bash
# WebSocket health check
wscat -c ws://localhost:8765 -x '{"type":"ping"}'
```

## License

Apache-2.0
