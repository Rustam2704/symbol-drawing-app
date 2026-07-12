export function createFrameScheduler(
  callback,
  {
    requestFrame = globalThis.requestAnimationFrame,
    cancelFrame = globalThis.cancelAnimationFrame,
  } = {},
) {
  let frame = null;

  function schedule() {
    if (frame !== null) return;
    frame = requestFrame(() => {
      frame = null;
      callback();
    });
  }

  function cancel() {
    if (frame === null) return;
    cancelFrame?.(frame);
    frame = null;
  }

  return { cancel, schedule };
}
