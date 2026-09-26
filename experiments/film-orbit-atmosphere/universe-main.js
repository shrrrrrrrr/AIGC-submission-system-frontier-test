import './base-main.js';
import './universe.css';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const scene = document.createElement('div');
scene.className = 'universe-scene';
scene.setAttribute('aria-hidden', 'true');
scene.innerHTML = '<div class="space-image"></div><div class="nebula-layer"></div><canvas class="universe-particles"></canvas><div class="vignette"></div>';
document.body.prepend(scene);
const canvas = scene.querySelector('.universe-particles');
const ctx = canvas.getContext('2d', { alpha: true });
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let width = 0, height = 0, dpr = 1, raf = 0, scroll = 0, seed = 20261106;
let stars = [];
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2); width = innerWidth; height = innerHeight;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed = 20261106;
  stars = Array.from({ length: width < 640 ? 145 : 270 }, () => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, z: .06 + rand() * .94, r: .3 + rand() * 1.45, tw: .4 + rand() * 1.1, p: rand() * Math.PI * 2 }));
  draw(0);
}
function draw(time) {
  const seconds = time / 1000; pointer.x += (pointer.tx - pointer.x) * .055; pointer.y += (pointer.ty - pointer.y) * .055; ctx.clearRect(0, 0, width, height);
  const yaw = pointer.x * .24 + scroll * .06, pitch = pointer.y * .16, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  stars.forEach(star => {
    const moving = star.z + (reducedMotion.matches ? 0 : (seconds * .008) % .028), z = moving > 1 ? moving - 1 : moving;
    const x = star.x * (1.04 + z * .2), y = star.y * (1.04 + z * .2), rx = x * cy - z * sy * .38, rz = x * sy * .38 + z * cy;
    const ry = y * cp - rz * sp, depth = rz * cp + y * sp, perspective = .5 + Math.max(0, depth) * 1.18;
    const px = width / 2 + rx * width * .47 * perspective, py = height / 2 + ry * height * .62 * perspective;
    if (px < -12 || px > width + 12 || py < -12 || py > height + 12) return;
    const alpha = Math.min(.9, (.12 + perspective * .52) * (.7 + Math.sin(seconds * star.tw + star.p) * .2)), radius = star.r * (.4 + perspective * .72);
    ctx.beginPath(); ctx.fillStyle = `rgba(193,235,255,${alpha})`; ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
    if (star.r > 1.25 && alpha > .48) { ctx.strokeStyle = `rgba(112,210,255,${alpha * .32})`; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(px - radius * 3.2, py); ctx.lineTo(px + radius * 3.2, py); ctx.moveTo(px, py - radius * 3.2); ctx.lineTo(px, py + radius * 3.2); ctx.stroke(); }
  });
}
function wake() { if (!raf && !document.hidden && !reducedMotion.matches) raf = requestAnimationFrame(tick); }
function tick(time) { raf = 0; draw(time); wake(); }
function updateScroll() { scroll = Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight))); root.style.setProperty('--universe-scroll', scroll.toFixed(3)); wake(); }
addEventListener('pointermove', event => { if (!finePointer.matches || reducedMotion.matches) return; pointer.tx = (event.clientX / Math.max(1, innerWidth) - .5) * 2; pointer.ty = (event.clientY / Math.max(1, innerHeight) - .5) * 2; root.style.setProperty('--universe-px', pointer.tx.toFixed(3)); root.style.setProperty('--universe-py', pointer.ty.toFixed(3)); wake(); }, { passive: true });
addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; root.style.setProperty('--universe-px', '0'); root.style.setProperty('--universe-py', '0'); wake(); }, { passive: true });
addEventListener('scroll', updateScroll, { passive: true }); addEventListener('resize', resize, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { updateScroll(); wake(); } });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { cancelAnimationFrame(raf); raf = 0; draw(0); } else wake(); });

const palette = ['hero','news','facts','intro','themes','requirements','timeline','jury','source','final'];
const colors = { hero:['#0b65a2','#302077'], news:['#087eb0','#2b2a9a'], facts:['#186d9d','#253e90'], intro:['#087d96','#4e3d9b'], themes:['#1c61b2','#51338e'], requirements:['#157f91','#2a5d9c'], timeline:['#2a79aa','#443d91'], jury:['#0b5e9e','#2e368f'], source:['#217e9f','#4b398e'], final:['#127fc0','#302677'] };
const sections = [...document.querySelectorAll('main > section, main > details')];
sections.forEach((item, index) => { item.dataset.universeScene = palette[index] || 'news'; item.classList.add('universe-section'); });
function setScene(item) { const key = item.dataset.universeScene || 'hero'; const [a,b] = colors[key] || colors.hero; root.style.setProperty('--universe-a', a); root.style.setProperty('--universe-b', b); root.dataset.universeScene = key; }
const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('universe-in-view'); setScene(entry.target); } }), { rootMargin: '-20% 0px -58% 0px', threshold: .03 });
sections.forEach(item => sectionObserver.observe(item));
resize(); updateScroll(); wake();
