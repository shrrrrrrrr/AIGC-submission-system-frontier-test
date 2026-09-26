import * as THREE from 'three';

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;

export function createUniverseLighting() {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uniforms = {
    uTintA: { value: new THREE.Color() }, uTintB: { value: new THREE.Color() },
    uIntensity: { value: 1 }, uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 16 }, uFogFar: { value: 90 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying float vDepth; varying float vTint;
      void main(){vUv=uv; vTint=step(0.,instanceMatrix[3].x);
        vec4 center=modelViewMatrix*instanceMatrix*vec4(0,0,0,1);
        vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        center.xy+=position.xy*size; vDepth=-center.z;
        gl_Position=projectionMatrix*center;}`,
    fragmentShader: `uniform vec3 uTintA,uTintB,uFogColor; uniform float uIntensity,uFogNear,uFogFar;
      varying vec2 vUv; varying float vDepth,vTint;
      void main(){float d=length(vUv-.5)*2.; float core=exp(-d*d*220.);
        float halo=exp(-d*d*5.)*pow(max(0.,1.-d),2.);
        float visibility=1.-smoothstep(uFogNear,uFogFar,vDepth);
        vec3 tint=mix(uTintA,uTintB,vTint);
        vec3 color=mix(uFogColor,tint,.45+.55*visibility);
        gl_FragColor=vec4(color*(core*3.8+halo*.09)*uIntensity,visibility*.7);}`,
  });
  const lights = new THREE.InstancedMesh(geometry, material, 6);
  const transform = new THREE.Object3D();
  const locations = [[-14,7,-48,22],[12,-5,-32,16],[-8,-6,-18,9],[6,5,-8,5],[-22,1,-62,27],[18,10,-42,18]];
  locations.forEach(([x,y,z,size], index) => {
    transform.position.set(x,y,z);
    transform.scale.set(size,size,1);
    transform.updateMatrix();
    lights.setMatrixAt(index,transform.matrix);
  });
  lights.instanceMatrix.needsUpdate = true;
  lights.frustumCulled = false;

  const hazeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTintA: { value: new THREE.Color() }, uTintB: { value: new THREE.Color() },
      uFogColor: { value: new THREE.Color() }, uFogNear: { value: 16 }, uFogFar: { value: 90 },
      uDensity: { value: 0.04 }, uTime: { value: 0 },
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying float vDepth;
      void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: noise + `
      uniform vec3 uTintA,uTintB,uFogColor; uniform float uDensity,uTime,uFogNear,uFogFar;
      varying vec2 vUv; varying float vDepth;
      void main(){vec2 drift=vec2(uTime*.006,-uTime*.003);
        float n=noise(vUv*3.1+drift)*.68+noise(vUv*7.7-drift*.7)*.24+noise(vUv*17.3+drift*.3)*.08;
        float border=pow(max(0.,1.-length((vUv-.5)*2.)),2.);
        float visibility=1.-smoothstep(uFogNear,uFogFar,vDepth);
        vec3 tint=mix(uTintA,uTintB,smoothstep(.15,.85,vUv.x));
        gl_FragColor=vec4(mix(uFogColor,tint,visibility),n*border*uDensity*visibility);}`,
  });
  const haze = new THREE.Mesh(geometry, hazeMaterial);
  haze.position.set(0,1,-32);
  haze.scale.set(85,55,1);
  haze.frustumCulled = false;
  const group = new THREE.Group();
  group.add(haze,lights);

  return {
    group,
    update(descriptor, elapsed, motion) {
      uniforms.uTintA.value.copy(descriptor.lightTintAValue);
      uniforms.uTintB.value.copy(descriptor.lightTintBValue);
      uniforms.uIntensity.value = descriptor.lightIntensity;
      uniforms.uFogColor.value.copy(descriptor.fogColorValue);
      uniforms.uFogNear.value = descriptor.fogNear;
      uniforms.uFogFar.value = descriptor.fogFar;
      const h = hazeMaterial.uniforms;
      h.uTintA.value.copy(descriptor.atmosphereColorAValue);
      h.uTintB.value.copy(descriptor.atmosphereColorBValue);
      h.uFogColor.value.copy(descriptor.fogColorValue);
      h.uFogNear.value = descriptor.fogNear;
      h.uFogFar.value = descriptor.fogFar;
      h.uDensity.value = descriptor.atmosphereDensity;
      h.uTime.value = motion ? elapsed * motion : 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      hazeMaterial.dispose();
    },
  };
}
