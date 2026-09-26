export const starVertex = `
uniform float uTime;
uniform float uDepthStrength;
uniform float uSize;
uniform float uProjectionScale;
attribute float aSize;
attribute vec3 aColor;
attribute float aEmissive;
attribute float aSeed;
varying vec3 vColor;
varying float vEmissive;
varying float vDepth;
varying float vSeed;
void main() {
  vec3 p = position;
  p.z = -22.0 + (position.z + 22.0) * uDepthStrength;
  float depth = max(0.0, -p.z);
  float drift = sin(uTime * 0.18 + aSeed * 6.2831) * 0.018 * uDepthStrength;
  p.x += drift * smoothstep(8.0, 65.0, depth);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(aSize * uSize * uProjectionScale / max(1.0, -mv.z), 0.7, 14.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vEmissive = aEmissive;
  vDepth = clamp((-mv.z - 7.0) / 65.0, 0.0, 1.0);
  vSeed = aSeed;
}
`;
export const starFragment = `
uniform float uTime;
uniform float uDepthStrength;
varying vec3 vColor;
varying float vEmissive;
varying float vDepth;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 7.5);
  float halo = exp(-d * d * 2.7);
  float twinkle = 0.88 + 0.12 * sin(uTime * (0.55 + vSeed * 0.7) + vSeed * 17.0);
  float haze = mix(0.38, 1.0, 1.0 - vDepth);
  vec3 color = vColor * (0.45 * halo + (0.85 + vEmissive * 1.7) * core) * twinkle * haze;
  float alpha = (0.22 * halo + 0.92 * core) * mix(0.45, 1.0, 1.0 - vDepth);
  gl_FragColor = vec4(color, alpha);
}
`;

export const nebulaVertex = `
uniform float uTime;
uniform float uDepthStrength;
uniform float uSize;
uniform float uProjectionScale;
uniform float uThickness;
uniform float uDensity;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aDensity;
attribute float aSeed;
varying vec3 vColor;
varying float vAlpha;
varying float vDensity;
varying float vSeed;
varying float vDepth;
void main() {
  vec3 p = position;
  float centerZ = -18.0 - aDensity * 7.0;
  p.z = -22.0 + (centerZ + 22.0 + (position.z - centerZ) * uThickness) * uDepthStrength;
  float depth = max(0.0, -p.z);
  p.z += sin(uTime * 0.06 + aSeed * 31.0) * 0.08 * uDepthStrength * uThickness;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(aSize * uSize * 2.8 * uProjectionScale / max(1.0, -mv.z), 0.7, 16.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = aAlpha;
  vDensity = aDensity;
  vSeed = aSeed;
  vDepth = clamp((-mv.z - 8.0) / 65.0, 0.0, 1.0);
}
`;
export const nebulaFragment = `
uniform float uOpacity;
uniform float uPointDensity;
varying vec3 vColor;
varying float vAlpha;
varying float vDensity;
varying float vSeed;
varying float vDepth;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;
  if (vSeed > uPointDensity) discard;
  float soft = pow(max(0.0, 1.0 - d), 2.1);
  float depthFade = mix(0.72, 0.18, vDepth);
  float densityLight = 0.42 + vDensity * 0.8;
  gl_FragColor = vec4(vColor * densityLight, soft * vAlpha * depthFade * uOpacity / max(0.2, uPointDensity));
}
`;

export const residualVertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
export const residualFragment = `uniform sampler2D uTexture; uniform float uOpacity; varying vec2 vUv; void main(){vec4 c=texture2D(uTexture,vUv); gl_FragColor=vec4(c.rgb,uOpacity*c.a);}`;
