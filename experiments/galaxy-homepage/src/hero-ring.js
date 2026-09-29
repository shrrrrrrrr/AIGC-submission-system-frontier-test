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
  let scrollTarget = 0;
  let scrollCurrent = 0;
  let lastPointer = null;
  let lastTime = 0;
  let visible = true;
  let raf = 0;
  const baseSpeed = 7;
  const maxSpeed = 72;

  function updateRing() {
    // One shared horizontal cylinder rotation drives both complete phrases.
    // Each glyph is fixed to the same cylindrical surface; the rear half is
    // mirrored so it becomes readable again as it rolls into the front.
    const radiusX = Math.max(180, Math.min(520, ring.clientWidth * .40));
    const radiusY = Math.max(120, Math.min(230, ring.clientHeight * .34));
    const depthRadius = Math.max(44, Math.min(150, ring.clientWidth * .13));
    const step = 144 / (phrase.length - 1);
    ring.style.perspective = `${ring.clientWidth * 2.4}px`;
    const motionScroll = reduced.matches ? 0 : scrollCurrent;
    const scrollTurn = motionScroll * 72;
    ring.style.transform = `rotateX(${14 + motionScroll * 18}deg) rotateY(${pointerCurrentX * 18}deg) rotateZ(${-5 + motionScroll * 8}deg) scale(${(1 - motionScroll * .2).toFixed(3)})`;
    for (const track of tracks) {
      track.style.transform = `rotateX(${pointerCurrentY * 8}deg)`;
    }
    for (const { element, index, phase } of letters) {
      const trackPhase = phase === 0 ? 0 : 180;
      const offset = (index - (phrase.length - 1) / 2) * step;
      const theta = (-(angle + scrollTurn + trackPhase) + offset) * Math.PI / 180;
      const x = Math.sin(theta) * radiusX;
      const y = Math.cos(theta) * radiusY;
      const z = Math.cos(theta) * depthRadius;
      const depth = (Math.cos(theta) + 1) * .5;
      const scale = .74 + depth * .32;
      const mirror = z < 0 ? -1 : 1;
      const surfaceTilt = theta * .42;
      element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, ${z.toFixed(3)}px) rotateZ(${surfaceTilt.toFixed(3)}rad) scale(${(scale * mirror).toFixed(3)}, ${scale.toFixed(3)})`;
      element.style.opacity = String(.2 + depth * .8);
      element.style.zIndex = String(Math.round(depth * 100));
      element.style.filter = 'none';
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
    scrollCurrent += (scrollTarget - scrollCurrent) * (1 - Math.exp(-8 * dt));
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
  const updateScrollTarget = () => {
    const rect = hero.getBoundingClientRect();
    scrollTarget = Math.max(0, Math.min(1, -rect.top / Math.max(1, hero.offsetHeight * .8)));
    wake();
  };
  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  reduced.addEventListener('change', () => { if (reduced.matches) { activity = 0; pointerActivity = 0; speed = 0; scrollCurrent = 0; pointerTargetX = 0; pointerTargetY = 0; } wake(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } else { lastTime = 0; wake(); } });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { lastTime = 0; wake(); } else { cancelAnimationFrame(raf); raf = 0; lastTime = 0; } }, { threshold: .01 }).observe(hero);
  new ResizeObserver(updateRing).observe(ring);
  updateScrollTarget();
  updateRing();
  wake();
}
