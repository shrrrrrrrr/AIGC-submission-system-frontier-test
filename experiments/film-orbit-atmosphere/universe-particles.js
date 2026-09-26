import * as THREE from 'three';
import { particleFragmentShader, particleVertexShader } from './universe-shaders.js';

const FAR_COLORS = [[0.22, 0.64, 1.0], [0.45, 0.38, 1.0], [0.65, 0.88, 1.0]];
const MID_COLORS = [[0.18, 0.82, 1.0], [0.44, 0.47, 1.0], [0.8, 0.45, 1.0]];
const NEAR_COLORS = [[0.58, 0.95, 1.0], [0.7, 0.6, 1.0], [1.0, 0.7, 0.95]];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createRandom(seed = 20261106) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function gaussian(random) {
  const radius = Math.sqrt(-2 * Math.log(Math.max(0.0001, random())));
  return radius * Math.cos(Math.PI * 2 * random());
}

function pick(random, colors) {
  return colors[Math.floor(random() * colors.length)];
}

function fillParticle(index, random, positions, sizes, depths, speeds, seeds, colors, emissive, layer) {
  const i3 = index * 3;
  let x; let y; let z; let size;
  if (layer === 0) {
    const band = gaussian(random);
    x = (random() - 0.5) * 76;
    y = Math.sin(x * 0.13) * 2.7 + band * 7.8;
    z = -38 - random() * 58;
    size = 0.018 + random() * 0.034;
  } else if (layer === 1) {
    const t = random() * Math.PI * 2;
    const radius = 5 + random() * 10;
    x = Math.cos(t) * radius * 1.45 + gaussian(random) * 3.2;
    y = Math.sin(t) * radius * 0.48 + Math.sin(x * 0.18) * 4.5 + gaussian(random) * 2.4;
    z = -17 - random() * 25;
    size = 0.035 + random() * 0.065;
  } else {
    const t = random() * Math.PI * 2;
    const radius = Math.pow(random(), 0.62) * 7.5;
    x = Math.cos(t) * radius + gaussian(random) * 1.2;
    y = Math.sin(t) * radius * 0.6 + gaussian(random) * 1.0;
    z = -3.2 - random() * 12;
    size = 0.075 + random() * 0.13;
  }
  const color = pick(random, layer === 0 ? FAR_COLORS : layer === 1 ? MID_COLORS : NEAR_COLORS);
  positions[i3] = x; positions[i3 + 1] = y; positions[i3 + 2] = z;
  colors[i3] = color[0]; colors[i3 + 1] = color[1]; colors[i3 + 2] = color[2];
  sizes[index] = size;
  depths[index] = layer === 0 ? 0.12 + random() * 0.2 : layer === 1 ? 0.45 + random() * 0.28 : 0.78 + random() * 0.22;
  speeds[index] = layer === 0 ? 0.08 + random() * 0.14 : layer === 1 ? 0.16 + random() * 0.24 : 0.28 + random() * 0.38;
  seeds[index] = random();
  emissive[index] = layer === 2 ? 0.62 + random() * 0.38 : 0.22 + random() * 0.55;
}

export function getParticleQuality({ reducedMotion = false } = {}) {
  const mobile = matchMedia('(max-width: 700px)').matches;
  const hardware = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (reducedMotion) return { count: mobile ? 5000 : 9000, dpr: 1, mobile, reducedMotion: true };
  if (mobile) return { count: hardware <= 4 || memory <= 4 ? 9000 : 16000, dpr: 1.25, mobile, reducedMotion: false };
  if (hardware >= 8 && memory >= 8) return { count: 44000, dpr: 1.75, mobile, reducedMotion: false };
  return { count: 28000, dpr: 1.5, mobile, reducedMotion: false };
}

export function createParticleField({ quality }) {
  const count = quality.count;
  const farCount = Math.floor(count * 0.58);
  const midCount = Math.floor(count * 0.3);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const depths = new Float32Array(count);
  const speeds = new Float32Array(count);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const emissive = new Float32Array(count);
  const random = createRandom();

  for (let index = 0; index < count; index += 1) {
    const layer = index < farCount ? 0 : index < farCount + midCount ? 1 : 2;
    fillParticle(index, random, positions, sizes, depths, speeds, seeds, colors, emissive, layer);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aEmissive', new THREE.Float32BufferAttribute(emissive, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScroll: { value: 0 }, uScrollVelocity: { value: 0 }, uMotion: { value: quality.reducedMotion ? 0 : 1 },
      uPixelRatio: { value: 1 }, uPointer: { value: new THREE.Vector2() }, uFogColor: { value: new THREE.Color(0x030915) },
      uFogNear: { value: 16 }, uFogFar: { value: 90 },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material };
}

export function updateParticleField(field, { elapsed, input, pixelRatio }) {
  const { material } = field;
  material.uniforms.uTime.value = elapsed;
  material.uniforms.uScroll.value = clamp(input.current.scroll, 0, 1);
  material.uniforms.uScrollVelocity.value = clamp(input.current.scrollVelocity, -2.5, 2.5);
  material.uniforms.uPointer.value.set(input.current.pointerX, input.current.pointerY);
  material.uniforms.uPixelRatio.value = pixelRatio;
}