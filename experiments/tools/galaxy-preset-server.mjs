import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const presetsDir = resolve(toolDir, '../galaxy-pointcloud-poc/presets');
const allowedAssets = new Set(['galaxy-a', 'galaxy-b', 'galaxy-c', 'galaxy-d']);
const presetFiles = {
  'galaxy-a': 'galaxy-a-approved.json',
  'galaxy-b': 'galaxy-b-default.json',
  'galaxy-c': 'galaxy-c-default.json',
  'galaxy-d': 'galaxy-d-default.json'
};
const allowedOrigins = new Set([
  'http://127.0.0.1:5197', 'http://127.0.0.1:5198',
  'http://localhost:5197', 'http://localhost:5198'
]);
const numberRanges = {
  previewProgress: [0, 1], residual: [0, 1], depthStrength: [0, 1.8], thickness: [.2, 2.5], parallax: [0, 3],
  morph: [0, 1], starSize: [.4, 2], nebulaSize: [.2, 2], foregroundSize: [.4, 2], nebulaOpacity: [0, 1], manualMorph: [0, 1], fixedMorph: [0, 1], pointDensity: [.15, 1], flightSpeed: [.2, 2],
  starIntensity: [0, 1.5], foregroundCleanup: [0, 1], foregroundSoftness: [.5, 2.5], bloomStrength: [0, 1],
  scrollPitchDegrees: [0, 8], pointerYawDegrees: [0, 7], pointerPitchDegrees: [0, 4], followSpeed: [2, 14], safeOverscan: [1, 1.4]
};
const objectRanges = {
  starVisibility: ['bright', 'medium', 'dust'],
  nebulaVisibility: ['front', 'mid', 'back'],
  starLayers: ['bright', 'medium', 'dust'],
  nebulaIntensity: ['front', 'mid', 'back']
};
const booleanKeys = new Set(['bloom', 'foregroundVisibility', 'residualVisible']);
const stringKeys = new Set(['assetId', 'name', 'source', 'mode', 'notes']);

function revisionFor(assetId) {
  const file = resolve(presetsDir, presetFiles[assetId]);
  const stat = statSync(file);
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
  return `${Math.floor(stat.mtimeMs)}-${digest}`;
}

function fileFor(assetId) {
  if (!allowedAssets.has(assetId)) return null;
  return resolve(presetsDir, presetFiles[assetId]);
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match');
  res.setHeader('Cache-Control', 'no-store');
}

function validatePreset(assetId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('预设必须是 JSON 对象');
  if (input.assetId && input.assetId !== assetId) throw new Error('assetId 与保存目标不一致');
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'revision' || key === 'savedAt') continue;
    if (numberRanges[key]) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} 必须是有限数值`);
      const [min, max] = numberRanges[key];
      if (value < min || value > max) throw new Error(`${key} 超出允许范围 ${min}–${max}`);
      output[key] = value;
    } else if (booleanKeys.has(key)) {
      if (typeof value !== 'boolean' && value !== 0 && value !== 1) throw new Error(`${key} 必须是布尔值`);
      output[key] = Boolean(value);
    } else if (stringKeys.has(key)) {
      if (typeof value !== 'string' || value.length > 240) throw new Error(`${key} 必须是短文本`);
      output[key] = value;
    } else if (objectRanges[key]) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} 必须是对象`);
      if(Object.keys(value).some(child=>!objectRanges[key].includes(child))) throw new Error(`${key} 包含不允许的子字段`);
      output[key] = {};
      for (const child of objectRanges[key]) {
        if (value[child] === undefined) throw new Error(`${key}.${child} 缺失`);
        if (typeof value[child] !== 'number' || !Number.isFinite(value[child]) || value[child] < 0 || value[child] > 1) throw new Error(`${key}.${child} 超出 0–1 范围`);
        output[key][child] = value[child];
      }
    } else {
      throw new Error(`不允许保存字段：${key}`);
    }
  }
  if (!['hybrid','pointcloud','original'].includes(output.mode)) throw new Error('显示模式无效');
  for(const key of Object.keys(numberRanges).filter(k=>!['foregroundSize','nebulaOpacity','manualMorph','fixedMorph'].includes(k))) if(output[key]===undefined) throw new Error(`缺少参数：${key}`);
  for(const key of Object.keys(objectRanges)) if(!output[key]) throw new Error(`缺少图层状态：${key}`);
  output.assetId = assetId;
  return output;
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 256 * 1024) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}


export function galaxyPresetServer({ writable = true } = {}) {
  return {
    name: 'galaxy-preset-server',
    generateBundle() {
      for (const name of Object.values(presetFiles)) this.emitFile({ type:'asset', fileName:`presets/${name}`, source:readFileSync(resolve(presetsDir,name)) });
    },
    configureServer(server) {
      mkdirSync(presetsDir, { recursive: true });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/__galaxy/')) return next();
        const address=req.socket.remoteAddress;
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address) || !/^(127\.0\.0\.1|localhost):519[78]$/.test(req.headers.host || '')) { sendJson(res,403,{error:'配置接口仅允许本地预览访问'});return; }
        if(req.headers.origin && !allowedOrigins.has(req.headers.origin)) { sendJson(res,403,{error:'请求来源不允许'});return; }
        setCors(req, res);
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        const match = url.pathname.match(/^\/__galaxy\/config\/([a-z-]+)$/);
        if (match && (req.method === 'GET' || req.method === 'PUT')) {
          const assetId = match[1];
          const file = fileFor(assetId);
          if (!file || !existsSync(file)) { sendJson(res, 404, { error: '未知的银河资产' }); return; }
          try {
            if (req.method === 'GET') {
              const preset = JSON.parse(readFileSync(file, 'utf8'));
              sendJson(res, 200, { assetId, revision: revisionFor(assetId), preset });
              return;
            }
            if(!writable || !allowedOrigins.has(req.headers.origin) || !req.headers['content-type']?.startsWith('application/json')) { sendJson(res,403,{error:'仅允许调参页提交 JSON 预设'});return; }
            const body = await readBody(req);
            const currentRevision = revisionFor(assetId);
            if (!body.baseRevision || body.baseRevision !== currentRevision) {
              sendJson(res, 409, { error: '预设已在其他页面更新，请先重新读取最新版本。', revision: currentRevision });
              return;
            }
            const preset = validatePreset(assetId, body.preset);
            const previous = readFileSync(file);
            writeFileSync(`${file}.bak`, previous);
            const temp = `${file}.${process.pid}.tmp`;
            writeFileSync(temp, `${JSON.stringify(preset, null, 2)}\n`, 'utf8');
            renameSync(temp, file);
            const revision = revisionFor(assetId);
            const payload = { assetId, revision, savedAt: new Date().toISOString() };
            sendJson(res, 200, { ...payload, preset });
            return;
          } catch (error) {
            sendJson(res, 400, { error: error instanceof SyntaxError ? '请求不是有效 JSON' : error.message });
            return;
          }
        }
        sendJson(res, 404, { error: '未知的银河配置接口' });
      });
    }
  };
}
