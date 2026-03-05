/** Euclidean pixel distance between two [lat, lng] coordinate pairs. */
export function pixelDistance(
  p1: [number, number],
  p2: [number, number],
): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

const NICE_STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000];

/** Pick the largest "nice" real-world distance that fits within `maxPixels`. */
export function pickNiceDistance(
  pixelsPerUnit: number,
  maxPixels: number,
): { distance: number; barPixels: number } {
  let best = { distance: 1, barPixels: pixelsPerUnit };
  for (const step of NICE_STEPS) {
    const bar = step * pixelsPerUnit;
    if (bar <= maxPixels) {
      best = { distance: step, barPixels: bar };
    }
  }
  return best;
}
