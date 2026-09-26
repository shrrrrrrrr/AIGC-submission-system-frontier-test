import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { StarCloud } from './StarCloud.js';
import { NebulaCloud } from './NebulaCloud.js';
import { residualVertex, residualFragment } from './shaders/index.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);

export class GalaxyScene {
  static async create(canvas) {
    const scene = new GalaxyScene(canvas);
    await scene.load();
    return scene;
  }
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
    this.camera.position.set(0, 0, 28);
    this.cameraTarget = new THREE.Vector3(0, 0, -35);
    this.lookTarget = new THREE.Vector3();
    this.baseCamera = new THREE.Vector3();
    this.baseTarget = new THREE.Vector3();
    this.pointer = new THREE.Vector2();
    this.pointerCurrent = new THREE.Vector2();
    this.progress = 0;
    this.progressTarget = 0;
    this.params = { mode: 'hybrid', residual: 0.35, depthStrength: 1, thickness: 1, parallax: 1, starSize: 1, nebulaSize: 1, nebulaOpacity: 0.62, bloom: true, bloomStrength: 0.42, pointDensity: 1, projectionScale: 1000 };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.lastFrame = performance.now();
    this.fps = 0;
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize, { passive: true });
  }
  async load() {
    const [metadata, starsBuffer, nebulaBuffer] = await Promise.all([
      fetch('/galaxy/metadata.json').then((r) => r.json()),
      fetch('/galaxy/stars.bin').then((r) => r.arrayBuffer()),
      fetch('/galaxy/nebula.bin').then((r) => r.arrayBuffer())
    ]);
    this.metadata = metadata;
    this.stars = new StarCloud(new Float32Array(starsBuffer), metadata.stars.count, metadata.stars.stride);
    this.nebula = new NebulaCloud(new Float32Array(nebulaBuffer), metadata.nebula.count, metadata.nebula.stride);
    this.scene.add(this.stars.points, this.nebula.points);
    const texture = await new THREE.TextureLoader().loadAsync('/galaxy/residual.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    this.residualTexture = texture;
    const aspect = metadata.source.aspect;
    const h = metadata.world.height;
    const plane = new THREE.PlaneGeometry(metadata.world.width, h);
    const material = new THREE.ShaderMaterial({ uniforms: { uTexture: { value: texture }, uOpacity: { value: this.params.residual } }, vertexShader: residualVertex, fragmentShader: residualFragment, transparent: true, depthWrite: false, depthTest: false });
    this.residual = new THREE.Mesh(plane, material);
    this.residual.position.set(0, 0, -78);
    this.residual.scale.setScalar(2.1);
    this.residual.material.uniforms.uTexture.value = texture;
    this.scene.add(this.residual);
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.params.bloomStrength, 0.42, 0.88);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.resize();
  }
  setPointer(x, y) { this.pointer.set(clamp(x, -1, 1), clamp(y, -1, 1)); }
  setProgress(value) { this.progressTarget = clamp(value, 0, 1); }
  updateParams(next) {
    Object.assign(this.params, next);
    if (this.bloomPass) this.bloomPass.strength = this.params.bloom ? this.params.bloomStrength : 0;
    if (this.residual) this.residual.material.uniforms.uOpacity.value = this.params.mode === 'pointcloud' ? 0 : this.params.mode === 'original' ? 1 : this.params.residual;
  }
  updateCamera(dt) {
    const motion = this.reducedMotion ? 0.35 : 1;
    this.progress = damp(this.progress, this.progressTarget, 6, dt);
    this.pointerCurrent.x = damp(this.pointerCurrent.x, this.pointer.x, 5, dt);
    this.pointerCurrent.y = damp(this.pointerCurrent.y, this.pointer.y, 5, dt);
    const travel = this.progress;
    this.baseCamera.set(travel * 2.2 * motion, travel * 1.2 * motion, 28 + travel * 2.6);
    this.baseTarget.set(travel * -1.2 * motion, travel * 0.8, -22 + travel * 3.5);
    const px = this.pointerCurrent.x * 1.9 * this.params.parallax * motion;
    const py = this.pointerCurrent.y * 1.3 * this.params.parallax * motion;
    this.camera.position.x = this.baseCamera.x + px;
    this.camera.position.y = this.baseCamera.y + py;
    this.camera.position.z = this.baseCamera.z;
    this.lookTarget.set(this.baseTarget.x - this.pointerCurrent.x * 1.4 * motion, this.baseTarget.y - this.pointerCurrent.y * 0.8 * motion, this.baseTarget.z);
    this.camera.lookAt(this.lookTarget);
  }
  render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.updateCamera(dt);
    const animationTime = this.reducedMotion ? 0 : this.time;
    this.stars.update(animationTime, this.params);
    this.nebula.update(animationTime, this.params);
    if (this.residual) this.residual.material.uniforms.uOpacity.value = this.params.mode === 'pointcloud' ? 0 : this.params.mode === 'original' ? 1 : this.params.residual;
    if (this.bloomPass) this.bloomPass.strength = this.params.bloom ? this.params.bloomStrength : 0;
    this.composer.render();
    this.fps = damp(this.fps || 60, 1 / dt, 4, dt);
  }
  resize() {
    const w = Math.max(1, window.innerWidth); const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.params.projectionScale = h * this.renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)));
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }
  debugInfo() { return { mode: this.params.mode, progress: this.progress, residual: this.residual?.material.uniforms.uOpacity.value ?? 0, stars: this.stars?.count ?? 0, nebula: this.nebula?.count ?? 0, fps: this.fps, calls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures }; }
  dispose() {
    window.removeEventListener('resize', this._resize);
    this.stars?.dispose(); this.nebula?.dispose();
    this.residual?.geometry.dispose(); this.residual?.material.dispose(); this.residualTexture?.dispose();
    this.bloomPass?.dispose(); this.outputPass?.dispose(); this.composer?.dispose(); this.renderer.dispose();
  }
}
