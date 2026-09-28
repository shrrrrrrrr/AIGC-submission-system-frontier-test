const hero = document.querySelector('.hero');
const ring = document.querySelector('.hero-ring');
if (hero && ring) {
  const phrase = '生成式VR单元投稿';
  const tracks = [...ring.querySelectorAll('.ring-word-track')];
  const letters = tracks.flatMap((track) => phrase.split('').map((character, index) => {
    const element = document.createElement('span');
    element.className = 'ring-letter';
    element.textContent = character;
    element.setAttribute('aria-hidden', 'true');
    track.append(element);
    return { element, index, phase: Number(track.dataset.ringPhase || 0) };
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = 0;
  let speed = 0;
  let activity = 0;
  let pointerActivity = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;
  let lastPointer = null;
  let lastTime = 0;
  let visible = true;
  let raf = 0;
  const baseSpeed = 4.5;
  const maxSpeed = 72;

  function updateRing() {
    const radiusX = Math.max(108, Math.min(250, ring.clientWidth * .39));
    const radiusY = Math.max(58, Math.min(145, ring.clientHeight * .30));
    const depthRadius = Math.max(20, Math.min(72, ring.clientWidth * .10));
    ring.style.transform = `rotateX(${61 + pointerCurrentY * 10}deg) rotateY(${pointerCurrentX * 18}deg) rotateZ(-10deg)`;
    for (const { element, index, phase } of letters) {
      const orbit = angle + phase + index * (360 / phrase.length);
      const radians = orbit * Math.PI / 180;
      const depth = (Math.sin(radians) + 1) * .5;
      const x = Math.cos(radians) * radiusX;
      const y = Math.sin(radians) * radiusY;
      const z = (depth - .5) * depthRadius;
      element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px)`;
      element.style.opacity = String(.18 + depth * .82);
      element.style.filter = `blur(${((1 - depth) * 1.2).toFixed(2)}px)`;
      element.style.zIndex = String(Math.round(depth * 100));
      element.style.setProperty('--ring-depth', depth.toFixed(3));
    }
  }
  function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const dt = Math.min(.05, lastTime ? (now - lastTime) / 1000 : 1 / 60);
    lastTime = now;
    activity *= Math.exp(-4.2 * dt);
    pointerActivity *= Math.exp(-5.4 * dt);
    pointerCurrentX += (pointerTargetX - pointerCurrentX) * (1 - Math.exp(-10 * dt));
    pointerCurrentY += (pointerTargetY - pointerCurrentY) * (1 - Math.exp(-10 * dt));
    const target = reduced.matches ? 0 : baseSpeed + activity * (maxSpeed - baseSpeed);
    speed += (target - speed) * (1 - Math.exp(-8 * dt));
    angle += speed * dt;
    updateRing();
    if (visible && !document.hidden && (!reduced.matches || Math.abs(speed) > .01)) wake();
  }
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    const now = performance.now();
    if (lastPointer) {
      const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
      const velocity = distance / Math.max(8, now - lastPointer.time);
      pointerActivity = Math.min(1, pointerActivity * .54 + Math.min(1, velocity * 4.2) * .46);
      activity = Math.min(1, activity + pointerActivity * .52);
    }
    pointerTargetX = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1));
    pointerTargetY = Math.max(-1, Math.min(1, 1 - event.clientY / innerHeight * 2));
    lastPointer = { x: event.clientX, y: event.clientY, time: now };
    wake();
  });
  hero.addEventListener('pointerleave', () => { lastPointer = null; pointerTargetX = 0; pointerTargetY = 0; });
  reduced.addEventListener('change', () => { if (reduced.matches) { activity = 0; pointerActivity = 0; speed = 0; pointerTargetX = 0; pointerTargetY = 0; } wake(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } else { lastTime = 0; wake(); } });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { lastTime = 0; wake(); } else { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } }, { threshold: .01 }).observe(hero);
  new ResizeObserver(updateRing).observe(ring);
  updateRing();
  wake();
}
