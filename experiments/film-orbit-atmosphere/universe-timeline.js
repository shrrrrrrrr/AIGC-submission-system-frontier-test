const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createSceneTimeline(sections, descriptors) {
  let entries = [];
  let maxScroll = 0;

  function rebuild() {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const viewportMidpoint = window.innerHeight * 0.5;
    let previousAnchor = 0;
    entries = sections.map((section, index) => {
      const rect = section.getBoundingClientRect();
      const start = rect.top + window.scrollY;
      const height = Math.max(1, rect.height);
      const descriptor = descriptors[index] || descriptors[descriptors.length - 1];
      const center = start + height * 0.5;
      const scrollAnchor = Math.max(previousAnchor, clamp(center - viewportMidpoint, 0, maxScroll));
      previousAnchor = scrollAnchor;
      return {
        id: descriptor.id,
        index,
        start,
        center,
        end: start + height,
        height,
        scrollAnchor,
      };
    });
    return entries;
  }

  function resolve(scrollY) {
    if (!entries.length) return { a: 0, b: 0, progress: 0, rawProgress: 0 };
    if (scrollY <= entries[0].scrollAnchor) return { a: 0, b: 0, progress: 0, rawProgress: 0 };
    const last = entries.length - 1;
    if (scrollY >= entries[last].scrollAnchor) return { a: last, b: last, progress: 0, rawProgress: 0 };

    for (let index = 0; index < last; index += 1) {
      const start = entries[index].scrollAnchor;
      const end = entries[index + 1].scrollAnchor;
      if (scrollY <= end) {
        const rawProgress = clamp((scrollY - start) / Math.max(1, end - start), 0, 1);
        const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
        return { a: index, b: index + 1, progress, rawProgress };
      }
    }
    return { a: last, b: last, progress: 0, rawProgress: 0 };
  }

  rebuild();
  return { rebuild, resolve, get entries() { return entries; } };
}