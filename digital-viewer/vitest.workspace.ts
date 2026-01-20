import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/fdp-lib/vitest.config.ts',
  'packages/session-service/vitest.config.ts',
  'packages/viewer-core/vitest.config.ts',
  'packages/annotations/vitest.config.ts',
  'packages/review-state/vitest.config.ts',
  'packages/telemetry/vitest.config.ts',
  'packages/voice/vitest.config.ts',
]);
