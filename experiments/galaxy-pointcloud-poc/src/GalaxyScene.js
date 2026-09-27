import { GalaxyInstance } from '../../galaxy-homepage/src/GalaxyInstance.js';
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
const DEFAULT_PARAMS = {
  mode: 'hybrid', residual: 0.35, depthStrength: 1, thickness: 1, parallax: 1,
  starSize: 1, nebulaSize: 1, foregroundSize: 1, nebulaOpacity: 0.62, pointDensity: 1, bloom: true,
  bloomStrength: 0.42, morph: 0, flightSpeed: 1, starIntensity: 1, foregroundCleanup: 0.7, foregroundSoftness: 1,
  foregroundVisibility: 1, residualVisible: 1,
  starLayers: { bright: 1, medium: 0.8, dust: 0.42 },
  scrollPitchDegrees: 6, pointerYawDegrees: 5, pointerPitchDegrees: 3, followSpeed: 6, safeOverscan: 1.12,
  starVisibility: { bright: 1, medium: 1, dust: 1 },
  nebulaVisibility: { front: 1, mid: 1, back: 1 },
  nebulaIntensity: { front: 0.55, mid: 1, back: 0.52 },
  pointerX: 0, pointerY: 0, projectionScale: 1000, cameraProgress: 0
};

const cloneParams = (source) => ({
  ...DEFAULT_PARAMS, ...source,
  starLayers: { ...DEFAULT_PARAMS.starLayers, ...(source?.starLayers || {}) },
  starVisibility: { ...DEFAULT_PARAMS.starVisibility, ...(source?.starVisibility || {}) },
  nebulaVisibility: { ...DEFAULT_PARAMS.nebulaVisibility, ...(source?.nebulaVisibility || {}) },
  nebulaIntensity: { ...DEFAULT_PARAMS.nebulaIntensity, ...(source?.nebulaIntensity || {}) }
});

async function responseJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
  return response.json();
}

async function responseBuffer(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
  return response.arrayBuffer();
}

