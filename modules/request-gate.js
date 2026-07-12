export function createRequestGate({ AbortControllerClass = globalThis.AbortController } = {}) {
  let generation = 0;
  let controller = null;

  return {
    begin() {
      generation += 1;
      controller?.abort();
      controller = AbortControllerClass ? new AbortControllerClass() : null;
      const requestGeneration = generation;
      return {
        signal: controller?.signal,
        isCurrent: () => requestGeneration === generation,
      };
    },
    cancel() {
      generation += 1;
      controller?.abort();
      controller = null;
    },
  };
}
