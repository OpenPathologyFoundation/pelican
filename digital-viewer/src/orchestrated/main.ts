/**
 * Orchestrated Viewer Entry Point
 *
 * Launched by the Okapi orchestrator via window.open().
 * Communicates with the orchestrator via postMessage bridge.
 */

import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
