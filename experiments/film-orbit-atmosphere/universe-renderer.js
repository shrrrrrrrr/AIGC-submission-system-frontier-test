import * as THREE from 'three';
import { createParticleField, getParticleQuality, updateParticleField } from './universe-particles.js';

export function createUniverseRenderer({ sceneRoot, input, reducedMotion }) {
  const canvas = sceneRoot.querySelector('.universe-particles');
  if (!canvas) return null;

  const quality = getParticleQuality({ reducedMotion: reducedMotion.matches });
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (error) {
    canvas.setAttribute('data-webgl-fallback', 'true');
    console.error('[universe] WebGL renderer unavailable', error);
    return null;
  }
  renderer.debug.checkShaderErrors = true;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x030915, 22, 98);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
  camera.position.set(0, 0, 26);
  camera.lookAt(0, 0, -20);
  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);
  const field = createParticleField({ quality });
  fieldGroup.add(field.points);

  let width = 1;
  let height = 1;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
  let frame = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let disposed = false;
  const cameraTarget = { x: 0, y: 0, z: -20 };

  const resize = () => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  };

  const render = (now = performance.now()) => {
    if (disposed) return;
    const deltaSeconds = Math.min(0.064, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += deltaSeconds;
    input.step(deltaSeconds);
    const motion = reducedMotion.matches ? 0 : 1;
    const pointerX = input.current.pointerX;
    const pointerY = input.current.pointerY;
    const scroll = input.current.scroll;
    const scrollArc = Math.sin(scroll * Math.PI * 2);
    const scrollLift = Math.cos(scroll * Math.PI * 2);

    cameraTarget.x = pointerX * 0.4 + (scroll - 0.5) * 0.6;
    cameraTarget.y = pointerY * -0.22 + scrollArc * 0.22 * motion;
    cameraTarget.z = -20 + scrollLift * 0.6 * motion;
    camera.position.x += (pointerX * 1.45 + (scroll - 0.5) * 1.8 - camera.position.x) * (1 - Math.exp(-3.8 * deltaSeconds));
    camera.position.y += (pointerY * -0.82 + scrollArc * 0.7 * motion - camera.position.y) * (1 - Math.exp(-3.8 * deltaSeconds));
    camera.position.z += (26 - scroll * 1.8 * motion - camera.position.z) * (1 - Math.exp(-2.8 * deltaSeconds));
    camera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);

    fieldGroup.rotation.y += ((pointerX * 0.045 + (scroll - 0.5) * 0.08) * motion - fieldGroup.rotation.y) * (1 - Math.exp(-2.6 * deltaSeconds));
    fieldGroup.rotation.x += ((pointerY * 0.025 + scrollLift * 0.025 * motion) - fieldGroup.rotation.x) * (1 - Math.exp(-2.6 * deltaSeconds));
    fieldGroup.position.z += ((input.current.scrollVelocity * 0.16 * motion) - fieldGroup.position.z) * (1 - Math.exp(-5.5 * deltaSeconds));

    field.material.uniforms.uMotion.value = motion;
    updateParticleField(field, { elapsed, input, pixelRatio });
    renderer.render(scene, camera);
  };

  const tick = (now) => {
    frame = 0;
    render(now);
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const requestRender = () => {
    if (disposed) return;
    if (reducedMotion.matches) render();
    else if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else requestRender();
  };

  input.setRenderRequest(requestRender);
  addEventListener('resize', resize, { passive: true });
  addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', requestRender);
  resize();
  requestRender();

  return {
    renderer,
    scene,
    camera,
    field,
    quality,
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', requestRender);
      input.dispose();
      field.geometry.dispose();
      field.material.dispose();
      renderer.dispose();
    },
  };
}