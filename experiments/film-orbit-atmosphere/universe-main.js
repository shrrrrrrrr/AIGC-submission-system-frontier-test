import './base-main.js';
import './universe.css';
import { createScrollState } from './universe-scroll.js';
import { sceneDescriptors } from './universe-descriptors.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const scene = document.createElement('div');
scene.className = 'universe-scene';
scene.setAttribute('aria-hidden', 'true');
scene.innerHTML = '<div class="space-image"></div><div class="nebula-layer"></div><canvas class="universe-particles"></canvas><div class="vignette"></div>';
document.body.prepend(scene);

const sections = [...document.querySelectorAll('main > section')];
const revealItems = [...document.querySelectorAll('main > section, main > details')];
sections.forEach((item, index) => {
  item.dataset.universeScene = sceneDescriptors[index]?.id || sceneDescriptors[sceneDescriptors.length - 1].id;
  item.classList.add('universe-section');
});

const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.classList.add('universe-in-view');
}), { rootMargin: '-20% 0px -58% 0px', threshold: .03 });
revealItems.forEach((item) => sectionObserver.observe(item));

const input = createScrollState({ root: document.documentElement, reducedMotion, finePointer });

export { scene, sections, sceneDescriptors, input, reducedMotion };
