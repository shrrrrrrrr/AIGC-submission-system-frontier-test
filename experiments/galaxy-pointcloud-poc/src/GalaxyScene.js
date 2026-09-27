import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { StarCloud } from './StarCloud.js';
import { NebulaCloud } from './NebulaCloud.js';
import { ForegroundDust } from './ForegroundDust.js';
import { residualVertex, residualFragment } from './shaders/index.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);
const layerFiles = ['bright', 'medium', 'dust'];
const nebulaFiles = ['front', 'mid', 'back'];

export class GalaxyScene {
  static async create(canvas) { const scene = new GalaxyScene(canvas); await scene.load(); return scene; }
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.debug.checkShaderErrors = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
    this.camera.position.set(0, 0, 58);
    this.lookTarget = new THREE.Vector3(0, 0, -22);
    this.baseCamera = new THREE.Vector3();
    this.baseTarget = new THREE.Vector3();
    this.targetCurrent = new THREE.Vector3();
    this.pointer = new THREE.Vector2();
    this.pointerCurrent = new THREE.Vector2();
    this.progress = 0;
    this.progressTarget = 0;
    this.params = {
      mode: 'hybrid', residual: 0.35, depthStrength: 1, thickness: 1, parallax: 1,
      starSize: 1, nebulaSize: 1, foregroundSize: 1, nebulaOpacity: 0.62, pointDensity: 1, bloom: true,
      bloomStrength: 0.42, morph: 0, flightSpeed: 1, starIntensity: 1,
      starLayers: { bright: 1, medium: 0.8, dust: 0.42 },
      nebulaVisibility: { front: 1, mid: 1, back: 1 },
      nebulaIntensity: { front: 0.75, mid: 1, back: 0.52 }, pointerX: 0, pointerY: 0, projectionScale: 1000, cameraProgress: 0
    };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0; this.lastFrame = performance.now(); this.fps = 0;
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize, { passive: true });
  }
  async load() {
    const metadata = await fetch('/galaxy/metadata.json').then((r) => r.json());
    this.metadata = metadata;
    const starBuffers = await Promise.all(layerFiles.map((layer) => fetch(`/galaxy/${metadata.stars.layers[layer].file}`).then((r) => r.arrayBuffer())));
    const nebulaBuffers = await Promise.all(nebulaFiles.map((layer) => fetch(`/galaxy/${metadata.nebula.layers[layer].file}`).then((r) => r.arrayBuffer())));
    this.stars = starBuffers.map((buffer, index) => new StarCloud(new Float32Array(buffer), metadata.stars.layers[layerFiles[index]].count, layerFiles[index], metadata.stars.layers[layerFiles[index]].stride));
    this.nebula = nebulaBuffers.map((buffer, index) => new NebulaCloud(new Float32Array(buffer), metadata.nebula.layers[nebulaFiles[index]].count, nebulaFiles[index], metadata.nebula.layers[nebulaFiles[index]].stride));
    this.scene.add(...this.stars.map((cloud) => cloud.points), ...this.nebula.map((cloud) => cloud.points));
    const foregroundBuffer = await fetch('/galaxy/foreground-dust.bin').then((r) => r.arrayBuffer());
    this.foreground = new ForegroundDust(new Float32Array(foregroundBuffer), metadata.foreground.count, metadata.foreground.stride);
    this.scene.add(this.foreground.points);
    const texture = await new THREE.TextureLoader().loadAsync('/galaxy/residual.webp');
    texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; this.residualTexture = texture;
    const plane = new THREE.PlaneGeometry(metadata.world.width, metadata.world.height);
    const material = new THREE.ShaderMaterial({ uniforms: { uTexture: { value: texture }, uOpacity: { value: this.params.residual } }, vertexShader: residualVertex, fragmentShader: residualFragment, transparent: true, depthWrite: false, depthTest: false });
    this.residual = new THREE.Mesh(plane, material); this.residual.position.set(0, 0, -96); this.scene.add(this.residual);
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.params.bloomStrength, 0.42, 1.0);
    this.outputPass = new OutputPass(); this.composer.addPass(this.renderPass); this.composer.addPass(this.bloomPass); this.composer.addPass(this.outputPass); this.resize();
  }
  setPointer(x, y) { this.pointer.set(clamp(x, -1, 1), clamp(y, -1, 1)); }
  setProgress(value) { this.progressTarget = clamp(value, 0, 1); }
  updateParams(next) {
    Object.assign(this.params, next);
    if (next.starLayers) this.params.starLayers = { ...this.params.starLayers, ...next.starLayers };
    if (next.nebulaVisibility) this.params.nebulaVisibility = { ...this.params.nebulaVisibility, ...next.nebulaVisibility };
    if (next.nebulaIntensity) this.params.nebulaIntensity = { ...this.params.nebulaIntensity, ...next.nebulaIntensity };
    if (this.bloomPass) this.bloomPass.strength = this.params.bloom ? this.params.bloomStrength : 0;
  }
  updateCamera(dt) {
    const motion = this.reducedMotion ? 0.3 : 1;
    this.progress = damp(this.progress, this.progressTarget, 3 + this.params.flightSpeed * 4, dt);
    this.pointerCurrent.x = damp(this.pointerCurrent.x, this.pointer.x, 5, dt);
    this.pointerCurrent.y = damp(this.pointerCurrent.y, this.pointer.y, 5, dt);
    const p = this.progress * motion;
    const cameraZ = THREE.MathUtils.lerp(58, 12, p);
    const targetZ = THREE.MathUtils.lerp(-22, -35, p);
    const distance = cameraZ - targetZ;
    const maxYawX = Math.tan(THREE.MathUtils.degToRad(8)) * distance;
    const maxPitchY = Math.tan(THREE.MathUtils.degToRad(5)) * distance;
    const flightSway = Math.sin(p * Math.PI) * 0.18;
    this.baseCamera.set(flightSway * maxYawX, Math.sin(p * Math.PI * 0.9) * maxPitchY * 0.12, cameraZ);
    this.baseTarget.set(flightSway * maxYawX * 0.25, 0, targetZ);
    this.targetCurrent.x = damp(this.targetCurrent.x, this.baseTarget.x, 4, dt);
    this.targetCurrent.y = damp(this.targetCurrent.y, this.baseTarget.y, 4, dt);
    this.targetCurrent.z = damp(this.targetCurrent.z, this.baseTarget.z, 4, dt);
    const px = this.pointerCurrent.x * maxYawX * 0.55 * this.params.parallax * motion;
    const py = this.pointerCurrent.y * maxPitchY * 0.55 * this.params.parallax * motion;
    this.camera.position.set(clamp(this.baseCamera.x + px, -maxYawX, maxYawX), clamp(this.baseCamera.y + py, -maxPitchY, maxPitchY), cameraZ);
    this.lookTarget.set(this.targetCurrent.x - this.pointerCurrent.x * maxYawX * 0.12 * motion, this.targetCurrent.y - this.pointerCurrent.y * maxPitchY * 0.12 * motion, this.targetCurrent.z);
    this.camera.lookAt(this.lookTarget);
    this.camera.rotation.z = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(1.2) * motion;
    this.params.pointerX = this.pointerCurrent.x; this.params.pointerY = this.pointerCurrent.y; this.params.cameraProgress = this.progress;
  }
  render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000)); this.lastFrame = now; this.time += dt;
    this.updateCamera(dt);
    const animationTime = this.reducedMotion ? 0 : this.time;
    const params = this.params;
    this.stars.forEach((cloud) => cloud.update(animationTime, params));
    this.nebula.forEach((cloud) => cloud.update(animationTime, params));
    this.foreground.update(animationTime, params);
    if (this.residual) this.residual.material.uniforms.uOpacity.value = params.mode === 'pointcloud' ? 0 : params.mode === 'original' ? 1 : params.residual;
    if (this.bloomPass) this.bloomPass.strength = params.bloom ? params.bloomStrength : 0;
    this.composer.render(); this.fps = damp(this.fps || 60, 1 / dt, 4, dt);
  }
  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.renderer.setSize(w, h, false);
    this.params.projectionScale = h * this.renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)));
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }
  debugInfo() {
    const stars = this.stars?.reduce((sum, cloud) => sum + cloud.count, 0) ?? 0;
    const nebula = this.nebula?.reduce((sum, cloud) => sum + cloud.count, 0) ?? 0;
    return { mode: this.params.mode, progress: this.progress, morph: clamp(this.params.morph + this.progress * 0.85, 0, 1), residual: this.residual?.material.uniforms.uOpacity.value ?? 0, stars, nebula, totalPoints: stars + nebula, fps: this.fps, calls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, foreground: this.foreground?.count ?? 0 };
  }
  dispose() {
    window.removeEventListener('resize', this._resize); this.stars?.forEach((cloud) => cloud.dispose()); this.nebula?.forEach((cloud) => cloud.dispose());
    this.foreground?.dispose();
    this.residual?.geometry.dispose(); this.residual?.material.dispose(); this.residualTexture?.dispose(); this.bloomPass?.dispose(); this.outputPass?.dispose(); this.composer?.dispose(); this.renderer.dispose();
  }
}
