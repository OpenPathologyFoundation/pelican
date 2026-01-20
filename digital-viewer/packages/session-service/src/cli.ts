#!/usr/bin/env node
/**
 * Session Awareness Service CLI
 *
 * Start the Session Awareness WebSocket server.
 *
 * Usage:
 *   session-service [options]
 *
 * Options:
 *   --port, -p      Port to listen on (default: 8765)
 *   --host, -h      Host to bind to (default: 0.0.0.0)
 *   --help          Show this help message
 */

import { SessionAwarenessServer } from './websocket-server';
import { DEFAULT_SERVER_CONFIG, type ServerConfig } from './types';

/** Parse command line arguments */
function parseArgs(): Partial<ServerConfig> {
  const args = process.argv.slice(2);
  const config: Partial<ServerConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--port' || arg === '-p') {
      const port = parseInt(args[++i], 10);
      if (!isNaN(port)) {
        config.port = port;
      }
    }

    if (arg === '--host' || arg === '-h') {
      config.host = args[++i];
    }

    if (arg === '--heartbeat-timeout') {
      const timeout = parseInt(args[++i], 10);
      if (!isNaN(timeout)) {
        config.heartbeatTimeout = timeout;
      }
    }

    if (arg === '--cleanup-interval') {
      const interval = parseInt(args[++i], 10);
      if (!isNaN(interval)) {
        config.cleanupInterval = interval;
      }
    }
  }

  return config;
}

/** Print help message */
function printHelp(): void {
  console.log(`
Session Awareness Service - FDP Layer 2 WebSocket Hub

Usage:
  session-service [options]

Options:
  --port, -p <port>           Port to listen on (default: ${DEFAULT_SERVER_CONFIG.port})
  --host, -h <host>           Host to bind to (default: ${DEFAULT_SERVER_CONFIG.host})
  --heartbeat-timeout <ms>    Heartbeat timeout in ms (default: ${DEFAULT_SERVER_CONFIG.heartbeatTimeout})
  --cleanup-interval <ms>     Cleanup interval in ms (default: ${DEFAULT_SERVER_CONFIG.cleanupInterval})
  --help                      Show this help message

Examples:
  session-service
  session-service --port 8080
  session-service --host 127.0.0.1 --port 8765
`);
}

/** Main entry point */
async function main(): Promise<void> {
  const userConfig = parseArgs();
  const config: ServerConfig = { ...DEFAULT_SERVER_CONFIG, ...userConfig };

  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│     Session Awareness Service - FDP Layer 2    │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log(`  Port:              ${config.port}`);
  console.log(`  Host:              ${config.host}`);
  console.log(`  Heartbeat Timeout: ${config.heartbeatTimeout}ms`);
  console.log(`  Cleanup Interval:  ${config.cleanupInterval}ms`);
  console.log('');

  const server = new SessionAwarenessServer(config);

  // Handle shutdown signals
  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();

    // Log stats periodically
    setInterval(() => {
      const stats = server.getStats();
      console.log(
        `[Stats] Connections: ${stats.connections}, Registrations: ${stats.registrations}, Users: ${stats.users}`
      );
    }, 60000);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
