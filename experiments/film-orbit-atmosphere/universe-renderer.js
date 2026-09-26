import * as THREE from 'three';
import { createParticleField, getParticleQuality, updateParticleField } from './universe-particles.js';
import { sceneDescriptors } from './universe-descriptors.js';
import { createSceneTimeline } from './universe-timeline.js';
import { createTransitionPass } from './universe-transition.js';
import { createUniverseLighting } from './universe-lighting.js';
import { createUniversePost } from './universe-post.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, progress) => a + (b - a) * progress;

function prepareDescriptors() {
  return sceneDescriptors.map((item) => ({
    ...item,
    fogColorValue: new THREE.Color(item.fogColor),
    particleTintValue: new THREE.Color(item.particleTint),
    atmosphereColorAValue: new THREE.Color(item.atmosphereColorA),
    atmosphereColorBValue: new THREE.Color(item.atmosphereColorB),
    lightTintAValue: new THREE.Color(item.lightTintA),
    lightTintBValue: new THREE.Color(item.lightTintB),
  }));
}

function createTextureCache(onReady = () => {}) {
  const loader = new THREE.TextureLoader();
  const promises = new Map();
  const textures = new Map();
  const fallbackData = new Uint8Array([3, 9, 21, 255]);
  const fallback = new THREE.DataTexture(fallbackData, 1, 1, THREE.RGBAFormat);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;

  function ensure(url) {
    if (promises.has(url)) return promises.get(url);
    const promise = new Promise((resolve) => {
      loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        textures.set(url, texture);
        onReady();
        resolve(texture);
      }, undefined, (error) => {
        console.warn('[universe] texture fallback', url, error);
        textures.set(url, fallback);
        onReady();
        resolve(fallback);
      });
    });
    promises.set(url, promise);
    return promise;
  }

  return {
    fallback,
    ensure,
    get(url) { return textures.get(url) || fallback; },
    dispose() {
      textures.forEach((texture) => { if (texture !== fallback) texture.dispose(); });
      fallback.dispose();
      textures.clear();
      promises.clear();
    },
  };
}

function blendVisualState(a, b, progress, state) {
  state.cameraPosition.x = lerp(a.cameraPosition.x, b.cameraPosition.x, progress);
  state.cameraPosition.y = lerp(a.cameraPosition.y, b.cameraPosition.y, progress);
  state.cameraPosition.z = lerp(a.cameraPosition.z, b.cameraPosition.z, progress);
  state.cameraTarget.x = lerp(a.cameraTarget.x, b.cameraTarget.x, progress);
  state.cameraTarget.y = lerp(a.cameraTarget.y, b.cameraTarget.y, progress);
  state.cameraTarget.z = lerp(a.cameraTarget.z, b.cameraTarget.z, progress);
  state.fogColor.copy(a.fogColorValue).lerp(b.fogColorValue, progress);
  state.particleTint.copy(a.particleTintValue).lerp(b.particleTintValue, progress);
  state.particleIntensity = lerp(a.particleIntensity, b.particleIntensity, progress);
  state.fogNear = lerp(a.fogNear, b.fogNear, progress);
  state.fogFar = lerp(a.fogFar, b.fogFar, progress);
  state.atmosphereStrength = lerp(a.atmosphereStrength, b.atmosphereStrength, progress);
  state.bloomStrength = lerp(a.bloomStrength, b.bloomStrength, progress);
  state.exposure = lerp(a.exposure, b.exposure, progress);
}

