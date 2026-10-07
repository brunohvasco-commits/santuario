-- =========================================================
-- Santuário — esquema e regras (validação no servidor)
-- Coordenadas: board[y][x], y=0 = fileira inicial do AZUL (topo),
-- y=4 = fileira inicial do VERMELHO (base). Templo azul (2,0), vermelho (2,4).
-- Movimentos das cartas: [dx, dy] do ponto de vista de quem joga
-- (dy>0 = para frente, dx>0 = para a direita).
-- =========================================================

create table if not exists public.cards (
  id text primary key,
  card_set text not null check (card_set in ('base','sensei')),
  color text not null check (color in ('red','blue')),
  moves jsonb not null
);
alter table public.cards enable row level security;
drop policy if exists cards_read on public.cards;
create policy cards_read on public.cards for select to anon, authenticated using (true);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  card_set text not null default 'base' check (card_set in ('base','sensei','all')),
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  red_id uuid references auth.users(id) on delete set null,
  blue_id uuid references auth.users(id) on delete set null,
  red_name text,
  blue_name text,
  board jsonb,
  red_cards jsonb,
  blue_cards jsonb,
  side_card text,
  turn text check (turn in ('red','blue')),
  winner text check (winner in ('red','blue')),
  win_reason text check (win_reason in ('stone','stream','resign')),
  last_move jsonb,
  history jsonb not null default '[]'::jsonb,
  move_count int not null default 0,
  rematch_id uuid
);
create index if not exists games_red_idx on public.games(red_id);
create index if not exists games_blue_idx on public.games(blue_id);
create index if not exists games_created_by_idx on public.games(created_by);

alter table public.games enable row level security;
drop policy if exists games_read on public.games;
-- Qualquer usuário logado com o link pode ver a partida (convite / assistir).
create policy games_read on public.games for select to authenticated using (true);
-- Sem políticas de insert/update/delete: tudo passa pelas funções abaixo.

alter table public.games replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;

-- ---------- helpers ----------

create or replace function public._initial_board() returns jsonb
language sql immutable set search_path = '' as $$
  select '[["bS","bS","bM","bS","bS"],["","","","",""],["","","","",""],["","","","",""],["rS","rS","rM","rS","rS"]]'::jsonb
$$;

create or replace function public._display_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email,'@',1))
  from auth.users u where u.id = auth.uid()
$$;

-- Distribui cartas e inicia a partida
create or replace function public._deal(g public.games) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  deck text[];
  side_color text;
begin
  select array_agg(id order by random()) into deck from (
    select id from public.cards
    where g.card_set = 'all' or card_set = g.card_set
    order by random() limit 5
  ) t;
  select color into side_color from public.cards where id = deck[5];
  update public.games set
    board = public._initial_board(),
    red_cards = jsonb_build_array(deck[1], deck[2]),
    blue_cards = jsonb_build_array(deck[3], deck[4]),
    side_card = deck[5],
    turn = side_color,
    status = 'playing',
    winner = null, win_reason = null, last_move = null,
    history = '[]'::jsonb, move_count = 0,
    updated_at = now()
  where id = g.id
  returning * into g;
  return g;
end $$;

