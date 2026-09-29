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
    // The cylinder axis runs left-to-right. Characters retain a readable
    // horizontal order while their y/z coordinates roll around the surface.
    const axisHalfLength = Math.max(150, Math.min(520, ring.clientWidth * .43));
    const radius = Math.max(70, Math.min(220, ring.clientHeight * .34));
    const depthRadius = Math.max(44, Math.min(150, ring.clientWidth * .13));
    ring.style.perspective = `${ring.clientWidth * 2.4}px`;
    const motionScroll = reduced.matches ? 0 : scrollCurrent;
    const scrollTurn = motionScroll * 72;
    ring.style.transform = `rotateX(${14 + motionScroll * 18}deg) rotateY(${pointerCurrentX * 18}deg) rotateZ(${-5 + motionScroll * 8}deg) scale(${(1 - motionScroll * .2).toFixed(3)})`;
    for (const track of tracks) {
      track.style.transform = `rotateX(${-22 + pointerCurrentY * 8}deg) rotateY(${pointerCurrentX * 12}deg)`;
    }
    for (const { element, index, phase } of letters) {
      const trackPhase = phase === 0 ? -70 : 70;
      const theta = (angle + scrollTurn + trackPhase + (index - (phrase.length - 1) / 2) * 8.5) * Math.PI / 180;
      const x = ((index - (phrase.length - 1) / 2) / ((phrase.length - 1) / 2)) * axisHalfLength;
      const y = Math.sin(theta) * radius;
      const z = Math.cos(theta) * depthRadius;
      const depth = (Math.cos(theta) + 1) * .5;
      const surfaceTilt = Math.sin(theta) * 14;
      element.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, ${z.toFixed(3)}px) rotateX(${surfaceTilt.toFixed(3)}deg)`;
      element.style.opacity = String(.78 + depth * .22);
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
