import { useState, useCallback, useEffect, useRef } from "react";
import { PALETTE, generatePuzzle } from "./puzzleGenerator";
import ShapeHintSVG from "./ShapeHintSVG";
import "./App.css";

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

          {/* Placed rectangles — color if correct, red if wrong */}
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
