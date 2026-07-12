export function createSpriteAnimation({
  canvas,
  source,
  frameSize,
  frameCount,
  frameDuration,
  ImageClass = globalThis.Image,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
}) {
  const context = canvas.getContext("2d");
  const sprite = new ImageClass();
  let timer = null;
  let pending = false;

  function drawFrame(frame) {
    context.clearRect(0, 0, frameSize, frameSize);
    context.drawImage(
      sprite,
      frame * frameSize,
      0,
      frameSize,
      frameSize,
      0,
      0,
      frameSize,
      frameSize,
    );
  }

  function play() {
    if (!sprite.complete || !sprite.naturalWidth) {
      pending = true;
      return;
    }

    pending = false;
    if (timer !== null) {
      clearIntervalFn(timer);
    }

    let frame = 0;
    drawFrame(frame);
    timer = setIntervalFn(() => {
      frame += 1;
      if (frame >= frameCount) {
        clearIntervalFn(timer);
        timer = null;
        drawFrame(0);
        return;
      }
      drawFrame(frame);
    }, frameDuration);
  }

  const handleLoad = () => {
    drawFrame(0);
    if (pending) {
      play();
    }
  };
  sprite.addEventListener("load", handleLoad);
  sprite.src = source;

  function dispose() {
    pending = false;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    sprite.removeEventListener?.("load", handleLoad);
  }

  return { dispose, play };
}
