import { GalaxyScene } from './GalaxyScene.js';

const scene = await GalaxyScene.create(document.querySelector('#galaxy-canvas'));
const $ = (id) => document.getElementById(id);
const stats = $('stats');
const loading = $('scene-loading');
const sceneCurrent = $('scene-current');
const bindings = [
  ['progress', 'progress'], ['residual', 'residual'], ['depth', 'depthStrength'], ['thickness', 'thickness'], ['parallax', 'parallax'], ['morph', 'morph'],
  ['star-size', 'starSize'], ['nebula-size', 'nebulaSize'], ['point-density', 'pointDensity'], ['flight-speed', 'flightSpeed'], ['star-intensity', 'starIntensity'],
  ['foreground-cleanup', 'foregroundCleanup'], ['foreground-softness', 'foregroundSoftness'], ['bloom-strength', 'bloomStrength']
];
const format = (v) => Number(v).toFixed(2);

function syncUi() {
  const params = scene.params;
  for (const [id, key] of bindings) {
    const input = $(id);
    const value = key === 'progress' ? scene.progressTarget : params[key];
    input.value = String(value ?? 0);
    $(`${id}-value`).textContent = format(value ?? 0);
  }
  $('bloom').checked = Boolean(params.bloom);
  for (const button of document.querySelectorAll('[data-mode]')) button.classList.toggle('active', button.dataset.mode === params.mode);
  for (const [id, layer] of [['star-bright','bright'], ['star-medium','medium'], ['star-dust','dust']]) $(id).checked = params.starVisibility[layer] > 0;
  for (const [id, layer] of [['nebula-front','front'], ['nebula-mid','mid'], ['nebula-back','back']]) $(id).checked = params.nebulaVisibility[layer] > 0;
  $('foreground-dust').checked = params.foregroundVisibility > 0;
  $('residual-backdrop').checked = params.residualVisible > 0;
  for (const button of document.querySelectorAll('[data-asset]')) button.classList.toggle('active', button.dataset.asset === scene.assetId);
  sceneCurrent.textContent = 'Active: ' + (scene.assetId ? scene.assetId.replace('galaxy-', 'Galaxy ').toUpperCase() : 'Galaxy A') + ' · press 1–4 to switch';
}

for (const [id, key] of bindings) {
  const input = $(id);
  const output = $(`${id}-value`);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    output.textContent = format(value);
    if (key === 'progress') scene.setProgress(value);
    else scene.updateParams({ [key]: value });
  });
}
$('bloom').addEventListener('change', (event) => scene.updateParams({ bloom: event.target.checked }));
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => { scene.updateParams({ mode: button.dataset.mode }); document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === button)); });
}
for (const button of document.querySelectorAll('[data-asset]')) {
  button.addEventListener('click', () => {
    scene.switchAsset(button.dataset.asset);
  });
}
window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, select')) return;
  const assetId = { '1': 'galaxy-a', '2': 'galaxy-b', '3': 'galaxy-c', '4': 'galaxy-d' }[event.key];
  if (!assetId) return;
  document.querySelector('[data-asset="' + assetId + '"]')?.click();
});
for (const [id, layer] of [['star-bright','bright'], ['star-medium','medium'], ['star-dust','dust']]) $(id).addEventListener('change', (event) => scene.updateParams({ starVisibility: { [layer]: event.target.checked ? 1 : 0 } }));
for (const [id, layer] of [['nebula-front','front'], ['nebula-mid','mid'], ['nebula-back','back']]) $(id).addEventListener('change', (event) => scene.updateParams({ nebulaVisibility: { [layer]: event.target.checked ? 1 : 0 } }));
$('foreground-dust').addEventListener('change', (event) => scene.updateParams({ foregroundVisibility: event.target.checked ? 1 : 0 }));
$('residual-backdrop').addEventListener('change', (event) => scene.updateParams({ residualVisible: event.target.checked ? 1 : 0 }));

scene.onStateChange = (state) => {
  loading.hidden = !state.loading && !state.error;
  if (state.loading) {
    loading.textContent = `Loading ${state.entry?.displayName || state.assetId}…`;
    sceneCurrent.textContent = `Loading: ${state.entry?.displayName || state.assetId}…`;
  } else if (state.error) {
    loading.textContent = `Unable to load ${state.assetId}`;
    sceneCurrent.textContent = `Unable to load ${state.assetId}`;
  } else {
    loading.textContent = `${state.entry?.displayName || state.assetId} ready`;
  }
  if (!state.loading && !state.error) syncUi();
};

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
  stats.textContent = `${d.assetId || 'galaxy'} · ${d.stars.toLocaleString()} stars · ${d.nebula.toLocaleString()} nebula · ${d.foreground.toLocaleString()} foreground · ${d.totalPoints.toLocaleString()} total · morph ${d.morph.toFixed(2)} · ${d.fps.toFixed(0)} FPS`;
}, 500);
syncUi();
if (window.scrollY > 0) updateScrollTarget();
