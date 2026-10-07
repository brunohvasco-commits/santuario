import { chooseMove, AiInput } from './ai';

self.onmessage = (e: MessageEvent<{ id: string; input: AiInput }>) => {
  const move = chooseMove(e.data.input);
  (self as unknown as Worker).postMessage({ id: e.data.id, move });
};
