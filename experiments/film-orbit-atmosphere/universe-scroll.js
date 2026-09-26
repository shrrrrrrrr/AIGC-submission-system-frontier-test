const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (current, target, lambda, delta) => current + (target - current) * (1 - Math.exp(-lambda * delta));

export function createScrollState({ root, reducedMotion, finePointer }) {
  const target = { scroll: 0, scrollY: 0, maxScroll: 1, scrollVelocity: 0, pointerX: 0, pointerY: 0 };
  const current = { scroll: 0, scrollY: 0, maxScroll: 1, scrollVelocity: 0, pointerX: 0, pointerY: 0 };
  let previousScrollY = window.scrollY;
  let lastScrollTime = performance.now();
  let renderRequest = null;

  const updateCssState = () => {
    root.style.setProperty('--universe-scroll', target.scroll.toFixed(3));
    root.style.setProperty('--universe-px', target.pointerX.toFixed(3));
    root.style.setProperty('--universe-py', target.pointerY.toFixed(3));
  };

  const updateScrollTarget = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const now = performance.now();
    const delta = Math.max(1, now - lastScrollTime);
    const velocity = ((window.scrollY - previousScrollY) / delta) * 16.67;
    target.maxScroll = maxScroll;
    target.scrollY = Math.max(0, window.scrollY);
    target.scroll = clamp(target.scrollY / maxScroll, 0, 1);
    target.scrollVelocity = clamp(velocity, -2.5, 2.5);
    previousScrollY = window.scrollY;
    lastScrollTime = now;
    updateCssState();
    renderRequest?.();
  };

  const updatePointerTarget = (event) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    target.pointerX = (event.clientX / Math.max(1, window.innerWidth) - .5) * 2;
    target.pointerY = (event.clientY / Math.max(1, window.innerHeight) - .5) * 2;
    updateCssState();
    renderRequest?.();
  };

  const resetPointerTarget = () => {
    target.pointerX = 0;
    target.pointerY = 0;
    updateCssState();
    renderRequest?.();
  };

  const onReducedMotionChange = () => {
    if (reducedMotion.matches) resetPointerTarget();
    renderRequest?.();
  };

  addEventListener('scroll', updateScrollTarget, { passive: true });
  addEventListener('pointermove', updatePointerTarget, { passive: true });
  addEventListener('pointerleave', resetPointerTarget, { passive: true });
  reducedMotion.addEventListener('change', onReducedMotionChange);
  updateScrollTarget();

  return {
    target,
    current,
    setRenderRequest(callback) { renderRequest = callback; },
    step(deltaSeconds) {
      const motion = reducedMotion.matches ? 0 : 1;
      current.maxScroll = target.maxScroll;
      current.scrollY = damp(current.scrollY, target.scrollY, 8, deltaSeconds);
      current.scroll = clamp(current.scrollY / Math.max(1, current.maxScroll), 0, 1);
      current.pointerX = damp(current.pointerX, target.pointerX * motion, 5, deltaSeconds);
      current.pointerY = damp(current.pointerY, target.pointerY * motion, 5, deltaSeconds);
      current.scrollVelocity = damp(current.scrollVelocity, target.scrollVelocity * motion, 9, deltaSeconds);
      target.scrollVelocity = damp(target.scrollVelocity, 0, 5, deltaSeconds);
    },
    dispose() {
      removeEventListener('scroll', updateScrollTarget);
      removeEventListener('pointermove', updatePointerTarget);
      removeEventListener('pointerleave', resetPointerTarget);
      reducedMotion.removeEventListener('change', onReducedMotionChange);
      renderRequest = null;
    },
  };
}