import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CARDS, Color } from '../cards';
import { aiColorOf, api, Board, colorName, colorOf, Game, hasLegalMove, other, Target, targetsFor } from '../game';
import type { AiMove } from '../ai';
import { supabase, useSession } from '../supabase';
import { BoardView } from '../components/BoardView';
import { Card, CardBack } from '../components/Card';
import { RulesModal } from '../components/Rules';
import { Header } from './Lobby';

const FILES = 'abcde';
const sq = (p?: [number, number]) => (p ? `${FILES[p[0]]}${5 - p[1]}` : '');

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const uid = session?.user.id;
  const nav = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [selCard, setSelCard] = useState<string | null>(null);
  const [selPiece, setSelPiece] = useState<{ x: number; y: number } | null>(null);
  const [choose, setChoose] = useState<Target | null>(null);
  const [passCard, setPassCard] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [rules, setRules] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastSeen = useRef<number>(-1);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3200);
  };

  const accept = useCallback((g: Game | null) => {
    if (!g) return;
    setGame((cur) => (cur && cur.id === g.id && new Date(cur.updated_at) > new Date(g.updated_at) ? cur : g));
  }, []);

  // entrar na partida + tempo real
  useEffect(() => {
    if (!id || !uid) return;
    let alive = true;
    setGame(null);
    api
      .join(id)
      .then((g) => alive && accept(g))
      .catch((e) => alive && setLoadErr(e.message));
    const ch = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (p) => accept(p.new as Game))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') api.get(id).then((g) => alive && accept(g)).catch(() => {});
      });
    const refresh = () => document.visibilityState === 'visible' && api.get(id).then((g) => alive && accept(g)).catch(() => {});
    document.addEventListener('visibilitychange', refresh);
    const poll = window.setInterval(refresh, 20000);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(poll);
    };
  }, [id, uid, accept]);

  const me: Color | null = game ? (game.red_id === uid ? 'red' : game.blue_id === uid ? 'blue' : null) : null;
  const pov: Color = me ?? 'red';
  const opp = other(pov);
  const myHand = (game ? (pov === 'red' ? game.red_cards : game.blue_cards) : null) ?? [];
  const oppHand = (game ? (pov === 'red' ? game.blue_cards : game.red_cards) : null) ?? [];
  const myTurn = !!game && game.status === 'playing' && game.turn === me;
  const aiColor = game ? aiColorOf(game) : null;
  const aiTurn = !!game && !!me && !!aiColor && game.status === 'playing' && game.turn === aiColor;
  const mustPass = myTurn && !!game?.board && !hasLegalMove(game.board, me!, myHand);
  const nameOf = (c: Color) => (game ? (c === 'red' ? game.red_name : game.blue_name) : null) || colorName(c);

  // ---- animações: só para jogadas que acontecem com a página aberta ----
  const tableRef = useRef<HTMLElement>(null);
  const firstSeen = useRef<{ id: string; count: number } | null>(null);
  if (game && firstSeen.current?.id !== game.id) firstSeen.current = { id: game.id, count: game.move_count };
  const animate = !!game && game.move_count > (firstSeen.current?.count ?? Infinity);
  const cardRects = useRef<{ id: string; count: number; rects: Map<string, { x: number; y: number; w: number; rot: number }> } | null>(null);

  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root || !game) return;
    const base = root.getBoundingClientRect();
    const now = new Map<string, { x: number; y: number; w: number; rot: number; el: HTMLElement }>();
    root.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
      const r = el.getBoundingClientRect();
      now.set(el.dataset.card!, { x: r.left - base.left, y: r.top - base.top, w: r.width, rot: el.classList.contains('flipped') ? 180 : 0, el });
    });
    const prev = cardRects.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prev && prev.id === game.id && prev.count !== game.move_count && !reduce) {
      // a carta usada vai primeiro para o lado; a carta do lado chega logo depois
      const used = game.last_move?.card;
      let i = 0;
      now.forEach((n, id) => {
        const p = prev.rects.get(id);
        if (!p) return;
        const dx = p.x - n.x;
        const dy = p.y - n.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && p.rot === n.rot) return;
        const s = p.w / n.w;
        const mid = p.rot === n.rot ? n.rot : 90;
        const delay = id === used ? 260 : 470 + 60 * i++;
        n.el.classList.add('flying');
        const a = n.el.animate(
          [
            { transform: `perspective(900px) translate(${dx}px, ${dy}px) rotate(${p.rot}deg) scale(${s})`, filter: 'brightness(1)' },
            {
              transform: `perspective(900px) translate(${dx * 0.45}px, ${dy * 0.45 - 34}px) rotate(${mid}deg) rotateX(26deg) rotateY(-16deg) scale(${((s + 1) / 2) * 1.14})`,
              filter: 'brightness(1.22) drop-shadow(0 26px 24px rgba(0,0,0,.55))',
              offset: 0.5,
            },
            { transform: `perspective(900px) translate(0px, 0px) rotate(${n.rot}deg) scale(1)`, filter: 'brightness(1)' },
          ],
          { duration: 950, delay, easing: 'cubic-bezier(.45,.05,.2,1)', fill: 'backwards' },
        );
        const done = () => n.el.classList.remove('flying');
        a.onfinish = done;
        a.oncancel = done;
      });
    }
    const rects = new Map<string, { x: number; y: number; w: number; rot: number }>();
    now.forEach(({ el: _el, ...r }, id) => rects.set(id, r));
    cardRects.current = { id: game.id, count: game.move_count, rects };
  }, [game]);

  // ---- vez da máquina: calcula no navegador (Web Worker) e o servidor valida ----
  const workerRef = useRef<Worker | null>(null);
  const [thinking, setThinking] = useState(false);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;
  const aiKey = aiTurn && game ? `${game.id}:${game.move_count}` : '';
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    const g = gameRef.current;
    if (!aiKey || !g?.board) return;
    let cancelled = false;
    setThinking(true);
    const started = Date.now();
    let after: number | undefined;
    const timer = window.setTimeout(() => {
      if (!workerRef.current) workerRef.current = new Worker(new URL('../ai.worker.ts', import.meta.url), { type: 'module' });
      const w = workerRef.current;
      w.onmessage = (e: MessageEvent<{ id: string; move: AiMove }>) => {
        if (cancelled || e.data.id !== aiKey) return;
        const m = e.data.move;
        // tempo mínimo de "pensar" para a jogada não parecer instantânea
        after = window.setTimeout(async () => {
          if (cancelled) return;
          try {
            const res = 'pass' in m ? await api.aiMove(g.id, m.card) : await api.aiMove(g.id, m.card, m.from, m.to);
            accept(res);
          } catch (err) {
            const cur = gameRef.current;
            if (cur && cur.move_count === g.move_count) flash((err as Error).message);
          } finally {
            setThinking(false);
          }
        }, Math.max(0, 1500 - (Date.now() - started)));
      };
      w.postMessage({ id: aiKey, input: { board: g.board, redCards: g.red_cards, blueCards: g.blue_cards, side: g.side_card, turn: g.turn, level: g.ai_level ?? 'medium' } });
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (after) window.clearTimeout(after);
      setThinking(false);
    };
  }, [aiKey, accept]);

  // limpa seleção quando o estado muda
  useEffect(() => {
    if (!game) return;
    if (game.move_count !== lastSeen.current) {
      lastSeen.current = game.move_count;
      setSelCard(null);
      setSelPiece(null);
      setChoose(null);
      setPassCard(null);
    }
  }, [game]);

  // título da aba avisa quando é sua vez
  useEffect(() => {
    document.title = myTurn ? '● Sua vez — Santuário' : 'Santuário — duelo de mestres';
    return () => { document.title = 'Santuário — duelo de mestres'; };
  }, [myTurn]);

  const targets = useMemo(() => {
    if (!game?.board || !selPiece || !myTurn) return [];
    return targetsFor(game.board, selPiece.x, selPiece.y, selCard ? [selCard] : myHand);
  }, [game, selPiece, selCard, myTurn, myHand]);

  const doMove = async (card: string, t: { x: number; y: number }) => {
    if (!game || !selPiece) return;
    setBusy(true);
    setChoose(null);
    try {
      accept(await api.move(game.id, card, selPiece.x, selPiece.y, t.x, t.y));
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onCell = (x: number, y: number) => {
    if (!game?.board || !myTurn || busy) return;
    const t = targets.find((t) => t.x === x && t.y === y);
    if (t) {
      if (t.cards.length === 1) doMove(t.cards[0], t);
      else setChoose(t);
      return;
    }
    if (colorOf(game.board[y][x]) === me) {
      setSelPiece(selPiece?.x === x && selPiece?.y === y ? null : { x, y });
      setChoose(null);
    }
  };

  const onMyCard = (c: string) => {
    if (!myTurn || busy) return;
    if (mustPass) {
      setPassCard(passCard === c ? null : c);
      return;
    }
    setSelCard(selCard === c ? null : c);
    setChoose(null);
  };

  const doPass = async () => {
    if (!game || !passCard) return;
    setBusy(true);
    try {
      accept(await api.pass(game.id, passCard));
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doResign = async () => {
    if (!game) return;
    setConfirmResign(false);
    try {
      const g = await api.resign(game.id);
      if (g.status === 'waiting' || !g.red_id || !g.blue_id) nav('/');
      else accept(g);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const doRematch = async () => {
    if (!game) return;
    try {
      const nid = game.rematch_id ?? (await api.rematch(game.id));
      nav(`/jogo/${nid}`);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const link = typeof window !== 'undefined' ? `${window.location.origin}/jogo/${id}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o link:', link);
    }
  };
  const share = async () => {
    const text = `${nameOf(me ?? 'red')} te desafiou para um duelo no Santuário!`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Santuário', text, url: link }); } catch { /* cancelado */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank');
    }
  };

  if (loadErr) {
    return (
      <div className="page">
        <Header onRules={() => setRules(true)} />
        <main className="center-msg">
          <p>{loadErr}</p>
          <Link to="/" className="btn">Voltar ao início</Link>
        </main>
      </div>
    );
  }
  if (!game) return <div className="loading">Entrando no santuário…</div>;

  const waiting = game.status === 'waiting';
  const finished = game.status === 'finished';
  const turnColor = game.turn;
  const lm = game.last_move;
  const spectator = !me;

  let statusText = '';
  if (waiting) statusText = 'Aguardando o oponente aceitar o convite';
  else if (finished) statusText = game.winner ? `${nameOf(game.winner)} venceu` : 'Partida cancelada';
  else if (spectator) statusText = `Vez de ${nameOf(turnColor!)}`;
  else if (myTurn) statusText = mustPass ? 'Sem movimentos: escolha uma carta para trocar' : selPiece ? 'Escolha o destino' : 'Sua vez: escolha uma peça';
  else if (aiTurn) statusText = thinking ? 'A máquina está pensando…' : 'Vez da máquina';
  else statusText = `Vez de ${nameOf(turnColor!)}`;

  const winReason = game.win_reason === 'stone' ? 'pelo Caminho da Pedra (capturou o Mestre)' : game.win_reason === 'stream' ? 'pelo Caminho do Rio (Mestre no Templo)' : game.win_reason === 'resign' ? 'por desistência' : '';

  return (
    <div className="page game-page">
      <Header onRules={() => setRules(true)} />

      <main ref={tableRef} className={`table${waiting ? ' is-waiting' : ''}`}>
        {/* Jogador de cima (oponente) */}
        <section className={`seat top ${opp}${turnColor === opp && !finished && !waiting ? ' active' : ''}`}>
          <PlayerTag color={opp} name={waiting && !(opp === 'red' ? game.red_id : game.blue_id) ? 'Aguardando…' : nameOf(opp)} you={false} />
          <div className="hand">
            {waiting ? (
              <><CardBack size="md" /><CardBack size="md" /></>
            ) : (
              oppHand.map((c) => <Card key={c} id={c} flipped size="md" fresh={c === findReceived(game, opp)} />)
            )}
          </div>
        </section>

        <div className="board-zone">
          <BoardView
            board={game.board ?? INITIAL}
            pov={pov}
            selected={selPiece}
            targets={targets}
            movable={(x, y) => myTurn && !mustPass && !!game.board && colorOf(game.board[y][x]) === me}
            lastMove={lm}
            animMove={animate ? lm : null}
            animKey={game.move_count}
            onCell={onCell}
            disabled={!myTurn || busy || mustPass}
          />

          {waiting && me && (
            <div className="invite-card">
              <h2>Convide seu oponente</h2>
              <p>Envie este link. Quem abrir faz login e entra direto na partida.</p>
              <div className="invite-link">
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link do convite" />
                <button className="btn" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</button>
              </div>
              <div className="invite-actions">
                <button className="btn primary" onClick={share}>Enviar convite</button>
                <button className="link" onClick={doResign}>Cancelar partida</button>
              </div>
              <p className="muted small">Cartas: {game.card_set === 'base' ? 'jogo base' : game.card_set === 'sensei' ? "Sensei's Path" : 'todas'} · Você joga de {colorName(me).toLowerCase()}</p>
            </div>
          )}

          {choose && (
            <div className="chooser" role="dialog" aria-label="Escolha a carta">
              <p>Duas cartas levam a essa casa. Qual usar?</p>
              <div className="chooser-cards">
                {choose.cards.map((c) => (
                  <Card key={c} id={c} size="sm" onClick={() => doMove(c, choose)} playable noTrack />
                ))}
              </div>
              <button className="link" onClick={() => setChoose(null)}>Cancelar</button>
            </div>
          )}
        </div>

        {/* Carta de lado */}
        <aside className="side">
          <span className="side-label">{waiting ? 'Carta de lado' : `Próxima ${turnColor === me ? 'de você' : turnColor === aiColor ? 'da máquina' : 'de ' + nameOf(turnColor ?? 'red')}`}</span>
          {waiting ? <CardBack size="md" /> : <Card key={game.side_card ?? "x"} id={game.side_card} size="md" flipped={turnColor !== pov} fresh />}
          {!waiting && (
            <ol className="history" aria-label="Histórico de jogadas">
              {game.history.slice(-8).map((h, i, arr) => (
                <li key={game.history.length - arr.length + i} className={h.color}>
                  <span className="n">{game.history.length - arr.length + i + 1}.</span>
                  <span>{CARDS[h.card]?.name}</span>
                  <span className="mv">{h.pass ? 'passou' : `${sq(h.from)}→${sq(h.to)}${h.captured ? ' ×' : ''}`}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>

        {/* Jogador de baixo (você) */}
        <section className={`seat bottom ${pov}${myTurn ? ' active' : ''}`}>
          <PlayerTag color={pov} name={nameOf(pov)} you={!!me} />
          <div className="hand">
            {waiting ? (
              <><CardBack size="lg" /><CardBack size="lg" /></>
            ) : (
              myHand.map((c) => (
                <Card
                  key={c}
                  id={c}
                  size="lg"
                  selected={selCard === c || passCard === c}
                  playable={myTurn && !busy}
                  dim={!!selCard && selCard !== c}
                  fresh={c === findReceived(game, pov)}
                  onClick={me ? () => onMyCard(c) : undefined}
                />
              ))
            )}
          </div>
        </section>

        <div className={`status-bar${myTurn ? ' mine' : ''}`} role="status" aria-live="polite">
          <span className="status-text">{statusText}</span>
          {mustPass && passCard && <button className="btn primary" onClick={doPass} disabled={busy}>Trocar {CARDS[passCard].name} e passar</button>}
          {selCard && myTurn && !mustPass && <button className="link" onClick={() => setSelCard(null)}>usar qualquer carta</button>}
          {!finished && !waiting && me && <button className="link danger" onClick={() => setConfirmResign(true)}>Desistir</button>}
        </div>
      </main>

      {finished && game.winner && (
        <div className="result" role="dialog" aria-label="Resultado">
          <div className={`result-card ${game.winner}`}>
            <span className="result-kanji">{me ? (game.winner === me ? '勝' : '敗') : '終'}</span>
            <h2>{me ? (game.winner === me ? 'Vitória!' : 'Derrota') : `${nameOf(game.winner)} venceu`}</h2>
            <p>{nameOf(game.winner)} venceu {winReason}.</p>
            <div className="result-actions">
              {me && <button className="btn primary" onClick={doRematch}>{game.rematch_id ? 'Ir para a revanche' : 'Revanche'}</button>}
              <Link className="btn" to="/">Início</Link>
            </div>
            {me && game.rematch_id && <p className="muted small">Revanche criada com as cores trocadas.</p>}
          </div>
        </div>
      )}

      {confirmResign && (
        <div className="modal-bg" onClick={() => setConfirmResign(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <h2>Desistir da partida?</h2>
            <p>A vitória vai para {nameOf(opp)}.</p>
            <div className="result-actions">
              <button className="btn danger" onClick={doResign}>Desistir</button>
              <button className="btn" onClick={() => setConfirmResign(false)}>Continuar jogando</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="alert">{toast}</div>}
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </div>
  );
}

const INITIAL: Board = [
  ['bS', 'bS', 'bM', 'bS', 'bS'],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['rS', 'rS', 'rM', 'rS', 'rS'],
];

/** Carta que o jogador acabou de receber (a que estava de lado antes da última jogada dele). */
function findReceived(g: Game, color: Color): string | null {
  const hist = g.history;
  const last = hist[hist.length - 1];
  if (!last || last.color !== color) return null;
  const prev = hist[hist.length - 2];
  return prev ? prev.card : null;
}

function PlayerTag({ color, name, you }: { color: Color; name: string; you: boolean }) {
  return (
    <div className={`player-tag ${color}`}>
      <span className={`swatch ${color}`} />
      <span className="pname">{name}</span>
      {you && <span className="you">você</span>}
    </div>
  );
}
