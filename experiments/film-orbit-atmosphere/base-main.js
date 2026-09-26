import './style.css';
import { news } from './news.js';

const stage = document.querySelector('#stage');
const world = document.querySelector('#world');
const container = document.querySelector('#frames');
const currentLink = document.querySelector('#current-link');
const counter = document.querySelector('#counter');
const announcement = document.querySelector('#announcement');
document.querySelector('#tracking')?.remove();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const segment = Math.PI * 2 / (news.length * 2);
const count = news.length * 2;
let phase = 0, target = 0, velocity = 0, raf = 0, lastTime = 0;
let active = -1, scale = 1, pointer = null, suppressClick = false;
let follow = !reducedMotion.matches, hoverVelocity = 0, hovered = false, overFrame = false, visible = true;

function safeLink(href) {
  const url = new URL(href);
  if (url.protocol !== 'https:' || url.hostname !== 'mp.weixin.qq.com') throw new Error('资讯链接不在允许的平台内');
  return url.href;
}

const cards = Array.from({ length: count }, (_, index) => {
  const item = news[index % news.length];
  const link = document.createElement('a');
  link.className = 'film-frame'; link.href = safeLink(item.href); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.tabIndex = -1;
  link.setAttribute('aria-label', item.title); link.setAttribute('aria-hidden', 'true'); link.draggable = false;
  const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.draggable = false;
  const label = document.createElement('span'); label.className = 'frame-index'; label.textContent = `${String(index % news.length + 1).padStart(2, '0')} / CHINAVR`;
  link.append(image, label); container.append(link); return link;
});

for (const item of news) {
  const link = document.createElement('a'); link.href = safeLink(item.href); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${item.title} ↗`;
  document.querySelector('#news-list').append(link);
}

function render() {
  let nearest = 0; let maxDepth = -Infinity;
  cards.forEach((card, index) => {
    const angle = index * segment + phase;
    const depth = Math.cos(angle);
    const x = Math.sin(angle) * 385;
    const y = depth * 58 - x * .18;
    const size = .84 + depth * .16;
    const turn = Math.asin(Math.sin(angle)) * 180 / Math.PI;
    card.style.transform = `translate(-50%, -50%) translate3d(${x}px,${y}px,0) rotate(-12deg) perspective(900px) rotateY(${turn * .82}deg) scale(${size})`;
    card.style.zIndex = depth >= 0 ? String(30 + Math.round(depth * 10)) : String(2 + Math.round((depth + 1) * 5));
    card.style.opacity = depth >= 0 ? '1' : String(.25 + (depth + 1) * .3);
    card.dataset.front = String(depth >= 0);
    if (depth > maxDepth) { maxDepth = depth; nearest = index; }
  });
  cards.forEach((card, index) => { card.dataset.active = String(index === nearest); });
  const nextActive = nearest % news.length;
  if (nextActive !== active) {
    active = nextActive;
    currentLink.textContent = `${news[active].title} ↗`;
    currentLink.href = safeLink(news[active].href);
    counter.textContent = `${String(active + 1).padStart(2, '0')} / 05`;
  }
}

function resize() {
  scale = Math.min(stage.clientWidth / 1100, 1.12);
  world.style.transform = `translateX(-50%) scale(${scale})`;
  stage.style.height = `${610 * scale}px`;
}

function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }

function tick(time) {
  raf = 0;
  const dt = Math.min((time - (lastTime || time)) / 1000, .032);
  lastTime = time;
  if (!pointer && !overFrame) {
    const idle = reducedMotion.matches ? 0 : .06;
    const pointerDrive = follow && !reducedMotion.matches && finePointer.matches && hovered ? hoverVelocity : 0;
    target += (idle + pointerDrive) * dt;
    if (reducedMotion.matches) { phase = target; velocity = 0; }
    else { velocity += ((target - phase) * 100 - velocity * 10) * dt; phase += velocity * dt; }
  }
  render();
  if (visible && !document.hidden && (!pointer || Math.abs(velocity) > .0001 || !overFrame)) wake();
  else lastTime = 0;
}

function advance(direction) {
  hoverVelocity = 0; target += direction * segment;
  if (reducedMotion.matches) { phase = target; velocity = 0; render(); } else wake();
  const index = ((Math.round(-target / segment) % news.length) + news.length) % news.length;
  announcement.textContent = news[index].title;
}

document.querySelector('#previous').addEventListener('click', () => advance(-1));
document.querySelector('#next').addEventListener('click', () => advance(1));

stage.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return;
  pointer = { id: event.pointerId, startX: event.clientX, phase, moved: false, lastX: event.clientX, lastTime: event.timeStamp };
  suppressClick = false; velocity = 0; hoverVelocity = 0;
});
stage.addEventListener('pointermove', event => {
  if (pointer) {
    if (pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    if (!pointer.moved && Math.abs(dx) > 7) { pointer.moved = true; stage.setPointerCapture(event.pointerId); stage.classList.add('dragging'); }
    if (pointer.moved) {
      const elapsed = Math.max(event.timeStamp - pointer.lastTime, 8) / 1000;
      velocity = Math.max(-4, Math.min(4, (event.clientX - pointer.lastX) / (scale * 385 * elapsed)));
      target = pointer.phase + dx / (scale * 385); phase = target; render();
      pointer.lastX = event.clientX; pointer.lastTime = event.timeStamp;
    }
    return;
  }
  if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
  hovered = true;
  const frameUnderPointer = event.target.closest('.film-frame');
  if (frameUnderPointer) { overFrame = true; hoverVelocity = 0; velocity = 0; wake(); return; }
  if (overFrame) { overFrame = false; velocity = 0; }
  const bounds = stage.getBoundingClientRect();
  const distance = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
  hoverVelocity = Math.abs(distance) < .12 ? 0 : distance * .9;
  wake();
});

function finish(event, cancelled = false) {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dragged = pointer.moved; pointer = null;
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  stage.classList.remove('dragging');
  if (dragged) { suppressClick = true; if (cancelled) velocity = 0; else target += velocity * .12; wake(); }
}
stage.addEventListener('pointerup', event => finish(event));
stage.addEventListener('pointercancel', event => finish(event, true));
window.addEventListener('pointerup', event => finish(event));
stage.addEventListener('lostpointercapture', event => finish(event, true));
stage.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; } }, true);
stage.addEventListener('dragstart', event => event.preventDefault());
stage.addEventListener('pointerleave', () => { hovered = false; overFrame = false; hoverVelocity = 0; wake(); });
window.addEventListener('blur', () => { hovered = false; overFrame = false; hoverVelocity = 0; if (pointer) finish({ pointerId: pointer.id }, true); wake(); });
reducedMotion.addEventListener('change', () => { follow = !reducedMotion.matches; overFrame = false; velocity = 0; phase = target; render(); wake(); });
document.addEventListener('visibilitychange', () => { lastTime = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake(); });
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } }).observe(stage);
new ResizeObserver(resize).observe(stage);
new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); }), { threshold: .12 }).observe(document.querySelector('.hero'));
document.querySelectorAll('[data-reveal]:not(.hero)').forEach(element => new IntersectionObserver(([entry], observer) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.disconnect(); } }, { threshold: .12 }).observe(element));
resize(); render(); wake();