-- Lista de jogadas legais para uma cor (usada para validar "passar a vez")
create or replace function public._has_legal_move(p_board jsonb, p_color text, p_hand jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  c text; mv jsonb; x int; y int; tx int; ty int; cell text; tcell text;
  pfx text := left(p_color,1);
  sgn int := case when p_color = 'red' then 1 else -1 end;
begin
  for c in select jsonb_array_elements_text(p_hand) loop
    for mv in select jsonb_array_elements(moves) from public.cards where id = c loop
      for y in 0..4 loop for x in 0..4 loop
        cell := p_board->y->>x;
        if left(cell,1) = pfx then
          tx := x + sgn * (mv->>0)::int;
          ty := y - sgn * (mv->>1)::int;
          if tx between 0 and 4 and ty between 0 and 4 then
            tcell := p_board->ty->>tx;
            if left(coalesce(tcell,''),1) is distinct from pfx then return true; end if;
          end if;
        end if;
      end loop; end loop;
    end loop;
  end loop;
  return false;
end $$;

-- ---------- API (RPC) ----------

create or replace function public.create_game(p_card_set text default 'base', p_color text default 'random')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  col text := p_color;
  gid uuid;
begin
  if uid is null then raise exception 'Faça login para criar uma partida'; end if;
  if p_card_set not in ('base','sensei','all') then raise exception 'Conjunto de cartas inválido'; end if;
  if col not in ('red','blue') then col := case when random() < 0.5 then 'red' else 'blue' end; end if;
  insert into public.games(created_by, card_set, red_id, red_name, blue_id, blue_name)
  values (uid, p_card_set,
          case when col='red' then uid end, case when col='red' then public._display_name() end,
          case when col='blue' then uid end, case when col='blue' then public._display_name() end)
  returning id into gid;
  return gid;
end $$;

create or replace function public.join_game(p_game uuid)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.games;
begin
  if uid is null then raise exception 'Faça login para entrar na partida'; end if;
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if uid in (g.red_id, g.blue_id) then return g; end if;
  if g.status <> 'waiting' then return g; end if; -- vira espectador
  if g.red_id is null then
    update public.games set red_id = uid, red_name = public._display_name() where id = p_game returning * into g;
  else
    update public.games set blue_id = uid, blue_name = public._display_name() where id = p_game returning * into g;
  end if;
  return public._deal(g);
end $$;

create or replace function public.make_move(p_game uuid, p_card text, fx int, fy int, tx int, ty int)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.games;
  me text; opp text; pfx text; sgn int;
  hand jsonb; dx int; dy int; ok boolean;
  piece text; target text; b jsonb; newhand jsonb;
  win text; reason text;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if g.status <> 'playing' then raise exception 'A partida não está em andamento'; end if;
  me := case when uid = g.red_id then 'red' when uid = g.blue_id then 'blue' end;
  if me is null then raise exception 'Você não joga nesta partida'; end if;
  if g.turn <> me then raise exception 'Não é a sua vez'; end if;
  opp := case when me='red' then 'blue' else 'red' end;
  pfx := left(me,1);
  sgn := case when me='red' then 1 else -1 end;
  hand := case when me='red' then g.red_cards else g.blue_cards end;
  if not hand ? p_card then raise exception 'Essa carta não está na sua mão'; end if;
  if least(fx,fy,tx,ty) < 0 or greatest(fx,fy,tx,ty) > 4 then raise exception 'Fora do tabuleiro'; end if;

  b := g.board;
  piece := b->fy->>fx;
  if left(coalesce(piece,''),1) <> pfx then raise exception 'Escolha uma peça sua'; end if;
  target := b->ty->>tx;
  if left(coalesce(target,''),1) = pfx then raise exception 'Você não pode ocupar o espaço de uma peça sua'; end if;

  dx := sgn * (tx - fx);
  dy := sgn * (fy - ty);
  select exists(select 1 from public.cards c, jsonb_array_elements(c.moves) m
                where c.id = p_card and (m->>0)::int = dx and (m->>1)::int = dy) into ok;
  if not ok then raise exception 'Movimento não permitido por essa carta'; end if;

  b := jsonb_set(b, array[fy::text, fx::text], '""'::jsonb);
  b := jsonb_set(b, array[ty::text, tx::text], to_jsonb(piece));

  if target is not null and target <> '' and right(target,1) = 'M' then
    win := me; reason := 'stone';
  elsif right(piece,1) = 'M' and tx = 2 and ty = (case when me='red' then 0 else 4 end) then
    win := me; reason := 'stream';
  end if;

  newhand := (select jsonb_agg(v) from jsonb_array_elements_text(hand) v where v <> p_card) || to_jsonb(g.side_card);

  update public.games set
    board = b,
    red_cards  = case when me='red'  then newhand else red_cards end,
    blue_cards = case when me='blue' then newhand else blue_cards end,
    side_card = p_card,
    turn = opp,
    status = case when win is not null then 'finished' else 'playing' end,
    winner = win, win_reason = reason,
    last_move = jsonb_build_object('color',me,'card',p_card,'from',jsonb_build_array(fx,fy),'to',jsonb_build_array(tx,ty),'captured',nullif(target,'')),
    history = history || jsonb_build_array(jsonb_build_object('color',me,'card',p_card,'from',jsonb_build_array(fx,fy),'to',jsonb_build_array(tx,ty),'captured',nullif(target,''))),
    move_count = move_count + 1,
    updated_at = now()
  where id = p_game returning * into g;
  return g;
end $$;

-- "E se eu não puder mover?" — só permitido quando não há jogada legal
create or replace function public.pass_turn(p_game uuid, p_card text)
returns public.games language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.games; me text; hand jsonb; newhand jsonb;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if g.status <> 'playing' then raise exception 'A partida não está em andamento'; end if;
  me := case when uid = g.red_id then 'red' when uid = g.blue_id then 'blue' end;
  if me is null or g.turn <> me then raise exception 'Não é a sua vez'; end if;
  hand := case when me='red' then g.red_cards else g.blue_cards end;
  if not hand ? p_card then raise exception 'Essa carta não está na sua mão'; end if;
  if public._has_legal_move(g.board, me, hand) then
    raise exception 'Você tem um movimento permitido e precisa fazê-lo';
  end if;
  newhand := (select jsonb_agg(v) from jsonb_array_elements_text(hand) v where v <> p_card) || to_jsonb(g.side_card);
  update public.games set
    red_cards  = case when me='red'  then newhand else red_cards end,
    blue_cards = case when me='blue' then newhand else blue_cards end,
    side_card = p_card,
    turn = case when me='red' then 'blue' else 'red' end,
    last_move = jsonb_build_object('color',me,'card',p_card,'pass',true),
    history = history || jsonb_build_array(jsonb_build_object('color',me,'card',p_card,'pass',true)),
    move_count = move_count + 1,
    updated_at = now()
  where id = p_game returning * into g;
  return g;
end $$;

create or replace function public.resign(p_game uuid)
returns public.games language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.games; me text;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  me := case when uid = g.red_id then 'red' when uid = g.blue_id then 'blue' end;
  if me is null then raise exception 'Você não joga nesta partida'; end if;
  if g.status = 'finished' then return g; end if;
  if g.status = 'waiting' then
    delete from public.games where id = p_game; return g;
  end if;
  update public.games set status='finished', winner = case when me='red' then 'blue' else 'red' end,
    win_reason='resign', updated_at=now()
  where id = p_game returning * into g;
  return g;
end $$;

-- Revanche: nova partida com as cores trocadas, mesmos jogadores
create or replace function public.rematch(p_game uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.games; n public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  if uid not in (g.red_id, g.blue_id) then raise exception 'Você não joga nesta partida'; end if;
  if g.status <> 'finished' then raise exception 'A partida ainda não terminou'; end if;
  if g.rematch_id is not null then return g.rematch_id; end if;
  insert into public.games(created_by, card_set, red_id, red_name, blue_id, blue_name)
  values (uid, g.card_set, g.blue_id, g.blue_name, g.red_id, g.red_name)
  returning * into n;
  n := public._deal(n);
  update public.games set rematch_id = n.id, updated_at = now() where id = p_game;
  return n.id;
end $$;

-- Permissões: helpers não expostos; API só para usuários logados
revoke all on function public._initial_board() from public, anon, authenticated;
revoke all on function public._display_name() from public, anon, authenticated;
revoke all on function public._deal(public.games) from public, anon, authenticated;
revoke all on function public._has_legal_move(jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_game(text, text) from public, anon;
revoke all on function public.join_game(uuid) from public, anon;
revoke all on function public.make_move(uuid, text, int, int, int, int) from public, anon;
revoke all on function public.pass_turn(uuid, text) from public, anon;
revoke all on function public.resign(uuid) from public, anon;
revoke all on function public.rematch(uuid) from public, anon;
grant execute on function public.create_game(text, text) to authenticated;
grant execute on function public.join_game(uuid) to authenticated;
grant execute on function public.make_move(uuid, text, int, int, int, int) to authenticated;
grant execute on function public.pass_turn(uuid, text) to authenticated;
grant execute on function public.resign(uuid) to authenticated;
grant execute on function public.rematch(uuid) to authenticated;
