import * as THREE from 'three';
import { StarCloud } from '../../galaxy-pointcloud-poc/src/StarCloud.js';
import { NebulaCloud } from '../../galaxy-pointcloud-poc/src/NebulaCloud.js';
import { ForegroundDust } from '../../galaxy-pointcloud-poc/src/ForegroundDust.js';
import approved from '../config/approved-visual.json';

export const assetUrl = (path) => new URL(`${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`, document.baseURI).href;
export async function readAsset(path, signal, binary = false) {
  const response = await fetch(assetUrl(path), { signal });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return binary ? response.arrayBuffer() : response.json();
}
const rad = THREE.MathUtils.degToRad;
export class GalaxyInstance {
  static async load(entry, signal) {
    const base = entry.directory;
    const metadata = await readAsset(`${base}/metadata.json`, signal);
    const specs = [metadata.stars.layers.bright, metadata.nebula.layers.mid, metadata.foreground];
    // Fetch only the three approved layers; no residual texture enters the WebGL scene.
    const buffers = await Promise.all(specs.map(s => readAsset(`${base}/${s.file}`, signal, true)));
    signal.throwIfAborted();
    return new GalaxyInstance(entry, metadata, specs, buffers);
  }
  constructor(entry, metadata, specs, buffers) {
    this.entry = entry; this.metadata = metadata;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#02030d');
    this.camera = new THREE.PerspectiveCamera(46, 1, .1, 240);
    this.clouds = [];
    try {
      this.clouds.push(new StarCloud(new Float32Array(buffers[0]), specs[0].count, 'bright', specs[0].stride));
      this.clouds.push(new NebulaCloud(new Float32Array(buffers[1]), specs[1].count, 'mid', specs[1].stride));
      this.clouds.push(new ForegroundDust(new Float32Array(buffers[2]), specs[2].count, specs[2].stride));
    } catch (error) { this.dispose(); throw error; }
    this.scene.add(...this.clouds.map(c => c.points));
    this.params = { ...structuredClone(approved), mode: 'pointcloud', foregroundSize: 1,
      // Existing cloud update() computes manual + cameraProgress*.85. Pin both inputs.
      morph: approved.manualMorph, cameraProgress: 1, pointerX: 0, pointerY: 0, projectionScale: 1 };
    const config = metadata.config?.camera || {};
    this.target = new THREE.Vector3(config.focalX || 0, config.focalY || 0, config.targetZEnd ?? -35);
    const dz = (config.endZ ?? 12) - this.target.z;
    const dy = Math.sin(Math.PI * .9) * Math.tan(rad(config.pitchDegrees ?? 5)) * dz * .12;
    this.radius = Math.hypot(dz, dy); this.basePitch = Math.atan2(dy, dz);
    this.localProgress = null; this.pitch = 0; this.yaw = 0;
    this.enabledPoints = specs.reduce((n, s) => n + s.count, 0);
    this.totalPoints = entry.pointCounts.total;
    this.densityRetainedPoints = specs[0].count + specs[2].count;
    const nebulaRaw = new Float32Array(buffers[1]);
    for (let i = 0; i < specs[1].count; i++) if (nebulaRaw[i * specs[1].stride + 9] <= approved.pointDensity) this.densityRetainedPoints++;
    this.bounds = this.measureComposition();
  }
  measureComposition() {
    // Match the actual vertex shader's image->volume morph and Z expansion.
    // Retain 98% of the mid-nebula composition, excluding only sparse outliers.
    const data = this.clouds[1].geometry.attributes.position;
    const xs = [], ys = [];
    for (let i = 0; i < data.count; i++) {
      const z = data.getZ(i), scale = 50 / Math.max(1, 28 - z);
      const xyScale = scale * (1 - approved.fixedMorph) + approved.fixedMorph;
      const finalZ = -22 + (z + 22) * approved.fixedMorph * approved.depthStrength;
      const distance = this.target.z + this.radius - finalZ;
      xs.push((data.getX(i) * xyScale - this.target.x) / distance);
      ys.push((data.getY(i) * xyScale - this.target.y) / distance);
    }
    xs.sort((a,b)=>a-b); ys.sort((a,b)=>a-b);
    const q = (a,p) => a[Math.floor((a.length - 1) * p)];
    return { left:q(xs,.01), right:q(xs,.99), bottom:q(ys,.01), top:q(ys,.99) };
  }
  resize(width, height, dpr) {
    const aspect = width / height, b = this.bounds;
    // Wider fixed layout framing. Orbiting the focus cancels most rigid camera rotation;
    // reserve a depth-parallax margin plus breathing, with no scroll-dependent zoom.
    this.scrollPitchMax = rad(2.1); this.pointerPitchMax = rad(1.6); this.pointerYawMax = rad(3.2);
    const safeX = Math.max(.04, Math.min(-b.left,b.right) - Math.tan(this.pointerYawMax) * .35 - .008);
    const safeY = Math.max(.04, Math.min(-b.bottom,b.top) - Math.tan(this.scrollPitchMax + this.pointerPitchMax + Math.abs(this.basePitch)) * .35 - .008);
    const tanHalf = Math.min(Math.tan(rad(23)), safeX / aspect / 1.06, safeY / 1.06);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.params.projectionScale = height * dpr / (2 * tanHalf);
    this.framing = { aspect, fov:this.camera.fov, overscan:1.06, radius:this.radius, safeX, safeY };
  }
  update(progress, pointer, dt, time, reducedMotion) {
    if (this.localProgress === null || reducedMotion) this.localProgress = progress;
    else this.localProgress = THREE.MathUtils.damp(this.localProgress, progress, 6, dt);
    this.pitch = this.basePitch + (reducedMotion ? 0 : (this.localProgress * 2 - 1) * this.scrollPitchMax + pointer.y * this.pointerPitchMax);
    this.yaw = reducedMotion ? 0 : pointer.x * this.pointerYawMax;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw)*cp*this.radius, this.target.y + Math.sin(this.pitch)*this.radius, this.target.z + Math.cos(this.yaw)*cp*this.radius);
    this.camera.lookAt(this.target); // No roll, no distance interpolation, no group transforms.
    for (const cloud of this.clouds) cloud.update(reducedMotion ? 0 : time, this.params);
  }
  debug() {
    return { id:this.entry.assetId, totalPoints:this.totalPoints, enabledPoints:this.enabledPoints, submittedPoints:this.enabledPoints,
      densityRetainedPoints:this.densityRetainedPoints, morph:this.clouds[1].material.uniforms.uMorph.value,
      radius:this.camera.position.distanceTo(this.target), pitch:THREE.MathUtils.radToDeg(this.pitch), yaw:THREE.MathUtils.radToDeg(this.yaw), framing:this.framing };
  }
  dispose() { for (const cloud of this.clouds) cloud.dispose(); this.clouds.length = 0; }
}
