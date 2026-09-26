import * as THREE from 'three';

export const transitionVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const transitionFragmentShader = /* glsl */ `
  uniform sampler2D tSceneA;
  uniform sampler2D tSceneB;
  uniform float uProgress;
  uniform float uRawProgress;
  uniform float uVelocity;
  uniform float uDirection;
  uniform float uSoftness;
  uniform float uDisplacement;
  uniform vec2 uPointer;
  uniform vec3 uAtmosphereA;
  uniform vec3 uAtmosphereB;
  uniform float uAtmosphereStrength;

  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float field = noise(vUv * 3.4 + uPointer * 0.13);
    field += noise(vUv * 8.0 - uPointer * 0.08) * 0.25;
    field += sin((centered.x * 1.1 - centered.y * 0.8 + uRawProgress * 1.6) * 6.2831853) * 0.08;
    field = clamp(field / 1.33, 0.0, 1.0);

    float threshold = uProgress + (field - 0.5) * 0.22;
    float mask = smoothstep(0.42 - uSoftness, 0.58 + uSoftness, threshold);
    if (uProgress <= 0.0001) mask = 0.0;
    if (uProgress >= 0.9999) mask = 1.0;

    vec2 flow = vec2(uDirection * 0.018, -uDirection * 0.012) * min(abs(uVelocity), 2.5);
    vec2 uvA = clamp(vUv + flow * (1.0 - mask) + (field - 0.5) * uDisplacement * (1.0 - mask), 0.001, 0.999);
    vec2 uvB = clamp(vUv - flow * mask - (field - 0.5) * uDisplacement * mask, 0.001, 0.999);
    vec3 sceneA = texture2D(tSceneA, uvA).rgb;
    vec3 sceneB = texture2D(tSceneB, uvB).rgb;
    vec3 atmosphere = mix(uAtmosphereA, uAtmosphereB, mask) * uAtmosphereStrength;
    float edge = 1.0 - smoothstep(0.0, 0.16, abs(threshold - 0.5));
    vec3 color = mix(sceneA, sceneB, mask);
    color += atmosphere * edge * 0.08;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createTransitionPass() {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tSceneA: { value: null },
      tSceneB: { value: null },
      uProgress: { value: 0 },
      uRawProgress: { value: 0 },
      uVelocity: { value: 0 },
      uDirection: { value: 1 },
      uSoftness: { value: 0.08 },
      uDisplacement: { value: 0.018 },
      uPointer: { value: new THREE.Vector2() },
      uAtmosphereA: { value: new THREE.Color() },
      uAtmosphereB: { value: new THREE.Color() },
      uAtmosphereStrength: { value: 0.9 },
    },
    vertexShader: transitionVertexShader,
    fragmentShader: transitionFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, material);
  scene.add(quad);
  return { scene, camera, material, geometry };
}