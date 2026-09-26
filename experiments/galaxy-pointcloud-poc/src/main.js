import { GalaxyScene } from './GalaxyScene.js';

const scene = await GalaxyScene.create(document.querySelector('#galaxy-canvas'));
const $ = (id) => document.getElementById(id);
const stats = $('stats');
const bindings = [
  ['residual', 'residual'], ['depth', 'depthStrength'], ['point-density', 'pointDensity'], ['thickness', 'thickness'], ['parallax', 'parallax'], ['star-size', 'starSize'], ['nebula-size', 'nebulaSize'], ['nebula-opacity', 'nebulaOpacity'], ['progress', 'progress'], ['bloom-strength', 'bloomStrength']
];
const format = (v) => Number(v).toFixed(2);
for (const [id, key] of bindings) {
  const input = $(id); const output = $(`${id}-value`);
  input.addEventListener('input', () => {
    const value = Number(input.value); output.textContent = format(value);
    if (key === 'progress') scene.setProgress(value); else scene.updateParams({ [key]: value });
  });
}
$('bloom').addEventListener('change', (event) => scene.updateParams({ bloom: event.target.checked }));
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === button));
    scene.updateParams({ mode: button.dataset.mode });
  });
}
const updateScrollTarget = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  scene.setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
};
window.addEventListener('scroll', updateScrollTarget, { passive: true });
window.addEventListener('pointermove', (event) => scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2), { passive: true });
window.__galaxyDebug = { scene, get info() { return scene.debugInfo(); } };
const tick = (now) => { scene.render(now); requestAnimationFrame(tick); };
requestAnimationFrame(tick);
setInterval(() => {
  const d = scene.debugInfo();
  stats.textContent = `${d.stars.toLocaleString()} stars · ${d.nebula.toLocaleString()} nebula points · ${d.fps.toFixed(0)} FPS · ${d.calls} calls · ${d.geometries} geometries · ${d.textures} textures`;
}, 500);
updateScrollTarget();
