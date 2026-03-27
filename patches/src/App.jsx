import { useState, useCallback, useEffect, useRef } from "react";
import { PALETTE, generatePuzzle } from "./puzzleGenerator";
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
  const [winModalVisible, setWinModalVisible] = useState(false);
  const [nextId, setNextId] = useState(0);
  const [toast, setToast] = useState('');
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const toastRef = useRef(null);
  const timerRef = useRef(null);
  const hintTimerRef = useRef(null);
  const stateRef = useRef({});
  const gridRef = useRef(null);
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const [history, setHistory] = useState([]);
  const [hintRectId, setHintRectId] = useState(null);

  stateRef.current = { playerGrid, playerRects, puzzle, nextId, selection, dragStart, confirmedRectIds };

  const sizeMap = { easy: 5, medium: 7, hard: 9 };
  const [customPanelOpen, setCustomPanelOpen] = useState(false);
  const [customSize, setCustomSize] = useState(7);
  const [customShapeCount, setCustomShapeCount] = useState(8);
  const [customAnyPct, setCustomAnyPct] = useState(30);
  const [customNoNumPct, setCustomNoNumPct] = useState(30);

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

  useEffect(() => {
    const handler = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Non-passive touch move so we can preventDefault and stop page scrolling
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!target) return;
      const r = parseInt(target.dataset.r);
      const c = parseInt(target.dataset.c);
      if (isNaN(r) || isNaN(c)) return;
      const { dragStart } = stateRef.current;
      if (!dragStart) return;
      setSelection(normalize(dragStart.r, dragStart.c, r, c));
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [puzzle]);

  const newPuzzle = useCallback(() => {
    const size = difficulty === 'custom' ? customSize : sizeMap[difficulty];
    const opts = difficulty === 'custom' ? {
      targetCount: customShapeCount,
      anyProbability: customAnyPct / 100,
      noNumberProbability: customNoNumPct / 100,
    } : {};
    const p = generatePuzzle(size, opts);
    setPuzzle(p);
    setPlayerGrid(Array.from({ length: size }, () => Array(size).fill(-1)));
    setPlayerRects([]);
    setConfirmedRectIds(new Set());
    setSelection(null);
    setDragStart(null);
    setSolved(false);
    setWinModalVisible(false);
    setNextId(0);
    setMoves(0);
    setTime(0);
    setToast('');
    setHistory([]);
    setHintRectId(null);
  }, [difficulty, customSize, customShapeCount, customAnyPct, customNoNumPct]);

  useEffect(() => { if (difficulty !== 'custom') newPuzzle(); }, [difficulty]);

  const handleCustomDone = () => { setCustomPanelOpen(false); newPuzzle(); };

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

        // For no-number clues: correct = shape type matches. For number clues: correct = area matches.
        let correct;
        if (!showNumber) {
          if (shapeHint === 'any') correct = true;
          else if (shapeHint === 'square') correct = drawnRows === drawnCols;
          else if (shapeHint === 'tall') correct = drawnRows > drawnCols;
          else if (shapeHint === 'wide') correct = drawnCols > drawnRows;
          else correct = false;
        } else {
          correct = clue.area === drawnArea;
        }

        // Shape-type mismatch toast for any incorrect placement with a non-'any' shape hint
        if (!correct && shapeHint !== 'any') {
          let shapeOk = true;
          if (shapeHint === 'square') shapeOk = drawnRows === drawnCols;
          else if (shapeHint === 'tall') shapeOk = drawnRows > drawnCols;
          else if (shapeHint === 'wide') shapeOk = drawnCols > drawnRows;
          if (!shapeOk) {
            const labels = { square: 'a square', tall: 'a tall rectangle', wide: 'a wide rectangle' };
            showToast(`Shape must be ${labels[shapeHint]}`);
          }
        }

        setHistory(h => [...h, {
          playerGrid: playerGrid.map(row => [...row]),
          playerRects: [...playerRects],
          confirmedRectIds: new Set(confirmedRectIds),
          nextId,
        }]);

        const id = nextId;
        const newRect = { id, r1, c1, r2, c2, paletteIdx, rectId, correct, drawnArea, showNumber };
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
        const allFilled = newPG.every(row => row.every(v => v !== -1));
        const allCorrect = newPR.every(rect => rect.correct);
        console.log('win check — allFilled:', allFilled, 'allCorrect:', allCorrect, 'rects:', newPR.map(r => r.correct));
        if (allFilled && allCorrect) {
          setSolved(true);
          setWinModalVisible(true);
        }
      }
    }

    setDragStart(null);
    setSelection(null);
  };

  useEffect(() => {
    window.addEventListener('mouseup', finalize);
    window.addEventListener('touchend', finalize);
    return () => {
      window.removeEventListener('mouseup', finalize);
      window.removeEventListener('touchend', finalize);
    };
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
    setHistory([]);
    setHintRectId(null);
    // Timer intentionally NOT reset — keeps running through board resets
  };

  const handleUndo = () => {
    setHistory(h => {
      if (h.length === 0) return h;
      const snap = h[h.length - 1];
      setPlayerGrid(snap.playerGrid);
      setPlayerRects(snap.playerRects);
      setConfirmedRectIds(snap.confirmedRectIds);
      setNextId(snap.nextId);
      setSolved(false);
      return h.slice(0, -1);
    });
  };

  const handleHint = () => {
    const { confirmedRectIds } = stateRef.current;
    const unsolved = puzzle.rectangles.filter(r => !confirmedRectIds.has(r.id));
    if (unsolved.length === 0) return;
    const target = unsolved[Math.floor(Math.random() * unsolved.length)];
    setHintRectId(target.id);
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintRectId(null), 2000);
  };

  if (!puzzle || !playerGrid) return null;

  const { size, clues, rectangles } = puzzle;
  const maxGridWidth = Math.min(540, winWidth - 48);
  const CELL = Math.min(76, Math.floor(maxGridWidth / size));
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
        <h1>Patches Infinity</h1>
        <p className="sub">Fill every cell — each number is the area of its rectangle</p>

        <div className="topbar" style={{ width: GRID_SIZE }}>
          <div className="timer">{formatTime(time)}</div>
          <div className="diff-grp">
            {['easy','medium','hard'].map(d => (
              <button key={d} className={`db ${difficulty===d?'da':'di'}`} onClick={() => { setDifficulty(d); setCustomPanelOpen(false); }}>
                {d[0].toUpperCase()+d.slice(1)}
              </button>
            ))}
            <button className={`db ${difficulty==='custom'?'da':'di'}`} onClick={() => { if (difficulty !== 'custom') setDifficulty('custom'); setCustomPanelOpen(p => !p); }}>
              Custom {difficulty === 'custom' && customPanelOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div className="btn-row" style={{ width: GRID_SIZE }}>
          <button className="ab" onClick={handleReset}>↺ Reset</button>
          <button className="nb" onClick={newPuzzle}>New puzzle</button>
        </div>

        {difficulty === 'custom' && customPanelOpen && (
          <div className="custom-panel" style={{ width: GRID_SIZE }}>
            <div className="cp-row">
              <label>Board size<span>{customSize}×{customSize}</span></label>
              <input type="range" min={5} max={15} value={customSize} onChange={e => setCustomSize(+e.target.value)}/>
            </div>
            <div className="cp-row">
              <label>Shapes<span>{customShapeCount}</span></label>
              <input type="range" min={3} max={30} value={customShapeCount} onChange={e => setCustomShapeCount(+e.target.value)}/>
            </div>
            <div className="cp-row">
              <label>Any shapes<span>{customAnyPct}%</span></label>
              <input type="range" min={0} max={100} value={customAnyPct} onChange={e => setCustomAnyPct(+e.target.value)}/>
            </div>
            <div className="cp-row">
              <label>No-number clues<span>{customNoNumPct}%</span></label>
              <input type="range" min={0} max={100} value={customNoNumPct} onChange={e => setCustomNoNumPct(+e.target.value)}/>
            </div>
            <button className="nb" style={{ marginTop: 4 }} onClick={handleCustomDone}>Done</button>
            <p className="cp-note">The amount for shapes, any-shapes, and no-number clues will vary slightly.</p>
          </div>
        )}

        <div className="stats">
          <span>Shapes: <span className="sv">{playerRects.length} / {rectangles.length}</span></span>
          <span>Progress: <span className="sv">{progress}%</span></span>
          <span>Moves: <span className="sv">{moves}</span></span>
        </div>

        <div className="pw" style={{ width: GRID_SIZE }}>
          <div className="pb" style={{ width: `${progress}%` }}/>
        </div>

        <div className="gw" ref={gridRef} style={{ width: GRID_SIZE, height: GRID_SIZE }}>

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
                {!rect.correct && rect.showNumber && (
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: "'Libre Baskerville',serif", fontWeight: 700,
                fontSize: FONT, lineHeight: 1,
                color: dragColor || 'rgba(24,24,42,0.5)',
                opacity: 0.75,
                pointerEvents: 'none', userSelect: 'none',
              }}>
                {(selection.r2-selection.r1+1)*(selection.c2-selection.c1+1)}
              </span>
            </div>
          )}

          {/* Hint overlay */}
          {hintRectId !== null && (() => {
            const rect = puzzle.rectangles.find(r => r.id === hintRectId);
            if (!rect) return null;
            return (
              <div className="ov hint-overlay" style={{
                left: rect.c1 * CELL, top: rect.r1 * CELL,
                width: (rect.c2 - rect.c1 + 1) * CELL,
                height: (rect.r2 - rect.r1 + 1) * CELL,
                background: 'rgba(255,210,40,0.22)',
                border: '2.5px solid rgba(220,160,0,0.65)',
                borderRadius: 5, zIndex: 6,
              }}/>
            );
          })()}

          {/* Cells + clue tiles */}
          {Array.from({length:size},(_,r) => (
            <div key={r} className="gr">
              {Array.from({length:size},(_,c) => {
                const key = `${r},${c}`;
                const clue = clues[key];
                const col = clue ? PALETTE[clue.paletteIdx] : null;
                const SQ  = Math.round(CELL * 0.62);
                const LNG = Math.round(CELL * 0.78);
                const SHT = Math.round(CELL * 0.44);
                const tileW = clue?.shapeHint === 'tall' ? SHT : clue?.shapeHint === 'wide' ? LNG : SQ;
                const tileH = clue?.shapeHint === 'wide' ? SHT : clue?.shapeHint === 'tall' ? LNG : SQ;

                return (
                  <div key={c} className="cell"
                    data-r={r} data-c={c}
                    style={{ width: CELL, height: CELL, background: col && playerGrid[r][c] === -1 && !(dragStart && selection && r >= selection.r1 && r <= selection.r2 && c >= selection.c1 && c <= selection.c2) ? col + '30' : undefined }}
                    onMouseDown={e => handleMouseDown(r,c,e)}
                    onMouseEnter={() => handleMouseEnter(r,c)}
                    onTouchStart={e => handleMouseDown(r,c,e)}
                  >
                    {clue && clue.shapeHint === 'any' ? (<>
                      <div style={{
                        position:'absolute', zIndex:7, pointerEvents:'none',
                        width: LNG, height: SHT,
                        top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                        background: col + '99', border:`1.5px dotted ${col}`, borderRadius:8,
                      }}/>
                      <div style={{
                        position:'absolute', zIndex:7, pointerEvents:'none',
                        width: SHT, height: LNG,
                        top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                        background: col + '99', border:`1.5px dotted ${col}`, borderRadius:8,
                      }}/>
                      {clue.showNumber && (
                        <span style={{
                          position:'absolute', zIndex:8, pointerEvents:'none',
                          fontFamily:"'Libre Baskerville',serif", fontWeight:700,
                          fontSize: FONT, color:'#fff', lineHeight:1,
                        }}>
                          {clue.area}
                        </span>
                      )}
                    </>) : clue ? (
                      <div className="ct" style={{
                        width: tileW, height: tileH,
                        background: wrongCoverageByRectId[clue.rectId] ? '#1A1A1A' : col,
                        boxShadow: `0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)`,
                        transition: 'background 0.2s',
                      }}>
                        {clue.showNumber && (
                          <span style={{
                            fontFamily:"'Libre Baskerville',serif",
                            fontWeight:700, fontSize: FONT, color:'#fff',
                            lineHeight:1, position:'relative',
                          }}>
                            {clue.area}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="btn-row" style={{ width: GRID_SIZE }}>
          <button className="ab" onClick={handleUndo} disabled={history.length === 0}>↩ Undo</button>
          <button className="ab" onClick={handleHint}>✦ Hint</button>
        </div>

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
              <div style={{ width: 32, height: 32, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {hint === 'any' ? (
                  <div style={{ position:'relative', width:32, height:32 }}>
                    <div style={{ position:'absolute', width:27, height:14, top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#A0A8B099', border:'1.5px dotted #A0A8B0', borderRadius:3 }}/>
                    <div style={{ position:'absolute', width:14, height:27, top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#A0A8B099', border:'1.5px dotted #A0A8B0', borderRadius:3 }}/>
                  </div>
                ) : (
                  <div style={{
                    background: '#A0A8B0',
                    borderRadius: 5,
                    width: hint === 'tall' ? 15 : 27,
                    height: hint === 'wide' ? 15 : 27,
                  }}/>
                )}
              </div>
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="toast" style={{ opacity: toast ? 1 : 0 }}>{toast}</div>

      {solved && winModalVisible && (
        <div className="modal-overlay" onClick={() => setWinModalVisible(false)}>
          <div className="sb" onClick={e => e.stopPropagation()}>
            <div className="st">🎉 Solved!</div>
            <div className="ss">Finished in {formatTime(time)} · {moves} move{moves!==1?'s':''} · {rectangles.length} shapes</div>
            <div className="modal-btns">
              <button className="snb" onClick={newPuzzle}>Next puzzle →</button>
              <button className="snb-sec" onClick={() => setWinModalVisible(false)}>Show board</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
