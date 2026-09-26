import * as THREE from 'three';
import { nebulaVertex, nebulaFragment } from './shaders/index.js';

export class NebulaCloud {
  constructor(data, count, stride = 10) {
    this.count = count;
    const geometry = new THREE.BufferGeometry();
    const position = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const alpha = new Float32Array(count);
    const density = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const o = i * stride;
      position.set(data.subarray(o, o + 3), i * 3);
      size[i] = data[o + 3];
      color.set(data.subarray(o + 4, o + 7), i * 3);
      alpha[i] = data[o + 7];
      density[i] = data[o + 8];
      seed[i] = data[o + 9];
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geometry.setAttribute('aDensity', new THREE.BufferAttribute(density, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uProjectionScale: { value: 1000 }, uTime: { value: 0 }, uDepthStrength: { value: 1 }, uSize: { value: 1 }, uThickness: { value: 1 }, uDensity: { value: 1 }, uOpacity: { value: 0.62 }, uPointDensity: { value: 1 } },
      vertexShader: nebulaVertex,
      fragmentShader: nebulaFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.material = material;
    this.geometry = geometry;
  }
  update(time, params) {
    this.material.uniforms.uProjectionScale.value = params.projectionScale;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uDepthStrength.value = params.depthStrength;
    this.material.uniforms.uSize.value = params.nebulaSize;
    this.material.uniforms.uThickness.value = params.thickness;
    this.material.uniforms.uDensity.value = params.nebulaOpacity;
    this.material.uniforms.uOpacity.value = params.nebulaOpacity;
    this.material.uniforms.uPointDensity.value = params.pointDensity;
    this.points.visible = params.mode !== 'original';
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
