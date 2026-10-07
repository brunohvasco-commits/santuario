import { CARDS, cardImg } from '../cards';

interface Props {
  id: string | null | undefined;
  flipped?: boolean; // virada para o oponente (180°)
  selected?: boolean;
  playable?: boolean;
  dim?: boolean;
  fresh?: boolean;
  size?: 'lg' | 'md' | 'sm';
  onClick?: () => void;
  label?: string;
  noTrack?: boolean; // não participa da animação de troca
}

export function Card({ id, flipped, selected, playable, dim, fresh, size = 'md', onClick, label, noTrack }: Props) {
  if (!id) return <div className={`card card-${size} card-empty`} />;
  const c = CARDS[id];
  const cls = ['card', `card-${size}`, flipped && 'flipped', selected && 'selected', playable && 'playable', dim && 'dim', fresh && 'fresh']
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      <img src={cardImg(id)} alt={`Carta ${c.name}`} draggable={false} />
      <span className={`card-seal ${c.color}`} title={`Símbolo ${c.color === 'red' ? 'vermelho' : 'azul'}`} />
    </>
  );
  return onClick ? (
    <button type="button" data-card={noTrack ? undefined : id} className={cls} onClick={onClick} aria-pressed={selected} aria-label={label ?? `Carta ${c.name}`}>
      {content}
    </button>
  ) : (
    <div data-card={noTrack ? undefined : id} className={cls} aria-label={label ?? `Carta ${c.name}`}>{content}</div>
  );
}

export function CardBack({ size = 'md' }: { size?: 'lg' | 'md' | 'sm' }) {
  return (
    <div className={`card card-${size} card-back`}>
      <img src="/img/card-back.webp" alt="" draggable={false} />
    </div>
  );
}
