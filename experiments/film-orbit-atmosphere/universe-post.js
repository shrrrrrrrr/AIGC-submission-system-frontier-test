import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createUniversePost(renderer, transition, hdr) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
  });
  const composer = new EffectComposer(renderer, target);
  const scenePass = new RenderPass(transition.scene, transition.camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.44, 0.42, 1.05);
  const vignette = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: 0.12 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
      void main(){vec4 c=texture2D(tDiffuse,vUv); vec2 p=(vUv-.5)*1.414;
        float edge=smoothstep(.18,.92,dot(p,p)); gl_FragColor=vec4(c.rgb*(1.-edge*strength),c.a);}`,
  });
  const output = new OutputPass();
  composer.addPass(scenePass);
  composer.addPass(bloom);
  composer.addPass(vignette);
  composer.addPass(output);
  let mobile = false;
  let reduced = false;
  return {
    composer, bloom,
    resize(width, height, dpr, isMobile, isReduced) {
      mobile = isMobile;
      reduced = isReduced;
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
      bloom.enabled = hdr && !mobile && !reduced;
    },
    render(visual, delta, isReduced = reduced) {
      reduced = isReduced;
      bloom.enabled = hdr && !mobile && !reduced;
      bloom.strength = visual.bloomStrength;
      renderer.toneMappingExposure = visual.exposure;
      composer.render(delta);
    },
    dispose() {
      bloom.dispose();
      vignette.dispose();
      output.dispose();
      scenePass.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
