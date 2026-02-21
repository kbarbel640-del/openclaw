export function effect(fn: () => void): () => void {
  let disposed = false;
  const run = () => {
    if (!disposed) {
      fn();
    }
  };

  run();
  queueMicrotask(run);
  return () => {
    disposed = true;
  };
}
