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