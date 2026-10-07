// Motor da máquina: busca negamax com poda alfa-beta.
// Roda dentro de um Web Worker para não travar a tela.
import { CARDS } from './cards';

export type Level = 'easy' | 'medium' | 'hard';
export interface AiInput {
  board: string[][]; // board[y][x], '' | 'rS' | 'rM' | 'bS' | 'bM'
  redCards: string[];
  blueCards: string[];
  side: string;
  turn: 'red' | 'blue';
  level: Level;
}
export type AiMove = { card: string; from: [number, number]; to: [number, number] } | { card: string; pass: true };

// Representação interna: 25 casas; +1 aprendiz vermelho, +2 mestre vermelho, -1/-2 azul
interface S { b: Int8Array; hands: [string[], string[]]; side: string; turn: 0 | 1 } // turn 0 = vermelho
interface M { card: string; f: number; t: number; pass?: boolean; cap: number }

const WIN = 1_000_000;
const RED_TEMPLE = 22; // (2,4)
const BLUE_TEMPLE = 2; // (2,0)

function encode(i: AiInput): S {
  const b = new Int8Array(25);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const c = i.board[y][x];
      b[y * 5 + x] = c === 'rS' ? 1 : c === 'rM' ? 2 : c === 'bS' ? -1 : c === 'bM' ? -2 : 0;
    }
  return { b, hands: [i.redCards.slice(), i.blueCards.slice()], side: i.side, turn: i.turn === 'red' ? 0 : 1 };
}

function genMoves(s: S): M[] {
  const sign = s.turn === 0 ? 1 : -1;
  const out: M[] = [];
  for (const card of s.hands[s.turn]) {
    const mv = CARDS[card].moves;
    for (let p = 0; p < 25; p++) {
      const v = s.b[p];
      if (v * sign <= 0) continue;
      const x = p % 5, y = (p / 5) | 0;
      for (const [dx, dy] of mv) {
        const tx = x + sign * dx, ty = y - sign * dy;
        if (tx < 0 || tx > 4 || ty < 0 || ty > 4) continue;
        const t = ty * 5 + tx;
        if (s.b[t] * sign > 0) continue;
        out.push({ card, f: p, t, cap: s.b[t] });
      }
    }
  }
  if (!out.length) for (const card of s.hands[s.turn]) out.push({ card, f: -1, t: -1, pass: true, cap: 0 });
  return out;
}

interface Undo { piece: number; cap: number; handIdx: number; oldSide: string }

function make(s: S, m: M): Undo {
  const hand = s.hands[s.turn];
  const handIdx = hand.indexOf(m.card);
  const u: Undo = { piece: 0, cap: 0, handIdx, oldSide: s.side };
  hand[handIdx] = s.side;
  s.side = m.card;
  if (!m.pass) {
    u.piece = s.b[m.f];
    u.cap = s.b[m.t];
    s.b[m.t] = s.b[m.f];
    s.b[m.f] = 0;
  }
  s.turn = (1 - s.turn) as 0 | 1;
  return u;
}

function unmake(s: S, m: M, u: Undo) {
  s.turn = (1 - s.turn) as 0 | 1;
  if (!m.pass) {
    s.b[m.f] = u.piece;
    s.b[m.t] = u.cap;
  }
  s.side = u.oldSide;
  s.hands[s.turn][u.handIdx] = m.card;
}

/** Jogada que acabou de ser feita venceu? (capturou mestre ou mestre no templo) */
function isWinningMove(m: M, piece: number): boolean {
  if (m.pass) return false;
  if (Math.abs(m.cap) === 2) return true;
  if (piece === 2 && m.t === BLUE_TEMPLE) return true;
  if (piece === -2 && m.t === RED_TEMPLE) return true;
  return false;
}

function mobility(s: S, who: 0 | 1, cards: string[]): number {
  const sign = who === 0 ? 1 : -1;
  let n = 0;
  for (const card of cards) {
    const mv = CARDS[card].moves;
    for (let p = 0; p < 25; p++) {
      if (s.b[p] * sign <= 0) continue;
      const x = p % 5, y = (p / 5) | 0;
      for (const [dx, dy] of mv) {
        const tx = x + sign * dx, ty = y - sign * dy;
        if (tx < 0 || tx > 4 || ty < 0 || ty > 4) continue;
        if (s.b[ty * 5 + tx] * sign > 0) continue;
        n++;
      }
    }
  }
  return n;
}

