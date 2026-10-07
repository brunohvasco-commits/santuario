import { useEffect } from 'react';

export function RulesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal scroll" role="dialog" aria-label="Regras" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Fechar">×</button>
        <h2>Como jogar</h2>
        <h3>Preparação</h3>
        <p>Cada mestre tem 5 peças: 1 Mestre (師) no espaço de Templo e 4 Aprendizes (弟) na mesma fileira. Cinco cartas de Movimento são sorteadas: duas para cada jogador e uma fica de lado. <strong>Quem tem a cor do símbolo da carta de lado começa.</strong></p>
        <h3>No seu turno</h3>
        <ol>
          <li><strong>Mover e atacar.</strong> Escolha uma das suas duas cartas e mova uma peça sua (Mestre ou Aprendiz) para uma das casas indicadas. O quadrado escuro do centro é a posição da peça. Peças no caminho não bloqueiam o movimento.</li>
          <li><strong>Trocar cartas.</strong> A carta usada vai para o lado do tabuleiro, virada para o oponente, e você pega a carta que estava lá. O jogo faz a troca automaticamente.</li>
        </ol>
        <p>Você não pode sair do tabuleiro nem ocupar a casa de uma peça sua. Terminar o movimento sobre uma peça do oponente a captura. Passar por cima dela não tem efeito.</p>
        <h3>Se não houver movimento possível</h3>
        <p>Se há um movimento permitido, você é obrigado a fazê-lo. Só quando nenhuma peça pode se mover com nenhuma das suas cartas você passa a vez: escolha uma carta para trocar mesmo assim.</p>
        <h3>Como vencer</h3>
        <ul>
          <li><strong>Caminho da Pedra:</strong> capture o Mestre do oponente.</li>
          <li><strong>Caminho do Rio:</strong> leve o seu Mestre até o espaço de Templo do oponente.</li>
        </ul>
        <h3>Dicas da interface</h3>
        <p>Toque numa peça sua para ver os destinos (pontos dourados; anel vermelho = captura). Se duas cartas levam à mesma casa, você escolhe qual usar. Para limitar os destinos a uma carta, toque nela antes.</p>
      </div>
    </div>
  );
}
