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
  const baseSpeed = 7;
  const maxSpeed = 72;

  function updateRing() {
    // The cylinder axis is vertical. Each track is a complete, readable title
    // placed on its own horizontal band, with depth following the cylinder's
    // circular surface rather than interleaving characters from both titles.
    const cylinderHalfLength = Math.max(150, Math.min(520, ring.clientWidth * .43));
    const cylinderRadius = Math.max(70, Math.min(190, ring.clientWidth * .18));
    const cylinderDepth = Math.max(44, Math.min(150, ring.clientWidth * .13));
    const trackOffset = Math.max(86, Math.min(170, ring.clientHeight * .18));
    ring.style.transform = `rotateY(${18 + pointerCurrentX * 16}deg) rotateZ(${-10 + pointerCurrentY * 5}deg)`;
    for (const { element, index, phase } of letters) {
      const u = (index - (phrase.length - 1) / 2) / ((phrase.length - 1) / 2);
      const baseAngle = (angle + phase) * Math.PI / 180;
      const surfaceAngle = baseAngle + u * .46;
      const x = u * cylinderHalfLength;
      const y = (phase === 0 ? -trackOffset : trackOffset) + Math.sin(surfaceAngle) * cylinderRadius;
      const z = Math.cos(surfaceAngle) * cylinderDepth;
      const depth = (z / cylinderDepth + 1) * .5;
      const surfaceTilt = Math.sin(surfaceAngle) * 12;
      const scale = .86 + depth * .14;
      element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${surfaceTilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      element.style.opacity = String(.32 + depth * .68);
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
