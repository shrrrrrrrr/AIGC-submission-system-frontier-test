import './universe-texture.css';
import './universe-main.js';

const root = document.documentElement;
const sceneRoot = document.querySelector('.universe-scene');
const plane = document.createElement('canvas');
plane.className = 'universe-image-plane';
sceneRoot.insertBefore(plane, sceneRoot.querySelector('.universe-particles'));
const gl = plane.getContext('webgl', { alpha: true, antialias: false });
const sources = {
  hero: 'milkyway-wide.png', news: 'galaxy-blue.png', facts: 'milkyway-blue.png', intro: 'nebula-vertical.png', themes: 'milkyway-purple.png',
  requirements: 'milkyway-blue.png', timeline: 'nebula-ribbon.png', jury: 'milkyway-purple.png', source: 'galaxy-blue.png', final: 'milkyway-wide.png',
};
let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0, blend = 1, last = performance.now(), fromSlot = 0, toSlot = 1, frame = 0;
const textures = [null, null];
const vertexSource = 'attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5; gl_Position=vec4(aPosition,0.,1.);}';
const fragmentSource = 'precision mediump float; uniform sampler2D uFrom; uniform sampler2D uTo; uniform float uBlend; uniform vec2 uPointer; uniform float uTime; uniform float uScroll; varying vec2 vUv; float lum(vec3 c){return dot(c,vec3(.299,.587,.114));} void main(){vec2 c=vUv-.5; float edge=1.-smoothstep(.05,.82,length(c)); vec3 base=texture2D(uFrom,vUv).rgb; float d=lum(base); vec2 warp=uPointer*(.008+d*.038)*edge; warp+=vec2(sin(uTime*.11+c.y*7.),cos(uTime*.09+c.x*6.))*.0015; warp+=vec2(uScroll*.006,-uScroll*.004); vec3 a=texture2D(uFrom,vUv+warp).rgb; vec3 b=texture2D(uTo,vUv-warp*.7).rgb; vec3 color=mix(a,b,smoothstep(0.,1.,uBlend)); float vignette=1.-smoothstep(.42,.76,length(c)); gl_FragColor=vec4(color*(.62+.5*vignette),1.);}';
function shader(type, source) { const item = gl.createShader(type); gl.shaderSource(item, source); gl.compileShader(item); return item; }
function textureFor(url, slot) { const image = new Image(); image.onload = () => { const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); textures[slot] = texture; if (slot === toSlot) blend = 0; }; image.src = url; }
if (gl) {
  const program = gl.createProgram(); gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program); gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = { from: gl.getUniformLocation(program, 'uFrom'), to: gl.getUniformLocation(program, 'uTo'), blend: gl.getUniformLocation(program, 'uBlend'), pointer: gl.getUniformLocation(program, 'uPointer'), time: gl.getUniformLocation(program, 'uTime'), scroll: gl.getUniformLocation(program, 'uScroll') };
  gl.uniform1i(uniforms.from, 0); gl.uniform1i(uniforms.to, 1);
  function resizePlane() { const scale = Math.min(devicePixelRatio || 1, 2); plane.width = innerWidth * scale; plane.height = innerHeight * scale; gl.viewport(0, 0, plane.width, plane.height); }
  function drawPlane(now) { frame = 0; const dt = Math.min(64, now - last); last = now; pointerX += (targetX - pointerX) * .06; pointerY += (targetY - pointerY) * .06; if (blend < 1) blend = Math.min(1, blend + dt / 1200); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[fromSlot]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[toSlot]); gl.uniform1f(uniforms.blend, blend); gl.uniform2f(uniforms.pointer, pointerX, pointerY); gl.uniform1f(uniforms.time, now / 1000); gl.uniform1f(uniforms.scroll, Number(root.style.getPropertyValue('--universe-scroll')) || 0); gl.drawArrays(gl.TRIANGLES, 0, 6); if (!document.hidden && (!matchMedia('(prefers-reduced-motion: reduce)').matches || blend < 1)) frame = requestAnimationFrame(drawPlane); }
  function wakePlane() { if (!frame) frame = requestAnimationFrame(drawPlane); }
  function changeScene() { const key = root.dataset.universeScene || 'hero'; const path = new URL(`./assets/universe/${sources[key] || sources.hero}`, import.meta.url).href; fromSlot = toSlot; toSlot = 1 - fromSlot; textureFor(path, toSlot); wakePlane(); }
  const observer = new MutationObserver(changeScene); observer.observe(root, { attributes: true, attributeFilter: ['data-universe-scene'] });
  addEventListener('pointermove', event => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; targetX = (event.clientX / Math.max(1, innerWidth) - .5) * 2; targetY = (event.clientY / Math.max(1, innerHeight) - .5) * 2; wakePlane(); }, { passive: true });
  addEventListener('pointerleave', () => { targetX = 0; targetY = 0; wakePlane(); }, { passive: true }); addEventListener('resize', resizePlane, { passive: true });
  resizePlane(); textureFor(new URL('./assets/universe/milkyway-wide.png', import.meta.url).href, 0); textureFor(new URL('./assets/universe/galaxy-blue.png', import.meta.url).href, 1); blend = .25; wakePlane();
}
