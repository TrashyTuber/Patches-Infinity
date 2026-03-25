export default function ShapeHintSVG({ shapeHint, tileSize, legendMode = false }) {
  const T = tileSize;
  const stroke = legendMode ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.90)';
  const fill = legendMode ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.28)';
  const dash = '3.5,2';
  const sw = legendMode ? 2.0 : 1.6;
  const svgStyle = { position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' };

  if (shapeHint === 'square') {
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
    const W = T * 0.66, H = T * 0.30;
    const ox = (T-W)/2, oy = (T-H)/2;
    return (
      <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
        <rect x={ox} y={oy} width={W} height={H} fill={fill} rx={3.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}/>
      </svg>
    );
  }

  // 'any' — medium filled square with a dashed outer ring
  const sq = T * 0.38;
  const sqo = (T-sq)/2;
  const ringPad = T * 0.09;
  const rox = sqo - ringPad, roy = sqo - ringPad;
  const rw = sq + ringPad*2, rh = sq + ringPad*2;
  return (
    <svg style={svgStyle} viewBox={`0 0 ${T} ${T}`}>
      <rect x={rox} y={roy} width={rw} height={rh} fill="none" rx={5}
        stroke={stroke} strokeWidth={sw} strokeDasharray="3.5,3" opacity={0.75}/>
      <rect x={sqo} y={sqo} width={sq} height={sq} fill={fill} rx={3}
        stroke={stroke} strokeWidth={sw}/>
    </svg>
  );
}
