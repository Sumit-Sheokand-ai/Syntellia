export function SyntelliaLogo({ size = 28 }: { size?: number }) {
  const cx = 16, cy = 16;
  const innerR = 5, outerR = 12;
  const arrowAngle = Math.PI * 0.38;
  const wingLen = 3.8;

  const arrows = [0, 72, 144, 216, 288].map((deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x1 = (cx + innerR * cos).toFixed(2);
    const y1 = (cy + innerR * sin).toFixed(2);
    const x2 = (cx + outerR * cos).toFixed(2);
    const y2 = (cy + outerR * sin).toFixed(2);
    const wx1 = (parseFloat(x2) - wingLen * Math.cos(rad - arrowAngle)).toFixed(2);
    const wy1 = (parseFloat(y2) - wingLen * Math.sin(rad - arrowAngle)).toFixed(2);
    const wx2 = (parseFloat(x2) - wingLen * Math.cos(rad + arrowAngle)).toFixed(2);
    const wy2 = (parseFloat(y2) - wingLen * Math.sin(rad + arrowAngle)).toFixed(2);
    return { x1, y1, x2, y2, wx1, wy1, wx2, wy2, deg };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#1565C0" />
      <circle cx="16" cy="16" r="16" fill="url(#logoGrad)" />
      <defs>
        <radialGradient id="logoGrad" cx="30%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#42a5f5" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0d47a1" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {arrows.map(({ x1, y1, x2, y2, wx1, wy1, wx2, wy2, deg }) => (
        <g key={deg}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1={x2} y1={y2} x2={wx1} y2={wy1} stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1={x2} y1={y2} x2={wx2} y2={wy2} stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
