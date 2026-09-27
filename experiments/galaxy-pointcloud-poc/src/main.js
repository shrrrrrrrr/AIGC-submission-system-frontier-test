import { GalaxyScene } from './GalaxyScene.js';

const scene = await GalaxyScene.create(document.querySelector('#galaxy-canvas'));
const $ = (id) => document.getElementById(id);
const stats = $('stats');
const bindings = [
  ['progress', 'progress'], ['residual', 'residual'], ['depth', 'depthStrength'], ['thickness', 'thickness'], ['parallax', 'parallax'], ['morph', 'morph'],
  ['star-size', 'starSize'], ['nebula-size', 'nebulaSize'], ['point-density', 'pointDensity'], ['flight-speed', 'flightSpeed'], ['star-intensity', 'starIntensity'],
  ['foreground-cleanup', 'foregroundCleanup'], ['foreground-softness', 'foregroundSoftness'], ['bloom-strength', 'bloomStrength']
];
const format = (v) => Number(v).toFixed(2);
for (const [id, key] of bindings) {
  const input = $(id); const output = $(`${id}-value`);
  input.addEventListener('input', () => { const value = Number(input.value); output.textContent = format(value); if (key === 'progress') scene.setProgress(value); else scene.updateParams({ [key]: value }); });
}
$('bloom').addEventListener('change', (event) => scene.updateParams({ bloom: event.target.checked }));
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => { document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === button)); scene.updateParams({ mode: button.dataset.mode }); });
}
for (const [id, layer] of [['star-bright','bright'], ['star-medium','medium'], ['star-dust','dust']]) $(id).addEventListener('change', (event) => scene.updateParams({ starVisibility: { [layer]: event.target.checked ? 1 : 0 } }));
for (const [id, layer] of [['nebula-front','front'], ['nebula-mid','mid'], ['nebula-back','back']]) $(id).addEventListener('change', (event) => scene.updateParams({ nebulaVisibility: { [layer]: event.target.checked ? 1 : 0 } }));
$('foreground-dust').addEventListener('change', (event) => scene.updateParams({ foregroundVisibility: event.target.checked ? 1 : 0 }));
$('residual-backdrop').addEventListener('change', (event) => scene.updateParams({ residualVisible: event.target.checked ? 1 : 0 }));
const updateScrollTarget = () => { const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); scene.setProgress(Math.min(1, Math.max(0, window.scrollY / max))); };
window.addEventListener('scroll', updateScrollTarget, { passive: true });
window.addEventListener('pointermove', (event) => scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2), { passive: true });
window.__galaxyDebug = { scene, get info() { return scene.debugInfo(); } };
const tick = (now) => { scene.render(now); requestAnimationFrame(tick); };
requestAnimationFrame(tick);
setInterval(() => { const d = scene.debugInfo(); stats.textContent = `${d.stars.toLocaleString()} stars · ${d.nebula.toLocaleString()} nebula · ${d.foreground.toLocaleString()} foreground · ${d.totalPoints.toLocaleString()} total · morph ${d.morph.toFixed(2)} · ${d.fps.toFixed(0)} FPS`; }, 500);
updateScrollTarget();
