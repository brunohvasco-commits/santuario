// Gerado a partir da planilha de cartas (conferido com as artes das cartas)
export type Color = 'red' | 'blue';
export interface CardDef { id: string; name: string; set: 'base' | 'sensei'; color: Color; moves: [number, number][] }

export const CARDS: Record<string, CardDef> = {
  tiger: { id: 'tiger', name: 'Tigre', set: 'base', color: 'blue', moves: [[0, 2], [0, -1]] },
  dragon: { id: 'dragon', name: 'Dragão', set: 'base', color: 'red', moves: [[-2, 1], [2, 1], [-1, -1], [1, -1]] },
  frog: { id: 'frog', name: 'Sapo', set: 'base', color: 'red', moves: [[-1, 1], [-2, 0], [1, -1]] },
  rabbit: { id: 'rabbit', name: 'Coelho', set: 'base', color: 'blue', moves: [[1, 1], [2, 0], [-1, -1]] },
  crab: { id: 'crab', name: 'Caranguejo', set: 'base', color: 'blue', moves: [[0, 1], [-2, 0], [2, 0]] },
  elephant: { id: 'elephant', name: 'Elefante', set: 'base', color: 'red', moves: [[-1, 1], [1, 1], [-1, 0], [1, 0]] },
  goose: { id: 'goose', name: 'Ganso', set: 'base', color: 'blue', moves: [[-1, 1], [-1, 0], [1, 0], [1, -1]] },
  rooster: { id: 'rooster', name: 'Galo', set: 'base', color: 'red', moves: [[1, 1], [-1, 0], [1, 0], [-1, -1]] },
  monkey: { id: 'monkey', name: 'Macaco', set: 'base', color: 'blue', moves: [[-1, 1], [1, 1], [-1, -1], [1, -1]] },
  mantis: { id: 'mantis', name: 'Louva-Deus', set: 'base', color: 'red', moves: [[-1, 1], [1, 1], [0, -1]] },
  horse: { id: 'horse', name: 'Cavalo', set: 'base', color: 'red', moves: [[0, 1], [-1, 0], [0, -1]] },
  ox: { id: 'ox', name: 'Boi', set: 'base', color: 'blue', moves: [[0, 1], [1, 0], [0, -1]] },
  crane: { id: 'crane', name: 'Grou', set: 'base', color: 'blue', moves: [[0, 1], [-1, -1], [1, -1]] },
  boar: { id: 'boar', name: 'Javali', set: 'base', color: 'red', moves: [[0, 1], [-1, 0], [1, 0]] },
  eel: { id: 'eel', name: 'Enguia', set: 'base', color: 'blue', moves: [[-1, 1], [1, 0], [-1, -1]] },
  cobra: { id: 'cobra', name: 'Cobra', set: 'base', color: 'red', moves: [[1, 1], [-1, 0], [1, -1]] },
  phoenix: { id: 'phoenix', name: 'Fênix', set: 'sensei', color: 'blue', moves: [[-1, 1], [1, 1], [-2, 0], [2, 0]] },
  turtle: { id: 'turtle', name: 'Tartaruga', set: 'sensei', color: 'red', moves: [[-2, 0], [2, 0], [-1, -1], [1, -1]] },
  viper: { id: 'viper', name: 'Víbora', set: 'sensei', color: 'red', moves: [[0, 1], [-2, 0], [1, -1]] },
  sea_snake: { id: 'sea_snake', name: 'Cobra do Mar', set: 'sensei', color: 'blue', moves: [[0, 1], [2, 0], [-1, -1]] },
  giraffe: { id: 'giraffe', name: 'Girafa', set: 'sensei', color: 'blue', moves: [[-2, 1], [2, 1], [0, -1]] },
  kirin: { id: 'kirin', name: 'Kirin', set: 'sensei', color: 'red', moves: [[-1, 2], [1, 2], [0, -2]] },
  iguana: { id: 'iguana', name: 'Iguana', set: 'sensei', color: 'red', moves: [[-2, 1], [0, 1], [1, -1]] },
  tanuki: { id: 'tanuki', name: 'Tanuki', set: 'sensei', color: 'blue', moves: [[0, 1], [2, 1], [-1, -1]] },
  bear: { id: 'bear', name: 'Urso', set: 'sensei', color: 'blue', moves: [[-1, 1], [0, 1], [1, -1]] },
  panda: { id: 'panda', name: 'Panda', set: 'sensei', color: 'red', moves: [[0, 1], [1, 1], [-1, -1]] },
  otter: { id: 'otter', name: 'Lontra', set: 'sensei', color: 'red', moves: [[-1, 1], [2, 0], [1, -1]] },
  sable: { id: 'sable', name: 'Marta', set: 'sensei', color: 'blue', moves: [[1, 1], [-2, 0], [-1, -1]] },
  dog: { id: 'dog', name: 'Cachorro', set: 'sensei', color: 'blue', moves: [[-1, 1], [-1, 0], [-1, -1]] },
  fox: { id: 'fox', name: 'Raposa', set: 'sensei', color: 'red', moves: [[1, 1], [1, 0], [1, -1]] },
  rat: { id: 'rat', name: 'Rato', set: 'sensei', color: 'red', moves: [[0, 1], [-1, 0], [1, -1]] },
  mouse: { id: 'mouse', name: 'Camundongo', set: 'sensei', color: 'blue', moves: [[0, 1], [1, 0], [-1, -1]] },
};

export const cardImg = (id: string) => `/img/cards/${id}.webp`;
