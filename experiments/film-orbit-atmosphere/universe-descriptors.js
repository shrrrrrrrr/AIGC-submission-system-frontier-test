const descriptor = (id, backgroundTexture, cameraPosition, cameraTarget, fogColor, fogNear, fogFar, particleTint, particleIntensity, atmosphereColorA, atmosphereColorB, atmosphereStrength) => ({
  id,
  backgroundTexture,
  cameraPosition,
  cameraTarget,
  fogColor,
  fogNear,
  fogFar,
  particleTint,
  particleIntensity,
  atmosphereColorA,
  atmosphereColorB,
  atmosphereStrength,
});

export const sceneDescriptors = [
  descriptor('hero', 'milkyway-wide.png', { x: 0, y: 0, z: 26 }, { x: 0, y: 0, z: -20 }, '#030915', 16, 90, '#8be5ff', 0.9, '#0b65a2', '#302077', 0.9),
  descriptor('news', 'galaxy-blue.png', { x: 0.8, y: 0.15, z: 25.5 }, { x: 0.1, y: 0.1, z: -19 }, '#041328', 17, 88, '#6cdcff', 1.0, '#087eb0', '#2b2a9a', 1.0),
  descriptor('facts', 'milkyway-blue.png', { x: -0.7, y: -0.1, z: 25.2 }, { x: -0.1, y: -0.1, z: -19.5 }, '#07162d', 18, 92, '#7cc8ff', 0.92, '#186d9d', '#253e90', 0.92),
  descriptor('intro', 'nebula-vertical.png', { x: 0.5, y: 0.3, z: 24.8 }, { x: 0.1, y: 0.18, z: -18.5 }, '#160d2e', 15, 86, '#b4a2ff', 0.98, '#087d96', '#4e3d9b', 1.0),
  descriptor('themes', 'milkyway-purple.png', { x: -0.5, y: 0.05, z: 24.5 }, { x: -0.15, y: 0.05, z: -18.5 }, '#150d35', 15, 88, '#bd9dff', 1.05, '#1c61b2', '#51338e', 1.02),
  descriptor('requirements', 'milkyway-blue.png', { x: 0.65, y: -0.2, z: 24 }, { x: 0.15, y: -0.12, z: -18 }, '#071b2d', 17, 90, '#83eaff', 1.0, '#157f91', '#2a5d9c', 0.98),
  descriptor('timeline', 'nebula-ribbon.png', { x: -0.8, y: 0.15, z: 23.7 }, { x: -0.1, y: 0.08, z: -17.5 }, '#1d0e2b', 14, 84, '#ffb8f4', 1.08, '#2a79aa', '#443d91', 1.04),
  descriptor('jury', 'milkyway-purple.png', { x: 0.35, y: -0.1, z: 23.4 }, { x: 0.1, y: -0.05, z: -17.5 }, '#160c2e', 15, 86, '#c5adff', 1.0, '#0b5e9e', '#2e368f', 1.0),
  descriptor('source', 'galaxy-blue.png', { x: -0.35, y: 0.12, z: 23 }, { x: -0.05, y: 0.05, z: -17 }, '#061629', 16, 88, '#80e5ff', 1.0, '#217e9f', '#4b398e', 0.98),
  descriptor('final', 'milkyway-wide.png', { x: 0, y: 0, z: 22.6 }, { x: 0, y: 0, z: -16.5 }, '#030915', 16, 86, '#9beaff', 1.05, '#127fc0', '#302677', 1.0),
];

export const descriptorById = new Map(sceneDescriptors.map((item) => [item.id, item]));
const lighting = [
  ['#2ce4ff', '#6d5bff', 0.9, 0.035, 0.44, 1.0],
  ['#3adfff', '#655dff', 0.95, 0.038, 0.48, 1.01],
  ['#4ecbff', '#5278ff', 0.84, 0.032, 0.42, 0.99],
  ['#5fe6e8', '#9a63ff', 0.96, 0.043, 0.50, 1.02],
  ['#65d7ff', '#b36bff', 1.02, 0.047, 0.54, 1.03],
  ['#45e5ff', '#647cff', 0.9, 0.036, 0.46, 1.0],
  ['#79dcff', '#ef75d6', 1.06, 0.05, 0.56, 1.04],
  ['#55d9ff', '#b47aff', 0.96, 0.042, 0.5, 1.02],
  ['#44e7ff', '#9b70ff', 0.92, 0.037, 0.47, 1.0],
  ['#56efff', '#806cff', 1.04, 0.046, 0.52, 1.03],
];

sceneDescriptors.forEach((item, index) => {
  const [lightTintA, lightTintB, lightIntensity, atmosphereDensity, bloomStrength, exposure] = lighting[index];
  Object.assign(item, { lightTintA, lightTintB, lightIntensity, atmosphereDensity, bloomStrength, exposure });
});
