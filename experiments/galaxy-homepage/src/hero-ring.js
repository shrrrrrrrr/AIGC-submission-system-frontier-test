const hero = document.querySelector('.hero');
const ring = document.querySelector('.hero-ring');
if (hero && ring) {
  const words = [...ring.querySelectorAll('.ring-word')].map((element) => ({ element, slot: Number(element.dataset.ringSlot || 0) }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = 0;
  let speed = 0;
  let activity = 0;
  let lastPointer = null;
  let lastTime = 0;
  let visible = true;
  let raf = 0;
  const baseSpeed = 9;
  const maxSpeed = 34;

  function updateWords() {
    const radius = Math.max(82, Math.min(220, ring.clientWidth * .37));
    const tilt = -10;
    for (const { element, slot } of words) {
      const orbit = angle + slot;
      const depth = (Math.cos((orbit * Math.PI) / 180) + 1) * .5;
      element.style.transform = `rotate(${orbit}deg) translateX(${radius}px) rotate(${-orbit + tilt}deg)`;
      element.style.opacity = String(.34 + depth * .66);
      element.style.filter = `blur(${(1 - depth) * 1.4}px)`;
      element.style.zIndex = String(Math.round(depth * 10));
      element.style.setProperty('--ring-depth', depth.toFixed(3));
    }
  }
  function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const dt = Math.min(.05, lastTime ? (now - lastTime) / 1000 : 1 / 60);
    lastTime = now;
    const target = reduced.matches ? 0 : baseSpeed + activity * (maxSpeed - baseSpeed);
    speed += (target - speed) * (1 - Math.exp(-8 * dt));
    angle += speed * dt;
    updateWords();
    if (visible && !document.hidden && (!reduced.matches || Math.abs(speed) > .01)) wake();
  }
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    const now = performance.now();
    if (lastPointer) {
      const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
      const velocity = distance / Math.max(8, now - lastPointer.time);
      activity = Math.min(1, activity * .72 + Math.min(1, velocity * 2.5) * .28);
    }
    lastPointer = { x: event.clientX, y: event.clientY, time: now };
    wake();
  });
  hero.addEventListener('pointerleave', () => { lastPointer = null; });
  reduced.addEventListener('change', () => { if (reduced.matches) { activity = 0; speed = 0; } wake(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } else { lastTime = 0; wake(); } });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { lastTime = 0; wake(); } else { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } }, { threshold: .01 }).observe(hero);
  new ResizeObserver(updateWords).observe(ring);
  updateWords();
  wake();
}
