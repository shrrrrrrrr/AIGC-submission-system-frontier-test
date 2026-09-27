import { GalaxyScene } from './GalaxyScene.js';

const $ = (id) => document.getElementById(id);
const scene = await GalaxyScene.create($('galaxy-canvas'));
const stats = $('stats');
const loading = $('scene-loading');
const sceneCurrent = $('scene-current');
const saveButton = $('save-preset');
const saveState = $('save-state');
let dirty = false;
let lastSavedAt = null;

const bindings = [
  ['progress', 'progress'], ['residual', 'residual'], ['depth', 'depthStrength'], ['thickness', 'thickness'], ['parallax', 'parallax'], ['morph', 'morph'],
  ['star-size', 'starSize'], ['nebula-size', 'nebulaSize'], ['point-density', 'pointDensity'], ['flight-speed', 'flightSpeed'], ['star-intensity', 'starIntensity'],
  ['foreground-cleanup', 'foregroundCleanup'], ['foreground-softness', 'foregroundSoftness'], ['bloom-strength', 'bloomStrength'],
  ['scroll-pitch', 'scrollPitchDegrees'], ['pointer-yaw', 'pointerYawDegrees'], ['pointer-pitch', 'pointerPitchDegrees'], ['follow-speed', 'followSpeed'], ['safe-overscan', 'safeOverscan']
];
const format = (v) => Number(v).toFixed(2);
const assetName = (id) => ({ 'galaxy-a': '银河 A', 'galaxy-b': '银河 B', 'galaxy-c': '银河 C', 'galaxy-d': '银河 D' }[id] || id || '银河');

function setSaveState(text, type = '') {
  saveState.textContent = text;
  saveState.dataset.state = type;
}
function markDirty() {
  dirty = true;
  saveButton.disabled = false;
  setSaveState('有未保存修改', 'dirty');
}
function syncUi(clean = true) {
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
  sceneCurrent.textContent = `当前：${assetName(scene.assetId)} · 可用快捷键 1–4`;
  if (clean) {
    dirty = false; saveButton.disabled = false;
    setSaveState(lastSavedAt ? `已保存 · ${lastSavedAt}` : '已读取当前预设', 'saved');
  }
}

for (const [id, key] of bindings) {
  const input = $(id);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    $(`${id}-value`).textContent = format(value);
    if (key === 'progress') scene.setProgress(value);
    else scene.updateParams({ [key]: value });
    markDirty();
  });
}
$('bloom').addEventListener('change', (event) => { scene.updateParams({ bloom: event.target.checked }); markDirty(); });
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { scene.updateParams({ mode: button.dataset.mode }); syncUi(false); markDirty(); });
for (const button of document.querySelectorAll('[data-asset]')) button.addEventListener('click', () => scene.switchAsset(button.dataset.asset));
window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, select, button')) return;
  const assetId = { '1': 'galaxy-a', '2': 'galaxy-b', '3': 'galaxy-c', '4': 'galaxy-d' }[event.key];
  if (assetId) document.querySelector(`[data-asset="${assetId}"]`)?.click();
});
for (const [id, layer] of [['star-bright','bright'], ['star-medium','medium'], ['star-dust','dust']]) $(id).addEventListener('change', (event) => { scene.updateParams({ starVisibility: { [layer]: event.target.checked ? 1 : 0 } }); markDirty(); });
for (const [id, layer] of [['nebula-front','front'], ['nebula-mid','mid'], ['nebula-back','back']]) $(id).addEventListener('change', (event) => { scene.updateParams({ nebulaVisibility: { [layer]: event.target.checked ? 1 : 0 } }); markDirty(); });
$('foreground-dust').addEventListener('change', (event) => { scene.updateParams({ foregroundVisibility: event.target.checked ? 1 : 0 }); markDirty(); });
$('residual-backdrop').addEventListener('change', (event) => { scene.updateParams({ residualVisible: event.target.checked ? 1 : 0 }); markDirty(); });

async function savePreset() {
  saveButton.disabled = true; setSaveState('保存中…', 'saving');
  try {
    const response = await fetch(`/__galaxy/config/${scene.assetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: scene.revision, preset: scene.getPresetForSave() }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    scene.applyPreset(payload.preset, false, payload.revision);
    lastSavedAt = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    syncUi(true); setSaveState(`已保存并同步主页 · ${lastSavedAt}`, 'saved');
  } catch (error) {
    saveButton.disabled = false; setSaveState(`保存失败：${error.message}`, 'error');
  }
}
saveButton.addEventListener('click', savePreset);

scene.onStateChange = (state) => {
  loading.hidden = !state.loading && !state.error;
  if (state.loading) {
    loading.textContent = `正在读取${assetName(state.assetId)}…`;
    sceneCurrent.textContent = `正在读取${assetName(state.assetId)}…`;
  } else if (state.error) {
    loading.hidden = false; loading.textContent = `读取${assetName(state.assetId)}失败：${state.error.message}`;
    sceneCurrent.textContent = `读取失败：${assetName(state.assetId)}`;
  } else {
    loading.textContent = `${assetName(state.assetId)}已就绪`;
    syncUi(true);
  }
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
  stats.textContent = `${assetName(d.assetId)} · 亮星 ${d.stars.toLocaleString()} · 星云 ${d.nebula.toLocaleString()} · 前景尘埃 ${d.foreground.toLocaleString()} · 点数 ${d.totalPoints.toLocaleString()} · 展开 ${d.morph.toFixed(2)} · ${d.fps.toFixed(0)} 帧/秒 · 绘制调用 ${d.calls}`;
}, 500);
syncUi();
if (window.scrollY > 0) updateScrollTarget();
