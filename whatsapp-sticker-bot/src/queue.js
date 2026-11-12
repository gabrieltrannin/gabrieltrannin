// Fila simples: limita quantas conversões rodam ao mesmo tempo,
// para o computador não travar se chegarem muitos vídeos juntos.

export function createQueue(concurrency) {
  let running = 0;
  const waiting = [];

  const next = () => {
    if (running >= concurrency || waiting.length === 0) return;
    running++;
    const { task, resolve, reject } = waiting.shift();
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        running--;
        next();
      });
  };

  return {
    add(task) {
      return new Promise((resolve, reject) => {
        waiting.push({ task, resolve, reject });
        next();
      });
    },
    get size() {
      return waiting.length + running;
    },
  };
}
