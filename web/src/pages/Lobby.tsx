import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, Game } from '../game';
import { displayName, supabase, useSession } from '../supabase';
import { RulesModal } from '../components/Rules';

export const GAME_TITLE = 'Santuário';

export function Brand({ small }: { small?: boolean }) {
  return (
    <div className={`brand${small ? ' small' : ''}`}>
      <span className="brand-mark" aria-hidden="true">⛩</span>
      <span>
        <span className="brand-name">{GAME_TITLE}</span>
        {!small && <span className="brand-sub">duelo de mestres</span>}
      </span>
    </div>
  );
}

export function Header({ onRules }: { onRules: () => void }) {
  const session = useSession();
  return (
    <header className="topbar">
      <Link to="/" className="home-link"><Brand small /></Link>
      <nav>
        <button className="link" onClick={onRules}>Regras</button>
        <span className="who">{displayName(session)}</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
      </nav>
    </header>
  );
}

const SETS = [
  { v: 'base', label: 'Jogo base', hint: '16 cartas originais' },
  { v: 'sensei', label: "Sensei's Path", hint: '16 cartas da expansão' },
  { v: 'all', label: 'Todas', hint: '32 cartas misturadas' },
];
const OPPONENTS = [
  { v: 'friend', label: 'Convidar amigo', hint: 'Envie um link' },
  { v: 'ai', label: 'Contra a máquina', hint: 'Jogue agora' },
];
const LEVELS = [
  { v: 'easy', label: 'Fácil', hint: 'Para aprender' },
  { v: 'medium', label: 'Normal', hint: 'Joga com atenção' },
  { v: 'hard', label: 'Difícil', hint: 'Não perdoa erros' },
];
const COLORS = [
  { v: 'random', label: 'Sorteio' },
  { v: 'red', label: 'Vermelho' },
  { v: 'blue', label: 'Azul' },
];

export function Lobby() {
  const session = useSession();
  const uid = session?.user.id;
  const nav = useNavigate();
  const [rules, setRules] = useState(false);
  const [cardSet, setCardSet] = useState('base');
  const [color, setColor] = useState('random');
  const [opponent, setOpponent] = useState('friend');
  const [level, setLevel] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [games, setGames] = useState<Game[] | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from('games')
      .select('*')
      .or(`red_id.eq.${uid},blue_id.eq.${uid}`)
      .order('updated_at', { ascending: false })
      .limit(30);
    setGames((data as Game[]) ?? []);
  }, [uid]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => load())
      .subscribe();
    const vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [load]);

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const id = opponent === 'ai' ? await api.createAi(cardSet, color, level) : await api.create(cardSet, color);
      nav(`/jogo/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const active = games?.filter((g) => g.status !== 'finished') ?? [];
  const done = games?.filter((g) => g.status === 'finished' && (g.winner || g.red_id && g.blue_id)) ?? [];
  const wins = done.filter((g) => g.winner && (g.winner === 'red' ? g.red_id : g.blue_id) === uid).length;

  return (
    <div className="page">
      <Header onRules={() => setRules(true)} />
      <main className="lobby">
        <section className="panel new-game">
          <h1>Novo duelo</h1>
          <p className="muted">Desafie um amigo pelo link ou treine contra a máquina.</p>
          <fieldset>
            <legend>Adversário</legend>
            <div className="choices two">
              {OPPONENTS.map((o) => (
                <button key={o.v} className={`choice${opponent === o.v ? ' on' : ''}`} onClick={() => setOpponent(o.v)} aria-pressed={opponent === o.v}>
                  <strong>{o.label}</strong>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          {opponent === 'ai' && (
            <fieldset>
              <legend>Nível da máquina</legend>
              <div className="choices">
                {LEVELS.map((l) => (
                  <button key={l.v} className={`choice level-${l.v}${level === l.v ? ' on' : ''}`} onClick={() => setLevel(l.v)} aria-pressed={level === l.v}>
                    <strong>{l.label}</strong>
                    <small>{l.hint}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend>Cartas de movimento</legend>
            <div className="choices">
              {SETS.map((s) => (
                <button key={s.v} className={`choice${cardSet === s.v ? ' on' : ''}`} onClick={() => setCardSet(s.v)} aria-pressed={cardSet === s.v}>
                  <strong>{s.label}</strong>
                  <small>{s.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Sua cor</legend>
            <div className="choices">
              {COLORS.map((c) => (
                <button key={c.v} className={`choice ${c.v}${color === c.v ? ' on' : ''}`} onClick={() => setColor(c.v)} aria-pressed={color === c.v}>
                  <span className={`swatch ${c.v}`} />
                  <strong>{c.label}</strong>
                </button>
              ))}
            </div>
            <small className="muted">Quem começa é definido pela cor do símbolo da carta de lado, como no jogo de mesa.</small>
          </fieldset>
          {err && <p className="error">{err}</p>}
          <button className="btn primary big" onClick={create} disabled={busy}>{busy ? 'Preparando o tatame…' : opponent === 'ai' ? 'Começar contra a máquina' : 'Criar partida e convidar'}</button>
        </section>

        <section className="panel games">
          <div className="games-head">
            <h2>Suas partidas</h2>
            {done.length > 0 && <span className="record">{wins} vitória{wins === 1 ? '' : 's'} · {done.length - wins} derrota{done.length - wins === 1 ? '' : 's'}</span>}
          </div>
          {games === null && <p className="muted">Carregando…</p>}
          {games?.length === 0 && <p className="muted">Nenhuma partida ainda. Crie a primeira ao lado.</p>}
          {active.length > 0 && <h3>Em andamento</h3>}
          <ul className="game-list">
            {active.map((g) => <GameRow key={g.id} g={g} uid={uid!} />)}
          </ul>
          {done.length > 0 && <h3>Encerradas</h3>}
          <ul className="game-list">
            {done.slice(0, 10).map((g) => <GameRow key={g.id} g={g} uid={uid!} />)}
          </ul>
        </section>
      </main>
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </div>
  );
}

function GameRow({ g, uid }: { g: Game; uid: string }) {
  const me = g.red_id === uid ? 'red' : 'blue';
  const opp = me === 'red' ? g.blue_name : g.red_name;
  let status = '';
  let tone = '';
  if (g.status === 'waiting') { status = 'Aguardando oponente'; tone = 'wait'; }
  else if (g.status === 'playing') {
    const mine = g.turn === me;
    status = mine ? 'Sua vez' : g.vs_ai ? 'Vez da máquina' : 'Vez do oponente';
    tone = mine ? 'turn' : '';
  } else if (!g.winner) { status = 'Cancelada'; }
  else { const won = g.winner === me; status = won ? 'Vitória' : 'Derrota'; tone = won ? 'win' : 'loss'; }
  const when = new Date(g.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <li>
      <Link to={`/jogo/${g.id}`} className="game-row">
        <span className={`swatch ${me}`} title={me === 'red' ? 'Você é vermelho' : 'Você é azul'} />
        <span className="vs">{opp ? `vs ${opp}` : 'Convite pendente'}</span>
        <span className={`tag ${tone}`}>{status}</span>
        <span className="when">{when}</span>
      </Link>
    </li>
  );
}
