import { useState, useCallback, useEffect, useRef } from "react";

// Soft pastel palette matching LinkedIn Patches aesthetic
const PALETTE = [
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

// Determine the generalized shape hint for the tile SVG
// Returns: 'square' | 'tall' | 'wide' | 'any'
// ~30% of non-square rects randomly become 'any'
function getShapeHint(rows, cols, seed) {
  if (rows === cols) return 'square';
  // Use seed for determinism per-rect
  const rng = (seed * 9301 + 49297) % 233280;
  if ((rng / 233280) < 0.30) return 'any';
  return rows > cols ? 'tall' : 'wide';
}

function generatePuzzle(size) {
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

function normalize(r1, c1, r2, c2) {
  return { r1: Math.min(r1,r2), c1: Math.min(c1,c2), r2: Math.max(r1,r2), c2: Math.max(c1,c2) };
}

function formatTime(s) {
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

export default function App() {
  const [difficulty, setDifficulty] = useState('medium');
  const [puzzle, setPuzzle] = useState(null);
  const [playerGrid, setPlayerGrid] = useState(null);
  const [confirmedRectIds, setConfirmedRectIds] = useState(new Set());
  const [playerRects, setPlayerRects] = useState([]);
  const [selection, setSelection] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [solved, setSolved] = useState(false);
  const [nextId, setNextId] = useState(0);
  const [toast, setToast] = useState('');
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const toastRef = useRef(null);
  const timerRef = useRef(null);
  const stateRef = useRef({});

  stateRef.current = { playerGrid, playerRects, puzzle, nextId, selection, dragStart, confirmedRectIds };

  const sizeMap = { easy: 5, medium: 7, hard: 9 };

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2200);
  };

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!solved && puzzle) {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [solved, puzzle]);

  const newPuzzle = useCallback(() => {
    const size = sizeMap[difficulty];
    const p = generatePuzzle(size);
    setPuzzle(p);
    setPlayerGrid(Array.from({ length: size }, () => Array(size).fill(-1)));
    setPlayerRects([]);
    setConfirmedRectIds(new Set());
    setSelection(null);
    setDragStart(null);
    setSolved(false);
    setNextId(0);
    setMoves(0);
    setTime(0);
    setToast('');
  }, [difficulty]);

  useEffect(() => { newPuzzle(); }, [difficulty]);

  const finalize = () => {
    const { dragStart, selection, playerGrid, playerRects, puzzle, nextId, confirmedRectIds } = stateRef.current;
    if (!dragStart || !selection || !puzzle || !playerGrid) {
      setDragStart(null); setSelection(null); return;
    }

    const { r1, c1, r2, c2 } = selection;
    const drawnArea = (r2 - r1 + 1) * (c2 - c1 + 1);
    const drawnRows = r2 - r1 + 1;
    const drawnCols = c2 - c1 + 1;
    let blocked = false;
    const cluesInSel = [];

    outer: for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (playerGrid[r][c] !== -1) { blocked = true; break outer; }
        const cl = puzzle.clues[`${r},${c}`];
        if (cl) cluesInSel.push(cl);
      }
    }

    if (!blocked) {
      if (cluesInSel.length === 0) {
        showToast('Rectangle must contain a clue tile');
      } else if (cluesInSel.length > 1) {
        showToast('Cannot cover two clue tiles');
      } else {
        const clue = cluesInSel[0];
        const { paletteIdx, rectId, shapeHint, showNumber } = clue;
        const correct = clue.area === drawnArea;

        // Shape-type mismatch toast — only for tiles that show a number AND aren't 'any'
        if (!correct && showNumber && shapeHint !== 'any') {
          let shapeOk = true;
          if (shapeHint === 'square') shapeOk = drawnRows === drawnCols;
          else if (shapeHint === 'tall') shapeOk = drawnRows > drawnCols;
          else if (shapeHint === 'wide') shapeOk = drawnCols > drawnRows;
          if (!shapeOk) {
            const labels = { square: 'a square', tall: 'a tall rectangle', wide: 'a wide rectangle' };
            showToast(`Shape must be ${labels[shapeHint]}`);
          }
        }

        const id = nextId;
        const newRect = { id, r1, c1, r2, c2, paletteIdx, rectId, correct, drawnArea };
        const newPR = [...playerRects, newRect];
        const newPG = playerGrid.map(row => [...row]);
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++)
            newPG[r][c] = id;

        const newConfirmed = new Set([...confirmedRectIds]);
        if (correct) newConfirmed.add(rectId);

        setPlayerRects(newPR);
        setPlayerGrid(newPG);
        setConfirmedRectIds(newConfirmed);
        setNextId(id + 1);
        setMoves(m => m + 1);

        // Only solve when every cell filled AND every placed rect is correct
        if (newPG.every(row => row.every(v => v !== -1)) && newPR.every(r => r.correct)) {
          setSolved(true);
        }
      }
    }

    setDragStart(null);
    setSelection(null);
  };

  useEffect(() => {
    window.addEventListener('mouseup', finalize);
    return () => window.removeEventListener('mouseup', finalize);
  }, []);

  const handleMouseDown = (r, c, e) => {
    e.preventDefault();
    if (solved) return;
    const { playerGrid, playerRects, confirmedRectIds } = stateRef.current;
    if (!playerGrid) return;
    if (playerGrid[r][c] !== -1) {
      const playerId = playerGrid[r][c];
      const removed = playerRects.find(rx => rx.id === playerId);
      const newPR = playerRects.filter(rx => rx.id !== playerId);
      const newPG = playerGrid.map(row => row.map(v => v === playerId ? -1 : v));
      const newConf = new Set(confirmedRectIds);
      if (removed) newConf.delete(removed.rectId);
      setPlayerRects(newPR);
      setPlayerGrid(newPG);
      setConfirmedRectIds(newConf);
      return;
    }
    setDragStart({ r, c });
    setSelection({ r1: r, c1: c, r2: r, c2: c });
  };

  const handleMouseEnter = (r, c) => {
    const { dragStart } = stateRef.current;
    if (!dragStart) return;
    setSelection(normalize(dragStart.r, dragStart.c, r, c));
  };

  const handleReset = () => {
    if (!puzzle) return;
    setPlayerGrid(Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(-1)));
    setPlayerRects([]);
    setConfirmedRectIds(new Set());
    setSelection(null);
    setDragStart(null);
    setSolved(false);
    setNextId(0);
    setMoves(0);
    // Timer intentionally NOT reset — keeps running through board resets
  };

  if (!puzzle || !playerGrid) return null;

  const { size, clues, rectangles } = puzzle;
  const CELL = Math.min(60, Math.floor(430 / size));
  const GRID_SIZE = size * CELL;
  const TILE = Math.round(CELL * 0.76);
  const FONT = Math.min(Math.round(CELL * 0.30), 20);

  const progress = Math.round((playerGrid.flat().filter(v => v !== -1).length / (size*size)) * 100);

  // Map from rectId → wrong playerRect (for turning clue tile black)
  const wrongCoverageByRectId = {};
  for (const pr of playerRects) {
    if (!pr.correct) wrongCoverageByRectId[pr.rectId] = pr;
  }

  // Active drag color
  let dragColor = null;
  if (selection && dragStart) {
    outer: for (let r = selection.r1; r <= selection.r2; r++)
      for (let c = selection.c1; c <= selection.c2; c++) {
        const cl = clues[`${r},${c}`];
        if (cl) { dragColor = PALETTE[cl.paletteIdx]; break outer; }
      }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{margin:0;background:#C8D8E8}
        .root{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;font-family:'DM Sans',sans-serif;background:linear-gradient(145deg,#B8CCE0 0%,#C4D4C4 50%,#D0C8D8 100%)}
        h1{font-family:'Libre Baskerville',serif;font-size:clamp(26px,5vw,38px);color:#18182A;margin:0 0 3px;letter-spacing:-0.5px}
        .sub{font-size:12.5px;color:#607080;margin:0 0 18px;font-weight:300}
        .topbar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;justify-content:center}
        .diff-grp{display:flex;gap:5px}
        .db{padding:5px 14px;border-radius:20px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;border:1.5px solid transparent}
        .da{background:#18182A;color:#EEF2F5;border-color:#18182A}
        .di{background:rgba(255,255,255,0.5);color:#607080;border-color:rgba(255,255,255,0.8)}
        .di:hover{border-color:#18182A;color:#18182A;background:rgba(255,255,255,0.8)}
        .sep{width:1px;height:22px;background:rgba(255,255,255,0.6);flex-shrink:0}
        .ab{background:rgba(255,255,255,0.5);border:1.5px solid rgba(255,255,255,0.8);border-radius:8px;padding:5px 13px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;color:#607080;transition:all .15s}
        .ab:hover{border-color:#18182A;color:#18182A;background:rgba(255,255,255,0.8)}
        .nb{background:#18182A;color:#EEF2F5;border:none;border-radius:8px;padding:5px 15px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;transition:all .15s}
        .nb:hover{background:#2D2D42}
        .timer{font-family:'Libre Baskerville',serif;font-size:15px;color:#18182A;font-weight:700;letter-spacing:1px;background:rgba(255,255,255,0.7);border:1.5px solid rgba(255,255,255,0.9);border-radius:8px;padding:4px 14px;min-width:64px;text-align:center}
        .stats{display:flex;gap:18px;margin-bottom:12px;font-size:12px;color:#607080;font-weight:300}
        .sv{font-weight:600;color:#18182A}
        .pw{height:4px;background:rgba(255,255,255,0.4);border-radius:2px;margin-bottom:14px}
        .pb{height:100%;background:#18182A;border-radius:2px;transition:width .35s ease}
        .gw{position:relative;background:#FAFAF8;border:2px solid #18182A;border-radius:8px;overflow:hidden;cursor:crosshair;user-select:none;-webkit-user-select:none}
        .gr{display:flex}
        .cell{position:relative;display:flex;align-items:center;justify-content:center;border-right:1px solid #E6E0D8;border-bottom:1px solid #E6E0D8;flex-shrink:0}
        .cell:last-child{border-right:none}
        .gr:last-child .cell{border-bottom:none}
        .ov{position:absolute;pointer-events:none}
        .ct{display:flex;align-items:center;justify-content:center;border-radius:8px;font-family:'Libre Baskerville',serif;font-weight:700;color:#fff;position:absolute;z-index:7;pointer-events:none;overflow:hidden}
        .sb{margin-top:20px;background:#18182A;color:#EEF2F5;border-radius:12px;padding:20px 36px;text-align:center;animation:pop .4s cubic-bezier(0.34,1.56,0.64,1)}
        @keyframes pop{from{opacity:0;transform:scale(0.85) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .st{font-family:'Libre Baskerville',serif;font-size:22px;margin-bottom:4px}
        .ss{font-size:13px;opacity:.55;margin-bottom:14px}
        .snb{background:#EEF2F5;color:#18182A;border:none;border-radius:8px;padding:8px 22px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:13px}
        .snb:hover{background:#fff}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#18182A;color:#EEF2F5;padding:9px 20px;border-radius:10px;font-size:13px;white-space:nowrap;pointer-events:none;transition:opacity .2s;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
        .hint{font-size:11.5px;color:#708090;margin-top:14px;text-align:center;line-height:1.8;font-weight:300}
        .hint strong{color:#4A5868;font-weight:500}
        .legend{display:flex;gap:0;background:rgba(255,255,255,0.55);border-radius:10px;padding:10px 16px;margin-top:14px;align-items:center;flex-wrap:wrap;justify-content:center;gap:6px 18px}
        .legend-item{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#4A5868;font-weight:400}
        .legend-tile{position:relative;border-radius:6px;flex-shrink:0;overflow:hidden;background:#A0A8B0}
        .legend-label{white-space:nowrap}
      `}</style>

      <div className="root" onMouseLeave={() => { setDragStart(null); setSelection(null); }}>
        <h1>Patches</h1>
        <p className="sub">Fill every cell — each number is the area of its rectangle</p>

        <div className="topbar">
          <div className="diff-grp">
            {['easy','medium','hard'].map(d => (
              <button key={d} className={`db ${difficulty===d?'da':'di'}`} onClick={() => setDifficulty(d)}>
                {d[0].toUpperCase()+d.slice(1)}
              </button>
            ))}
          </div>
          <div className="sep"/>
          <div className="timer">{formatTime(time)}</div>
          <div className="sep"/>
          <button className="ab" onClick={handleReset}>↺ Reset</button>
          <button className="nb" onClick={newPuzzle}>New puzzle</button>
        </div>

        <div className="stats">
          <span>Shapes: <span className="sv">{playerRects.length} / {rectangles.length}</span></span>
          <span>Progress: <span className="sv">{progress}%</span></span>
          <span>Moves: <span className="sv">{moves}</span></span>
        </div>

        <div className="pw" style={{ width: GRID_SIZE }}>
          <div className="pb" style={{ width: `${progress}%` }}/>
        </div>

        <div className="gw" style={{ width: GRID_SIZE, height: GRID_SIZE }}>

          {/* Placed rectangles — green/color if correct, red if wrong */}
          {playerRects.map(rect => {
            const col = rect.correct ? PALETTE[rect.paletteIdx] : null;
            const w = (rect.c2-rect.c1+1)*CELL;
            const h = (rect.r2-rect.r1+1)*CELL;
            return (
              <div key={`pr-${rect.id}`} className="ov" style={{
                left: rect.c1*CELL, top: rect.r1*CELL, width: w, height: h,
                background: rect.correct ? col+'80' : 'rgba(220,60,60,0.18)',
                border: `2px solid ${rect.correct ? col+'AA' : 'rgba(200,40,40,0.55)'}`,
                borderRadius: 5, zIndex: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!rect.correct && (
                  <span style={{
                    fontFamily:"'Libre Baskerville',serif", fontWeight:700,
                    fontSize: Math.min(FONT + 2, 22), color:'rgba(180,30,30,0.75)',
                    pointerEvents:'none', userSelect:'none',
                  }}>{rect.drawnArea}</span>
                )}
              </div>
            );
          })}

          {/* Drag selection preview */}
          {selection && dragStart && (
            <div className="ov" style={{
              left: selection.c1*CELL+3, top: selection.r1*CELL+3,
              width: (selection.c2-selection.c1+1)*CELL-6,
              height: (selection.r2-selection.r1+1)*CELL-6,
              background: dragColor ? dragColor+'30' : 'rgba(24,24,42,0.07)',
              border: `2.5px dashed ${dragColor || 'rgba(24,24,42,0.35)'}`,
              borderRadius: 5, zIndex: 4,
            }}/>
          )}

          {/* Cells + clue tiles */}
          {Array.from({length:size},(_,r) => (
            <div key={r} className="gr">
              {Array.from({length:size},(_,c) => {
                const key = `${r},${c}`;
                const clue = clues[key];
                const col = clue ? PALETTE[clue.paletteIdx] : null;

                return (
                  <div key={c} className="cell"
                    style={{ width: CELL, height: CELL }}
                    onMouseDown={e => handleMouseDown(r,c,e)}
                    onMouseEnter={() => handleMouseEnter(r,c)}
                  >
                    {clue && (
                      <div className="ct" style={{
                        width: TILE, height: TILE,
                        background: wrongCoverageByRectId[clue.rectId] ? '#1A1A1A' : col,
                        boxShadow: `0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)`,
                        transition: 'background 0.2s',
                      }}>
                        <ShapeHintSVG shapeHint={clue.shapeHint} tileSize={TILE}/>
                        {clue.showNumber && (
                          <span style={{
                            position:'relative', zIndex:3,
                            fontFamily:"'Libre Baskerville',serif",
                            fontWeight:700, fontSize: FONT, color:'#fff',
                            lineHeight:1,
                            background: 'rgba(0,0,0,0.28)',
                            borderRadius: 4,
                            padding: `${Math.round(FONT*0.08)}px ${Math.round(FONT*0.22)}px`,
                          }}>
                            {clue.area}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {solved && (
          <div className="sb">
            <div className="st">🎉 Solved!</div>
            <div className="ss">Finished in {formatTime(time)} · {moves} move{moves!==1?'s':''} · {rectangles.length} shapes</div>
            <button className="snb" onClick={newPuzzle}>Next puzzle →</button>
          </div>
        )}

        <p className="hint">
          <strong>Drag</strong> from a tile to draw its rectangle · Area must match the number · <strong>Click</strong> a filled region to erase
        </p>

        {/* How to play legend */}
        <div className="legend">
          {[
            { hint: 'square', label: 'Square' },
            { hint: 'tall', label: 'Tall rectangle' },
            { hint: 'wide', label: 'Wide rectangle' },
            { hint: 'any', label: 'Any of the above' },
          ].map(({ hint, label }) => (
            <div key={hint} className="legend-item">
              <div className="legend-tile" style={{ width: 32, height: 32 }}>
                <ShapeHintSVG shapeHint={hint} tileSize={32} legendMode />
              </div>
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="toast" style={{ opacity: toast ? 1 : 0 }}>{toast}</div>
    </>
  );
}

function ShapeHintSVG({ shapeHint, tileSize, legendMode = false }) {
  const T = tileSize;
  const stroke = legendMode ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.90)';
  const fill = legendMode ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.28)';
  const dash = '3.5,2';
  const sw = legendMode ? 2.0 : 1.6;
  const svgStyle = { position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' };

  if (shapeHint === 'square') {
    // Clean square, no dividers, big
    const S = T * 0.62;
    const ox = (T-S)/2, oy = (T-S)/2;
    return (
      <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
        <rect x={ox} y={oy} width={S} height={S} fill={fill} rx={3.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}/>
      </svg>
    );
  }

  if (shapeHint === 'tall') {
    // Tall narrow rect, no dividers, clearly taller than wide
    const W = T * 0.30, H = T * 0.66;
    const ox = (T-W)/2, oy = (T-H)/2;
    return (
      <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
        <rect x={ox} y={oy} width={W} height={H} fill={fill} rx={3.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}/>
      </svg>
    );
  }

  if (shapeHint === 'wide') {
    // Wide short rect, no dividers, clearly wider than tall
    const W = T * 0.66, H = T * 0.30;
    const ox = (T-W)/2, oy = (T-H)/2;
    return (
      <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
        <rect x={ox} y={oy} width={W} height={H} fill={fill} rx={3.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}/>
      </svg>
    );
  }

  // 'any' — medium filled square with a dashed outer ring offset from it,
  // clearly distinct from the plain square hint
  const sq = T * 0.38;
  const sqo = (T-sq)/2;
  const ringPad = T * 0.09;
  const rox = sqo - ringPad, roy = sqo - ringPad;
  const rw = sq + ringPad*2, rh = sq + ringPad*2;
  return (
    <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
      {/* Outer dashed ring */}
      <rect x={rox} y={roy} width={rw} height={rh} fill="none" rx={5}
        stroke={stroke} strokeWidth={sw} strokeDasharray="3.5,3" opacity={0.75}/>
      {/* Solid inner square */}
      <rect x={sqo} y={sqo} width={sq} height={sq} fill={fill} rx={3}
        stroke={stroke} strokeWidth={sw}/>
    </svg>
  );
}
