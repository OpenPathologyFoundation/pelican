#!/usr/bin/env node
/**
 * Session Awareness Service CLI
 *
 * Start the Session Awareness WebSocket server.
 */

import { SessionAwarenessServer } from './websocket-server';
import { DEFAULT_SERVER_CONFIG, type ServerConfig } from './types';

/** Parse command line arguments (falls back to env vars). */
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

    if (arg === '--jwt-enabled') {
      config.jwtEnabled = true;
    }

    if (arg === '--jwt-secret') {
      config.jwtSecret = args[++i];
    }

    if (arg === '--jwt-audience') {
      config.jwtAudience = args[++i];
    }

    if (arg === '--jwt-issuer') {
      config.jwtIssuer = args[++i];
    }
  }

  return config;
}

/** Env var fallbacks. CLI flags win. */
function envConfig(): Partial<ServerConfig> {
  const env = process.env;
  const config: Partial<ServerConfig> = {};

  if (env.SESSION_SERVICE_PORT) {
    const port = parseInt(env.SESSION_SERVICE_PORT, 10);
    if (!isNaN(port)) config.port = port;
  }
  if (env.SESSION_SERVICE_HOST) {
    config.host = env.SESSION_SERVICE_HOST;
  }

  // JWT: accept either SESSION_SERVICE_* or the shared STARLING_JWT_* so the
  // session service can drop into the same deployment secret management as
  // the auth-system (matches src/main/resources/application.yml).
  if (env.SESSION_SERVICE_JWT_ENABLED === 'true' || env.STARLING_JWT_ENABLED === 'true') {
    config.jwtEnabled = true;
  }
  const secret = env.SESSION_SERVICE_JWT_SECRET ?? env.STARLING_JWT_SECRET;
  if (secret) {
    config.jwtSecret = secret;
  }
  const audience = env.SESSION_SERVICE_JWT_AUDIENCE ?? env.STARLING_JWT_AUDIENCE;
  if (audience) {
    config.jwtAudience = audience;
  }
  const issuer = env.SESSION_SERVICE_JWT_ISSUER ?? env.STARLING_JWT_ISSUER;
  if (issuer) {
    config.jwtIssuer = issuer;
  }

  return config;
}

function printHelp(): void {
  console.log(`
Session Awareness Service — FDP Layer 2 WebSocket Hub

Usage:
  session-service [options]

Options:
  --port, -p <port>           Port to listen on (default: ${DEFAULT_SERVER_CONFIG.port})
  --host, -h <host>           Host to bind to (default: ${DEFAULT_SERVER_CONFIG.host})
  --heartbeat-timeout <ms>    Heartbeat timeout in ms (default: ${DEFAULT_SERVER_CONFIG.heartbeatTimeout})
  --cleanup-interval <ms>     Cleanup interval in ms (default: ${DEFAULT_SERVER_CONFIG.cleanupInterval})
  --jwt-enabled               Require JWT on register (strongly recommended)
  --jwt-secret <secret>       Shared HS256 secret (>=32 chars)
  --jwt-audience <aud>        Expected aud claim (default: ${DEFAULT_SERVER_CONFIG.jwtAudience})
  --jwt-issuer <iss>          Expected iss claim (default: ${DEFAULT_SERVER_CONFIG.jwtIssuer})
  --help                      Show this help message

Environment variables (CLI flags override):
  SESSION_SERVICE_PORT, SESSION_SERVICE_HOST
  SESSION_SERVICE_JWT_ENABLED | STARLING_JWT_ENABLED
  SESSION_SERVICE_JWT_SECRET  | STARLING_JWT_SECRET
  SESSION_SERVICE_JWT_AUDIENCE| STARLING_JWT_AUDIENCE
  SESSION_SERVICE_JWT_ISSUER  | STARLING_JWT_ISSUER
`);
}

async function main(): Promise<void> {
  const config: ServerConfig = {
    ...DEFAULT_SERVER_CONFIG,
    ...envConfig(),
    ...parseArgs(),
  };

  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│     Session Awareness Service — FDP Layer 2     │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log(`  Port:              ${config.port}`);
  console.log(`  Host:              ${config.host}`);
  console.log(`  Heartbeat Timeout: ${config.heartbeatTimeout}ms`);
  console.log(`  Cleanup Interval:  ${config.cleanupInterval}ms`);
  console.log(`  JWT enabled:       ${config.jwtEnabled}`);
  if (config.jwtEnabled) {
    console.log(`  JWT audience:      ${config.jwtAudience}`);
    console.log(`  JWT issuer:        ${config.jwtIssuer}`);
  }
  console.log('');

  let server: SessionAwarenessServer;
  try {
    server = new SessionAwarenessServer(config);
  } catch (error) {
    console.error('Refusing to start:', (error as Error).message);
    process.exit(2);
  }

  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();

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
