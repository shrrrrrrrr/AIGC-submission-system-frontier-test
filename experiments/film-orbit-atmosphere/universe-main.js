import './base-main.js';
import './universe.css';
import { createScrollState } from './universe-scroll.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const scene = document.createElement('div');
scene.className = 'universe-scene';
scene.setAttribute('aria-hidden', 'true');
scene.innerHTML = '<div class="space-image"></div><div class="nebula-layer"></div><canvas class="universe-particles"></canvas><div class="vignette"></div>';
document.body.prepend(scene);

const palette = ['hero','news','facts','intro','themes','requirements','timeline','jury','source','final'];
const colors = {
  hero: ['#0b65a2', '#302077'], news: ['#087eb0', '#2b2a9a'], facts: ['#186d9d', '#253e90'],
  intro: ['#087d96', '#4e3d9b'], themes: ['#1c61b2', '#51338e'], requirements: ['#157f91', '#2a5d9c'],
  timeline: ['#2a79aa', '#443d91'], jury: ['#0b5e9e', '#2e368f'], source: ['#217e9f', '#4b398e'], final: ['#127fc0', '#302677'],
};
const sections = [...document.querySelectorAll('main > section, main > details')];
sections.forEach((item, index) => {
  item.dataset.universeScene = palette[index] || 'news';
  item.classList.add('universe-section');
});

function setScene(item) {
  const key = item.dataset.universeScene || 'hero';
  const [a, b] = colors[key] || colors.hero;
  root.style.setProperty('--universe-a', a);
  root.style.setProperty('--universe-b', b);
  root.dataset.universeScene = key;
}

const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) {
    entry.target.classList.add('universe-in-view');
    setScene(entry.target);
  }
}), { rootMargin: '-20% 0px -58% 0px', threshold: .03 });
sections.forEach((item) => sectionObserver.observe(item));

const input = createScrollState({ root, reducedMotion, finePointer });

export { scene, input, reducedMotion };