/** Avaliação do ponto de vista de quem joga agora. */
function evaluate(s: S): number {
  let score = 0; // positivo = bom para o vermelho
  let rm = -1, bm = -1;
  for (let p = 0; p < 25; p++) {
    const v = s.b[p];
    if (!v) continue;
    const x = p % 5, y = (p / 5) | 0;
    const centre = 2 - Math.abs(x - 2);
    if (v === 1) score += 100 + (4 - y) * 4 + centre * 3;
    else if (v === -1) score -= 100 + y * 4 + centre * 3;
    else if (v === 2) rm = p;
    else if (v === -2) bm = p;
  }
  if (rm >= 0) {
    const d = Math.abs((rm % 5) - 2) + ((rm / 5) | 0);
    score += (8 - d) * 6;
  }
  if (bm >= 0) {
    const d = Math.abs((bm % 5) - 2) + (4 - ((bm / 5) | 0));
    score -= (8 - d) * 6;
  }
  score += 3 * (mobility(s, 0, s.hands[0]) - mobility(s, 1, s.hands[1]));
  return s.turn === 0 ? score : -score;
}

let nodes = 0;
let deadline = Infinity;
class Timeout extends Error {}

function order(ms: M[], pv?: M | null) {
  ms.sort((a, b) => Math.abs(b.cap) * 10 - Math.abs(a.cap) * 10);
  if (pv) {
    const i = ms.findIndex((m) => m.card === pv.card && m.f === pv.f && m.t === pv.t);
    if (i > 0) ms.unshift(ms.splice(i, 1)[0]);
  }
}

function negamax(s: S, depth: number, alpha: number, beta: number, ply: number): number {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) throw new Timeout();
  if (depth === 0) return evaluate(s);
  const ms = genMoves(s);
  order(ms);
  let best = -Infinity;
  for (const m of ms) {
    const piece = m.pass ? 0 : s.b[m.f];
    let v: number;
    if (isWinningMove(m, piece)) v = WIN - ply;
    else {
      const u = make(s, m);
      v = -negamax(s, depth - 1, -beta, -alpha, ply + 1);
      unmake(s, m, u);
    }
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

function rootSearch(s: S, depth: number, pv: M | null, noise: number): { move: M; score: number }[] {
  const ms = genMoves(s);
  order(ms, pv);
  const scored: { move: M; score: number }[] = [];
  let alpha = -Infinity;
  for (const m of ms) {
    const piece = m.pass ? 0 : s.b[m.f];
    let v: number;
    if (isWinningMove(m, piece)) v = WIN;
    else {
      const u = make(s, m);
      // com ruído precisamos da nota exata de cada jogada, sem poda na raiz
      v = -negamax(s, depth - 1, -Infinity, noise ? Infinity : -alpha, 1);
      unmake(s, m, u);
    }
    if (noise && Math.abs(v) < WIN / 2) v += (Math.random() * 2 - 1) * noise;
    scored.push({ move: m, score: v });
    if (v > alpha) alpha = v;
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function chooseMove(input: AiInput): AiMove {
  const s = encode(input);
  nodes = 0;
  let best: M;
  if (input.level === 'easy') {
    // Fácil: olha só a própria jogada; aproveita vitória imediata, mas erra bastante
    deadline = Infinity;
    const r = rootSearch(s, 1, null, 140);
    const winning = r.find((x) => x.score >= WIN / 2);
    best = winning ? winning.move : Math.random() < 0.3 ? r[Math.floor(Math.random() * r.length)].move : r[0].move;
  } else if (input.level === 'medium') {
    // Normal: enxerga 4 lances à frente, com um pouco de variação
    deadline = Date.now() + 2500;
    try {
      best = rootSearch(s, 4, null, 15)[0].move;
    } catch {
      deadline = Infinity;
      best = rootSearch(s, 2, null, 15)[0].move;
    }
  } else {
    // Difícil: aprofundamento iterativo até ~1,6 s
    deadline = Date.now() + 1600;
    best = rootSearch(s, 2, null, 0)[0].move;
    for (let d = 3; d <= 9; d++) {
      try {
        const r = rootSearch(s, d, best, 0);
        best = r[0].move;
        if (r[0].score >= WIN / 2) break;
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
  }
  if (best.pass) return { card: best.card, pass: true };
  return { card: best.card, from: [best.f % 5, (best.f / 5) | 0], to: [best.t % 5, (best.t / 5) | 0] };
}
