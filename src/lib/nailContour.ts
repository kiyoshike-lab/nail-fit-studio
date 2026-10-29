export type ContourPoint = { x: number; y: number };

// Trace exposed cell edges, rather than treating an unordered collection of
// boundary samples as a polygon. Complex/ambiguous traces fail closed.
export function traceNailContour(inside: Uint8Array, width: number, height: number, point: (x: number, y: number) => ContourPoint): ContourPoint[] | undefined {
  const region = traceNailRegion(inside, width, height, point);
  return region && !region.holes.length ? region.contour : undefined;
}

// Keep internal colour gaps as holes, NOT a convex hull that fills intervening
// skin/occluders. Multiple disconnected OUTER rings remain ambiguous and fail.
export function traceNailRegion(inside: Uint8Array, width: number, height: number, point: (x: number, y: number) => ContourPoint): { contour: ContourPoint[]; holes: ContourPoint[][] } | undefined {
  const stride = width + 1;
  const edges = new Map<number, number[]>();
  const add = (x: number, y: number, dx: number, dy: number) => {
    const key = y * stride + x;
    const destinations = edges.get(key) ?? [];
    destinations.push((y + dy) * stride + x + dx); edges.set(key, destinations);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!inside[y * width + x]) continue;
    if (!y || !inside[(y - 1) * width + x]) add(x, y, 1, 0);
    if (x === width - 1 || !inside[y * width + x + 1]) add(x + 1, y, 0, 1);
    if (y === height - 1 || !inside[(y + 1) * width + x]) add(x + 1, y + 1, -1, 0);
    if (!x || !inside[y * width + x - 1]) add(x, y + 1, 0, -1);
  }
  // Touching contour branches or multiple rings can include occluders/holes.
  // Do not bridge these with a convex hull and paint the intervening skin.
  if ([...edges.values()].some(destinations => destinations.length !== 1)) return;
  const rings: ContourPoint[][] = [];
  let totalCorners = 0;
  while (edges.size) {
    const first = edges.keys().next().value!;
    const loop: number[] = [];
    let current = first;
    do {
      const next = edges.get(current)?.[0];
      if (next === undefined || loop.length > width * height * 4) return;
      loop.push(current); edges.delete(current); current = next;
    } while (current !== first);
    if (loop.length < 4) return;
    const signedArea = loop.reduce((sum, key, index) => {
      const next = loop[(index + 1) % loop.length];
      return sum + key % stride * Math.floor(next / stride) - next % stride * Math.floor(key / stride);
    }, 0);
    if ((!rings.length && signedArea <= 0) || (rings.length && signedArea >= 0)) return;
    const corners = loop.filter((key, index) => {
      const previous = loop[(index + loop.length - 1) % loop.length], next = loop[(index + 1) % loop.length];
      return (key % stride - previous % stride) * (Math.floor(next / stride) - Math.floor(key / stride))
        !== (Math.floor(key / stride) - Math.floor(previous / stride)) * (next % stride - key % stride);
    });
    totalCorners += corners.length;
    if (totalCorners > 128 || rings.length >= 17) return;
    rings.push(corners.map(key => point(key % stride - 0.5, Math.floor(key / stride) - 0.5)));
  }
  return rings.length ? { contour: rings[0], holes: rings.slice(1) } : undefined;
}
