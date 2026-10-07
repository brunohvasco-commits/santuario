import type { Cell } from '../game';

/** Peça: ficha laqueada com aro de bronze. Mestre é maior e leva coroa + ideograma 師; aprendiz leva 弟. */
export function Piece({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  if (!cell) return null;
  const red = cell[0] === 'r';
  const master = cell[1] === 'M';
  const id = `${cell}${ghost ? 'g' : ''}`;
  const base = red ? ['#d2443a', '#8f1f1b', '#5a1210'] : ['#4f7bb5', '#23446f', '#142a47'];
  return (
    <svg className={`piece ${master ? 'master' : 'student'} ${red ? 'red' : 'blue'}${ghost ? ' ghost' : ''}`} viewBox="0 0 100 100" aria-label={`${master ? 'Mestre' : 'Aprendiz'} ${red ? 'vermelho' : 'azul'}`} role="img">
      <defs>
        <radialGradient id={`lac-${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={base[0]} />
          <stop offset=".55" stopColor={base[1]} />
          <stop offset="1" stopColor={base[2]} />
        </radialGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d79a" />
          <stop offset=".45" stopColor="#b8873f" />
          <stop offset="1" stopColor="#5e3d17" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="57" rx="40" ry="38" fill="rgba(0,0,0,.45)" />
      <circle cx="50" cy="50" r="42" fill={`url(#rim-${id})`} />
      <circle cx="50" cy="50" r={master ? 37 : 36} fill={`url(#lac-${id})`} />
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(243,215,154,.55)" strokeWidth="1.5" />
      {master && (
        <path d="M30 26 L36 16 L43 24 L50 12 L57 24 L64 16 L70 26 Z" fill={`url(#rim-${id})`} stroke="#5e3d17" strokeWidth="1" />
      )}
      <text x="50" y={master ? 64 : 62} textAnchor="middle" fontSize={master ? 34 : 30} fill="#f6e3b4" fontFamily="'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif" fontWeight="700">
        {master ? '師' : '弟'}
      </text>
      <ellipse cx="38" cy="30" rx="14" ry="7" fill="rgba(255,255,255,.18)" transform="rotate(-25 38 30)" />
    </svg>
  );
}
