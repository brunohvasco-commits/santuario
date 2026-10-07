import type { Board, LastMove, Target } from '../game';
import { Piece } from './Piece';
import type { Color } from '../cards';

interface Props {
  board: Board;
  pov: Color; // quem fica embaixo
  selected: { x: number; y: number } | null;
  targets: Target[];
  movable: (x: number, y: number) => boolean;
  lastMove: LastMove | null;
  onCell: (x: number, y: number) => void;
  disabled?: boolean;
}

const FILES = 'abcde';

export function BoardView({ board, pov, selected, targets, movable, lastMove, onCell, disabled }: Props) {
  const toBoard = (vx: number, vy: number) => (pov === 'red' ? { x: vx, y: vy } : { x: 4 - vx, y: 4 - vy });
  const cells = [];
  for (let vy = 0; vy < 5; vy++) {
    for (let vx = 0; vx < 5; vx++) {
      const { x, y } = toBoard(vx, vy);
      const cell = board[y][x];
      const t = targets.find((t) => t.x === x && t.y === y);
      const isSel = selected?.x === x && selected?.y === y;
      const isFrom = lastMove?.from?.[0] === x && lastMove?.from?.[1] === y;
      const isTo = lastMove?.to?.[0] === x && lastMove?.to?.[1] === y;
      const canPick = movable(x, y);
      const temple = x === 2 && (y === 0 || y === 4);
      const cls = [
        'cell',
        isSel && 'sel',
        t && (t.capture ? 'target capture' : 'target'),
        isFrom && 'from',
        isTo && 'to',
        canPick && 'pickable',
        temple && 'temple',
      ]
        .filter(Boolean)
        .join(' ');
      const coord = `${FILES[x]}${5 - y}`;
      cells.push(
        <button
          key={`${x}-${y}`}
          type="button"
          className={cls}
          onClick={() => onCell(x, y)}
          disabled={disabled || (!t && !canPick)}
          aria-label={`Casa ${coord}${cell ? ', ' + (cell[1] === 'M' ? 'mestre ' : 'aprendiz ') + (cell[0] === 'r' ? 'vermelho' : 'azul') : ''}${t ? ', destino possível' : ''}`}
        >
          {cell && (
            <span className={`piece-wrap${isTo ? ' arrive' : ''}`} key={`${cell}-${lastMove?.to?.join() ?? ''}`}>
              <Piece cell={cell} />
            </span>
          )}
          {t && <span className="dot" />}
        </button>,
      );
    }
  }
  return (
    <div className="board">
      <img className={`board-art${pov === 'blue' ? ' rot' : ''}`} src="/img/board.webp" alt="" draggable={false} />
      <div className="grid">{cells}</div>
    </div>
  );
}
