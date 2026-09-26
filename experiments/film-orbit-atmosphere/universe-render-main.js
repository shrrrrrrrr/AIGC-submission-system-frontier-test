import { scene, sections, input, reducedMotion } from './universe-main.js';
import { createUniverseRenderer } from './universe-renderer.js';

const universeRenderer = createUniverseRenderer({ sceneRoot: scene, sections, input, reducedMotion });

if (universeRenderer) {
  addEventListener('pagehide', () => universeRenderer.dispose(), { once: true });
}