export function createUniverseRenderer({ sceneRoot, sections, input, reducedMotion }) {
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));

  const prepared = prepareDescriptors();
  const timeline = createSceneTimeline(sections, prepared);
  const textureCache = createTextureCache(() => requestRender());
  const textureUrl = (name) => new URL('./assets/universe/' + name, import.meta.url).href;
  prepared.forEach((item) => { item.textureUrl = textureUrl(item.backgroundTexture); });

  const particleScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
  const fieldGroup = new THREE.Group();
  const field = createParticleField({ quality });
  fieldGroup.add(field.points);
  const lighting = createUniverseLighting();
  fieldGroup.add(lighting.group);
  particleScene.add(fieldGroup);

  const backgroundScene = new THREE.Scene();
  const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const backgroundMaterial = new THREE.MeshBasicMaterial({ map: textureCache.fallback, depthTest: false, depthWrite: false });
  const backgroundQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
  backgroundScene.add(backgroundQuad);

  const hdr = !quality.mobile && !quality.reducedMotion;
  const targetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false };
  const targetA = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  const targetB = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  targetA.texture.name = 'universe-scene-a';
  targetB.texture.name = 'universe-scene-b';

  const transition = createTransitionPass();
  const post = createUniversePost(renderer, transition, hdr);
  const visual = {
    cameraPosition: { x: 0, y: 0, z: 26 },
    cameraTarget: { x: 0, y: 0, z: -20 },
    fogColor: new THREE.Color(),
    particleTint: new THREE.Color(),
    particleIntensity: 1,
    fogNear: 16,
    fogFar: 90,
    atmosphereStrength: 1,
    bloomStrength: 0.5,
    exposure: 1,
  };
  const pointer = { x: 0, y: 0 };
  const cameraEndpoint = { x: 0, y: 0, z: 26 };
  const targetEndpoint = { x: 0, y: 0, z: -20 };

  let width = 1;
  let height = 1;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
  let frame = 0;
  let lastTime = performance.now();
  let disposed = false;
  let elapsed = 0;
  let layoutObserver = null;

  const applyCamera = (state, motion) => {
    cameraEndpoint.x = state.cameraPosition.x + input.current.pointerX * 1.25 * motion;
    cameraEndpoint.y = state.cameraPosition.y - input.current.pointerY * 0.75 * motion;
    cameraEndpoint.z = state.cameraPosition.z - input.current.scrollVelocity * 0.08 * motion;
    targetEndpoint.x = state.cameraTarget.x + input.current.pointerX * 0.18 * motion;
    targetEndpoint.y = state.cameraTarget.y - input.current.pointerY * 0.12 * motion;
    targetEndpoint.z = state.cameraTarget.z;
    camera.position.set(cameraEndpoint.x, cameraEndpoint.y, cameraEndpoint.z);
    camera.lookAt(targetEndpoint.x, targetEndpoint.y, targetEndpoint.z);
  };

  const renderSceneState = (target, descriptor, motion) => {
    const texture = textureCache.get(descriptor.textureUrl);
    if (backgroundMaterial.map !== texture) {
      backgroundMaterial.map = texture;
      backgroundMaterial.needsUpdate = true;
    }
    applyCamera(descriptor, motion);
    lighting.update(descriptor, elapsed, motion);
    updateParticleField(field, { elapsed, input, pixelRatio, visual: {
      fogColor: descriptor.fogColorValue,
      fogNear: descriptor.fogNear,
      fogFar: descriptor.fogFar,
      particleTint: descriptor.particleTintValue,
      particleIntensity: descriptor.particleIntensity,
    }});
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x030915, 1);
    renderer.clear(true, true, true);
    renderer.render(backgroundScene, backgroundCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(particleScene, camera);
    renderer.autoClear = true;
  };

  const resize = () => {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const targetWidth = Math.max(1, Math.round(width * pixelRatio));
    const targetHeight = Math.max(1, Math.round(height * pixelRatio));
    targetA.setSize(targetWidth, targetHeight);
    targetB.setSize(targetWidth, targetHeight);
    post.resize(width, height, pixelRatio, quality.mobile, reducedMotion.matches);
    timeline.rebuild();
    requestRender();
  };

  const render = (now = performance.now()) => {
    if (disposed) return;
    const deltaSeconds = Math.min(0.064, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += deltaSeconds;
    input.step(deltaSeconds);
    const motion = reducedMotion.matches ? 0.28 : 1;
    const resolved = timeline.resolve(input.current.scrollY);
    const descriptorA = prepared[resolved.a] || prepared[0];
    const descriptorB = prepared[resolved.b] || descriptorA;
    textureCache.ensure(descriptorA.textureUrl);
    textureCache.ensure(descriptorB.textureUrl);
    const progress = resolved.a === resolved.b ? 0 : resolved.progress;

    blendVisualState(descriptorA, descriptorB, progress, visual);
    const scrollVelocity = clamp(input.current.scrollVelocity, -2.5, 2.5);
    const direction = scrollVelocity < 0 ? -1 : 1;
    pointer.x = input.current.pointerX;
    pointer.y = input.current.pointerY;

    fieldGroup.rotation.y += ((pointer.x * 0.045 + (input.current.scroll - 0.5) * 0.08) * motion - fieldGroup.rotation.y) * (1 - Math.exp(-2.6 * deltaSeconds));
    fieldGroup.rotation.x += ((pointer.y * 0.025 + Math.cos(input.current.scroll * Math.PI * 2) * 0.025 * motion) - fieldGroup.rotation.x) * (1 - Math.exp(-2.6 * deltaSeconds));
    fieldGroup.position.z += ((scrollVelocity * 0.16 * motion) - fieldGroup.position.z) * (1 - Math.exp(-5.5 * deltaSeconds));
    field.material.uniforms.uMotion.value = motion;

    renderSceneState(targetA, descriptorA, motion);
    renderSceneState(targetB, descriptorB, motion);

    transition.material.uniforms.tSceneA.value = targetA.texture;
    transition.material.uniforms.tSceneB.value = targetB.texture;
    transition.material.uniforms.uProgress.value = progress;
    transition.material.uniforms.uRawProgress.value = resolved.rawProgress;
    transition.material.uniforms.uVelocity.value = scrollVelocity;
    transition.material.uniforms.uDirection.value = direction;
    transition.material.uniforms.uPointer.value.set(pointer.x, pointer.y);
    transition.material.uniforms.uDisplacement.value = reducedMotion.matches ? 0.004 : 0.018;
    transition.material.uniforms.uSoftness.value = reducedMotion.matches ? 0.13 : 0.08;
    transition.material.uniforms.uAtmosphereA.value.set(descriptorA.atmosphereColorAValue);
    transition.material.uniforms.uAtmosphereB.value.set(descriptorB.atmosphereColorBValue);
    transition.material.uniforms.uAtmosphereStrength.value = visual.atmosphereStrength;

    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    post.render(visual, deltaSeconds, reducedMotion.matches);
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

  const onLayoutChange = () => {
    timeline.rebuild();
    requestRender();
  };

  const onReducedMotionChange = () => {
    post.resize(width, height, pixelRatio, quality.mobile, reducedMotion.matches);
    requestRender();
  };

  input.setRenderRequest(requestRender);
  addEventListener('resize', resize, { passive: true });
  addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', onReducedMotionChange);
  if ('ResizeObserver' in window) {
    layoutObserver = new ResizeObserver(onLayoutChange);
    layoutObserver.observe(document.querySelector('main'));
  }
  textureCache.ensure(prepared[0].textureUrl);
  textureCache.ensure(prepared[1].textureUrl);
  resize();
  if (import.meta.env?.DEV) window.__universeDebug = { timeline, targetA, targetB, transition, post, renderer, lighting, get progress() { return timeline.resolve(input.current.scrollY); } };
  requestRender();

  return {
    renderer,
    camera,
    field,
    targetA,
    targetB,
    timeline,
    quality,
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onReducedMotionChange);
      layoutObserver?.disconnect();
      input.dispose();
      targetA.dispose();
      targetB.dispose();
      backgroundQuad.geometry.dispose();
      backgroundMaterial.dispose();
      transition.geometry.dispose();
      transition.material.dispose();
      field.geometry.dispose();
      field.material.dispose();
      lighting.dispose();
      post.dispose();
      textureCache.dispose();
      renderer.dispose();
    },
  };
}
