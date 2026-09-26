export const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uScrollVelocity;
  uniform float uMotion;
  uniform float uPixelRatio;


  attribute float aSize;
  attribute float aDepth;
  attribute float aSpeed;
  attribute float aSeed;
  attribute vec3 aColor;
  attribute float aEmissive;

  varying vec3 vColor;
  varying float vDepth;
  varying float vEmissive;
  varying float vTwinkle;

  void main() {
    vec3 displaced = position;
    float phase = uTime * aSpeed * uMotion + aSeed * 6.2831853;
    float scrollWave = sin(uScroll * 6.2831853 + aSeed * 4.0);
    float drift = sin(phase + position.x * 0.08) * 0.045;
    displaced.x += drift * (0.35 + aDepth * 0.75);
    displaced.y += cos(phase * 0.73 + position.z * 0.035) * 0.035;
    displaced.y += scrollWave * uScrollVelocity * (0.04 + aDepth * 0.12);
    displaced.x += uScrollVelocity * (0.025 + aDepth * 0.09);

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    float cameraDepth = max(0.45, -mvPosition.z);
    float perspectiveSize = aSize * uPixelRatio * projectionMatrix[1][1] / cameraDepth * 460.0;
    gl_PointSize = clamp(perspectiveSize, 0.35, 9.0);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    vDepth = clamp(1.0 - cameraDepth / 92.0, 0.035, 1.0);
    vEmissive = aEmissive;
    vTwinkle = 0.78 + 0.22 * sin(phase * 1.7);
  }
`;

export const particleFragmentShader = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uMotion; uniform vec3 uParticleTint; uniform float uParticleIntensity;

  varying vec3 vColor;
  varying float vDepth;
  varying float vEmissive;
  varying float vTwinkle;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);
    float softDisc = 1.0 - smoothstep(0.18, 0.5, distanceToCenter);
    if (softDisc <= 0.002) discard;

    float depthBrightness = mix(0.35, 1.0, smoothstep(0.0, 0.9, vDepth));
    float fog = 1.0 - smoothstep(uFogNear, uFogFar, (1.0 - vDepth) * 92.0);
    float pulse = mix(0.92, 1.08, vTwinkle) * (0.86 + uMotion * 0.14);
    vec3 tinted = vColor * mix(vec3(1.0), uParticleTint, 0.42); vec3 color = mix(uFogColor, tinted, 0.55 + fog * 0.45) * depthBrightness * pulse * (0.65 + vEmissive * 0.75) * uParticleIntensity;
    float alpha = softDisc * (0.12 + vDepth * 0.66) * fog;
    gl_FragColor = vec4(color, alpha);
  }
`;