export class GalaxyScene {
  static async create(canvas) {
    const scene = new GalaxyScene(canvas);
    await scene.initialize();
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
    this.camera.position.set(0, 0, 58);
    this.lookTarget = new THREE.Vector3(0, 0, -22);
    this.baseCamera = new THREE.Vector3();
    this.baseTarget = new THREE.Vector3();
    this.targetCurrent = new THREE.Vector3();
    this.pointer = new THREE.Vector2();
    this.pointerCurrent = new THREE.Vector2();
    this.progress = 0;
    this.progressTarget = 0; this.previewMode='presentation';
    this.params = cloneParams({});
    this.manifest = null;
    this.assetId = null;
    this.assetConfig = {};
    this.metadata = null;
    this.loading = false;
    this.loadToken = 0;
    this.onStateChange = () => {};
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.lastFrame = performance.now();
    this.fps = 0;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.params.bloomStrength, 0.42, 1.0);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize, { passive: true });
  }

  async initialize() {
    this.manifest = await responseJson('/galaxies/manifest.json');
    await this.switchAsset(this.manifest.defaultAsset || 'galaxy-a');
  }

  assetEntry(assetId) {
    return this.manifest?.assets?.find((asset) => asset.assetId === assetId) || null;
  }

  assetBase(entry) {
    return entry.directory.startsWith('/') ? entry.directory : `/${entry.directory}`;
  }

  async loadAssetBundle(entry) {
    const base = this.assetBase(entry);
    const metadata = await responseJson(`${base}/metadata.json`);
    const starBuffers = await Promise.all(layerFiles.map((layer) => responseBuffer(`${base}/${metadata.stars.layers[layer].file}`)));
    const nebulaBuffers = await Promise.all(nebulaFiles.map((layer) => responseBuffer(`${base}/${metadata.nebula.layers[layer].file}`)));
    const foregroundBuffer = await responseBuffer(`${base}/${metadata.foreground.file}`);
    const texture = await new THREE.TextureLoader().loadAsync(`${base}/${metadata.residual.file}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    let preset = null; let revision = null;
    try {
      if(!import.meta.env.DEV) throw new Error('静态构建使用随包预设');
      const response = await fetch(`/__galaxy/config/${entry.assetId}`, { cache: 'no-store' });
      if (response.ok) { const payload = await response.json(); preset = payload.preset; revision = payload.revision; }
    } catch (error) { console.warn(`本地预设服务不可用，将读取静态预设：${error.message}`); }
    if (!preset && entry.preset) {
      try { preset = await responseJson(entry.preset); } catch (error) { console.warn(`无法读取 ${entry.assetId} 的静态预设`, error); }
    }
    return {
      entry,
      metadata,
      config: metadata.config || {},
      texture,
      stars: starBuffers.map((buffer, index) => new StarCloud(new Float32Array(buffer), metadata.stars.layers[layerFiles[index]].count, layerFiles[index], metadata.stars.layers[layerFiles[index]].stride)),
      nebula: nebulaBuffers.map((buffer, index) => new NebulaCloud(new Float32Array(buffer), metadata.nebula.layers[nebulaFiles[index]].count, nebulaFiles[index], metadata.nebula.layers[nebulaFiles[index]].stride)),
      foreground: new ForegroundDust(new Float32Array(foregroundBuffer), metadata.foreground.count, metadata.foreground.stride),
      preset, revision
    };
  }

  disposeBundle(bundle) {
    bundle?.stars?.forEach((cloud) => cloud.dispose());
    bundle?.nebula?.forEach((cloud) => cloud.dispose());
    bundle?.foreground?.dispose();
    bundle?.texture?.dispose();
  }

  disposeCurrentAsset() {
    this.stars?.forEach((cloud) => { this.scene.remove(cloud.points); cloud.dispose(); });
    this.nebula?.forEach((cloud) => { this.scene.remove(cloud.points); cloud.dispose(); });
    if (this.foreground) { this.scene.remove(this.foreground.points); this.foreground.dispose(); }
    if (this.residual) { this.scene.remove(this.residual); this.residual.geometry.dispose(); this.residual.material.dispose(); }
    this.residualTexture?.dispose();
    this.stars = null;
    this.nebula = null;
    this.foreground = null;
    this.residual = null;
    this.residualTexture = null;
  }

  attachBundle(bundle) {
    this.disposeCurrentAsset();
    this.metadata = bundle.metadata;
    this.assetId = bundle.entry.assetId;
    this.assetConfig = bundle.config || {};
    this.revision = bundle.revision || this.revision || null;
    this.stars = bundle.stars;
    this.nebula = bundle.nebula;
    this.foreground = bundle.foreground;
    this.scene.add(...this.stars.map((cloud) => cloud.points), ...this.nebula.map((cloud) => cloud.points), this.foreground.points);
    this.residualTexture = bundle.texture;
    const plane = new THREE.PlaneGeometry(this.metadata.world.width, this.metadata.world.height);
    const material = new THREE.ShaderMaterial({ uniforms: { uTexture: { value: bundle.texture }, uOpacity: { value: this.params.residual } }, vertexShader: residualVertex, fragmentShader: residualFragment, transparent: true, depthWrite: false, depthTest: false });
    this.residual = new THREE.Mesh(plane, material);
    this.residual.position.set(0, 0, -96);
    this.scene.add(this.residual);
  }

  async switchAsset(assetId) {
    const entry = this.assetEntry(assetId);
    if (!entry || assetId === this.assetId && !this.loading) return false;
    const token = ++this.loadToken;
    this.loading = true;
    this.onStateChange({ loading: true, assetId, entry });
    try {
      const bundle = await this.loadAssetBundle(entry);
      if (token !== this.loadToken) { this.disposeBundle(bundle); return false; }
      this.attachBundle(bundle);
      this.applyPreset(bundle.preset || entry.defaultPreset || {}, false, bundle.revision);
      this.loading = false;
      this.resize();
      this.onStateChange({ loading: false, assetId: this.assetId, entry, preset: bundle.preset });
      return true;
    } catch (error) {
      if (token === this.loadToken) {
        this.loading = false;
        this.onStateChange({ loading: false, assetId, entry, error });
        console.error(error);
      }
      return false;
    }
  }

  applyPreset(preset, emit = true, revision = this.revision) {
    this.params = cloneParams(preset || {});
    this.revision = revision || this.revision;
    this.progressTarget = clamp(Number(preset?.previewProgress ?? 0), 0, 1);
    this.progress = this.progressTarget;
    this.configurePresentation();
    this.targetCurrent.set(0, 0, 0);
    if (emit) this.onStateChange({ loading: false, assetId: this.assetId, preset });
  }

  configurePresentation() {
    if(!this.nebula) return;
    const config=this.assetConfig.camera||{};
    const target=new THREE.Vector3(config.focalX||0,config.focalY||0,config.targetZEnd??-35);
    const dz=(config.endZ??12)-target.z;
    const dy=Math.sin(Math.PI*.9)*Math.tan(THREE.MathUtils.degToRad(config.pitchDegrees??5))*dz*.12;
    this.presentation={camera:this.camera,clouds:[this.stars[0],this.nebula[1],this.foreground],params:this.params,target,radius:Math.hypot(dz,dy),basePitch:Math.atan2(dy,dz),localProgress:null,measureComposition:GalaxyInstance.prototype.measureComposition};
    this.presentation.bounds=this.presentation.measureComposition();
    GalaxyInstance.prototype.resize.call(this.presentation,innerWidth,innerHeight,this.renderer.getPixelRatio());
  }

  setPointer(x, y) { this.pointer.set(clamp(x, -1, 1), clamp(y, -1, 1)); }
  setProgress(value) { this.progressTarget = clamp(value, 0, 1); }

  getPresetForSave() {
    const preset = structuredClone(this.params);
    delete preset.pointerX; delete preset.pointerY; delete preset.projectionScale; delete preset.cameraProgress;
    preset.assetId = this.assetId; preset.previewProgress = this.progressTarget;
    return preset;
  }

  async refreshRemotePreset() {
    if (!this.assetId) return false;
    const response = await fetch(`/__galaxy/config/${this.assetId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取预设失败：HTTP ${response.status}`);
    const payload = await response.json();
    this.applyPreset(payload.preset, true, payload.revision);
    return true;
  }

  updateParams(next) {
    const merged={...this.params,...next};
    for(const key of ['starLayers','starVisibility','nebulaVisibility','nebulaIntensity']) merged[key]={...this.params[key],...(next[key]||{})};
    this.params=cloneParams(merged);
    if(this.presentation) {this.presentation.params=this.params;this.presentation.bounds=this.presentation.measureComposition();GalaxyInstance.prototype.resize.call(this.presentation,innerWidth,innerHeight,this.renderer.getPixelRatio());}
  }

  updateCamera(dt) {
    if(this.previewMode==='presentation' && this.presentation) {
      this.pointerCurrent.lerp(this.pointer,1-Math.exp(-(this.params.followSpeed??6)*dt));
      this.presentation.params=this.params;
      this.presentation.params.cameraProgress=1;
      this.presentation.params.pointerX=this.pointerCurrent.x;
      this.presentation.params.pointerY=this.pointerCurrent.y;
      GalaxyInstance.prototype.update.call(this.presentation,this.progressTarget,this.pointerCurrent,dt,this.time,this.reducedMotion);
      this.progress=this.presentation.localProgress;this.params.cameraProgress=1;this.params.pointerX=0;this.params.pointerY=0;
      return;
    }
    const motion = this.reducedMotion ? 0.3 : 1;
    const followSpeed = clamp(Number(this.params.followSpeed ?? 6), 2, 14);
    this.progress = damp(this.progress, this.progressTarget, 3 + this.params.flightSpeed * 4, dt);
    this.pointerCurrent.x = damp(this.pointerCurrent.x, this.pointer.x, followSpeed, dt);
    this.pointerCurrent.y = damp(this.pointerCurrent.y, this.pointer.y, followSpeed, dt);
    const p = this.progress * motion;
    const cameraConfig = this.assetConfig.camera || {};
    const cameraZ = THREE.MathUtils.lerp(cameraConfig.startZ ?? 58, cameraConfig.endZ ?? 12, p);
    const targetZ = THREE.MathUtils.lerp(cameraConfig.targetZStart ?? -22, cameraConfig.targetZEnd ?? -35, p);
    const distance = cameraZ - targetZ;
    const maxYawX = Math.tan(THREE.MathUtils.degToRad(cameraConfig.yawDegrees ?? 8)) * distance;
    const maxPitchY = Math.tan(THREE.MathUtils.degToRad(cameraConfig.pitchDegrees ?? 5)) * distance;
    const flightSway = Math.sin(p * Math.PI) * 0.18;
    const focalX = cameraConfig.focalX ?? 0;
    const focalY = cameraConfig.focalY ?? 0;
    this.baseCamera.set(focalX + flightSway * maxYawX, focalY + Math.sin(p * Math.PI * 0.9) * maxPitchY * 0.12, cameraZ);
    this.baseTarget.set(focalX + flightSway * maxYawX * 0.25, focalY, targetZ);
    this.targetCurrent.x = damp(this.targetCurrent.x, this.baseTarget.x, 4, dt);
    this.targetCurrent.y = damp(this.targetCurrent.y, this.baseTarget.y, 4, dt);
    this.targetCurrent.z = damp(this.targetCurrent.z, this.baseTarget.z, 4, dt);
    const pointerYaw = THREE.MathUtils.degToRad(clamp(Number(this.params.pointerYawDegrees ?? 5), 0, 7)) * this.params.parallax;
    const pointerPitch = THREE.MathUtils.degToRad(clamp(Number(this.params.pointerPitchDegrees ?? 3), 0, 4)) * this.params.parallax;
    const px = this.pointerCurrent.x * Math.tan(Math.min(pointerYaw, THREE.MathUtils.degToRad(cameraConfig.yawDegrees ?? 8))) * distance * motion;
    const py = this.pointerCurrent.y * Math.tan(Math.min(pointerPitch, THREE.MathUtils.degToRad(cameraConfig.pitchDegrees ?? 5))) * distance * motion;
    this.camera.position.set(clamp(this.baseCamera.x + px, focalX - maxYawX, focalX + maxYawX), clamp(this.baseCamera.y + py, focalY - maxPitchY, focalY + maxPitchY), cameraZ);
    this.lookTarget.set(this.targetCurrent.x - this.pointerCurrent.x * maxYawX * 0.12 * motion, this.targetCurrent.y - this.pointerCurrent.y * maxPitchY * 0.12 * motion, this.targetCurrent.z);
    this.camera.lookAt(this.lookTarget);
    this.camera.rotation.z = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(1.2) * motion;
    this.params.pointerX = this.pointerCurrent.x;
    this.params.pointerY = this.pointerCurrent.y;
    this.params.cameraProgress = this.progress;
  }

  render(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.updateCamera(dt);
    const animationTime = this.reducedMotion ? 0 : this.time;
    const params = this.params;
    this.stars?.forEach((cloud) => cloud.update(animationTime, params));
    this.nebula?.forEach((cloud) => cloud.update(animationTime, params));
    this.foreground?.update(animationTime, params);
    if (this.residual) this.residual.material.uniforms.uOpacity.value = params.residualVisible && params.mode !== 'pointcloud' ? (params.mode === 'original' ? 1 : params.residual) : 0;
    if (this.bloomPass) this.bloomPass.strength = params.bloom ? params.bloomStrength : 0;
    this.composer.render();
    this.fps = damp(this.fps || 60, 1 / dt, 4, dt);
  }

  resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    if(this.previewMode==='presentation' && this.presentation) {GalaxyInstance.prototype.resize.call(this.presentation,w,h,this.renderer.getPixelRatio());}
    this.params.projectionScale = h * this.renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  debugInfo() {
    const stars = this.stars?.reduce((sum, cloud) => sum + cloud.count, 0) ?? 0;
    const nebula = this.nebula?.reduce((sum, cloud) => sum + cloud.count, 0) ?? 0;
    const foreground = this.foreground?.count ?? 0;
    return { assetId: this.assetId, revision: this.revision, loading: this.loading, mode: this.params.mode, progress: this.progress, morph: clamp(this.params.morph + this.progress * 0.85, 0, 1), residual: this.residual?.material.uniforms.uOpacity.value ?? 0, stars, nebula, foreground, totalPoints: stars + nebula + foreground, fps: this.fps, calls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures };
  }

  dispose() {
    window.removeEventListener('resize', this._resize);
    this.disposeCurrentAsset();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
