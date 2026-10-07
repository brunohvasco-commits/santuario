import { CARDS, Color } from './cards';
import { supabase } from './supabase';

export type Cell = '' | 'rS' | 'rM' | 'bS' | 'bM';
export type Board = Cell[][]; // board[y][x], y=0 = fileira do azul

export interface Game {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  card_set: 'base' | 'sensei' | 'all';
  status: 'waiting' | 'playing' | 'finished';
  red_id: string | null;
  blue_id: string | null;
  red_name: string | null;
  blue_name: string | null;
  board: Board | null;
  red_cards: string[] | null;
  blue_cards: string[] | null;
  side_card: string | null;
  turn: Color | null;
  winner: Color | null;
  win_reason: 'stone' | 'stream' | 'resign' | null;
  last_move: LastMove | null;
  history: LastMove[];
  move_count: number;
  rematch_id: string | null;
  vs_ai: boolean;
  ai_level: 'easy' | 'medium' | 'hard' | null;
}

export interface LastMove {
  color: Color;
  card: string;
  from?: [number, number];
  to?: [number, number];
  captured?: Cell | null;
  pass?: boolean;
}

export interface Target { x: number; y: number; cards: string[]; capture: boolean }

export const other = (c: Color): Color => (c === 'red' ? 'blue' : 'red');
export const colorOf = (cell: Cell): Color | null => (cell ? (cell[0] === 'r' ? 'red' : 'blue') : null);
export const aiColorOf = (g: Game): Color | null => (g.vs_ai ? (g.red_id ? 'blue' : 'red') : null);
export const LEVEL_NAME = { easy: 'Fácil', medium: 'Normal', hard: 'Difícil' } as const;
export const colorName = (c: Color) => (c === 'red' ? 'Vermelho' : 'Azul');

/** Destinos possíveis para a peça em (x,y) usando as cartas da mão. Mesma regra validada no servidor. */
export function targetsFor(board: Board, x: number, y: number, hand: string[]): Target[] {
  const me = colorOf(board[y][x]);
  if (!me) return [];
  const sgn = me === 'red' ? 1 : -1;
  const map = new Map<string, Target>();
  for (const id of hand) {
    for (const [dx, dy] of CARDS[id].moves) {
      const tx = x + sgn * dx;
      const ty = y - sgn * dy;
      if (tx < 0 || tx > 4 || ty < 0 || ty > 4) continue;
      const t = board[ty][tx];
      if (colorOf(t) === me) continue;
      const k = `${tx},${ty}`;
      const cur = map.get(k) ?? { x: tx, y: ty, cards: [], capture: !!t };
      if (!cur.cards.includes(id)) cur.cards.push(id);
      map.set(k, cur);
    }
  }
  return [...map.values()];
}

export function hasLegalMove(board: Board, me: Color, hand: string[]): boolean {
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      if (colorOf(board[y][x]) === me && targetsFor(board, x, y, hand).length) return true;
  return false;
}

function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?: /, '');
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(errMsg(error));
  return data as T;
}

export const api = {
  create: (cardSet: string, color: string) => rpc<string>('create_game', { p_card_set: cardSet, p_color: color }),
  createAi: (cardSet: string, color: string, level: string) =>
    rpc<string>('create_ai_game', { p_card_set: cardSet, p_color: color, p_level: level }),
  aiMove: (id: string, card: string, from?: [number, number], to?: [number, number]) =>
    rpc<Game>('ai_move', from && to ? { p_game: id, p_card: card, fx: from[0], fy: from[1], tx: to[0], ty: to[1] } : { p_game: id, p_card: card }),
  join: (id: string) => rpc<Game>('join_game', { p_game: id }),
  move: (id: string, card: string, fx: number, fy: number, tx: number, ty: number) =>
    rpc<Game>('make_move', { p_game: id, p_card: card, fx, fy, tx, ty }),
  pass: (id: string, card: string) => rpc<Game>('pass_turn', { p_game: id, p_card: card }),
  resign: (id: string) => rpc<Game>('resign', { p_game: id }),
  rematch: (id: string) => rpc<string>('rematch', { p_game: id }),
  get: async (id: string) => {
    const { data, error } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(errMsg(error));
    return data as Game | null;
  },
};
