export const PALETTE = [
  '#E8A0A8', // rose
  '#A0C8E8', // sky blue
  '#A8D4A0', // sage green
  '#E8C8A0', // peach
  '#B8A8D8', // lavender
  '#80C4B8', // teal
  '#E8B880', // warm orange
  '#A8B8D8', // steel blue
  '#C8D890', // yellow green
  '#D4A8C0', // mauve
  '#98C8D0', // powder blue
  '#D8B890', // tan
  '#B0D0A8', // mint
  '#C0A8D8', // periwinkle
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rectWeight(area, targetArea) {
  if (area < 2) return 0;
  const sigma = targetArea * 0.75;
  return Math.exp(-0.5 * ((area - targetArea) / sigma) ** 2);
}

function attemptGenerate(size, targetCount) {
  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  const rects = [];
  let id = 0;
  const targetArea = (size * size) / targetCount;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== -1) continue;
      const candidates = [];
      for (let c2 = c; c2 < size; c2++) {
        if (grid[r][c2] !== -1) break;
        let maxR2 = r;
        expand: while (maxR2 + 1 < size) {
          for (let cc = c; cc <= c2; cc++) {
            if (grid[maxR2 + 1][cc] !== -1) break expand;
          }
          maxR2++;
        }
        for (let r2 = r; r2 <= maxR2; r2++) {
          const area = (r2 - r + 1) * (c2 - c + 1);
          candidates.push({ r2, c2, area });
        }
      }
      if (candidates.length === 0) candidates.push({ r2: r, c2: c, area: 1 });

      const weights = candidates.map(cd => rectWeight(cd.area, targetArea));
      const total = weights.reduce((a, b) => a + b, 0);
      let chosen = candidates[0];
      if (total > 0) {
        let rand = Math.random() * total;
        for (let i = 0; i < candidates.length; i++) {
          rand -= weights[i];
          if (rand <= 0) { chosen = candidates[i]; break; }
        }
      }
      const { r2, c2, area } = chosen;
      for (let rr = r; rr <= r2; rr++)
        for (let cc = c; cc <= c2; cc++)
          grid[rr][cc] = id;
      rects.push({ id, r1: r, c1: c, r2, c2, area, rows: r2-r+1, cols: c2-c+1 });
      id++;
    }
  }
  return rects;
}

// Returns: 'square' | 'tall' | 'wide' | 'any'
// ~30% of non-square rects randomly become 'any'
function getShapeHint(rows, cols, seed) {
  if (rows === cols) return 'square';
  const rng = (seed * 9301 + 49297) % 233280;
  if ((rng / 233280) < 0.30) return 'any';
  return rows > cols ? 'tall' : 'wide';
}

export function generatePuzzle(size) {
  const targetMin = size;
  const targetMax = Math.round(size * 1.45);
  const targetCount = Math.round((targetMin + targetMax) / 2);

  let rects;
  for (let attempt = 0; attempt < 120; attempt++) {
    rects = attemptGenerate(size, targetCount);
    const count = rects.length;
    const hasOnes = rects.some(r => r.area === 1);
    if (!hasOnes && count >= targetMin && count <= targetMax) break;
  }

  const paletteIndices = shuffle([...Array(PALETTE.length).keys()]);
  const rectColors = {};
  rects.forEach((rect, i) => { rectColors[rect.id] = paletteIndices[i % PALETTE.length]; });

  const clues = {};
  rects.forEach(rect => {
    const cells = [];
    for (let r = rect.r1; r <= rect.r2; r++)
      for (let c = rect.c1; c <= rect.c2; c++)
        cells.push([r, c]);
    const [nr, nc] = cells[Math.floor(Math.random() * cells.length)];
    const shapeHint = getShapeHint(rect.rows, rect.cols, rect.id * 137 + nr * 31 + nc);
    // ~40% of tiles hide the number — only shape hint shown
    const numRng = ((rect.id * 6271 + nr * 1481 + nc * 331) % 1000) / 1000;
    const showNumber = numRng >= 0.40;
    clues[`${nr},${nc}`] = {
      area: rect.area, rectId: rect.id,
      paletteIdx: rectColors[rect.id],
      rows: rect.rows, cols: rect.cols,
      shapeHint, showNumber,
    };
  });

  return { size, clues, rectangles: rects, rectColors };
}
