export function createSpriteAnimation({ canvas, source, frameSize, frameCount, frameDuration }) {
  const context = canvas.getContext("2d");
  const sprite = new Image();
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
      clearInterval(timer);
    }

    let frame = 0;
    drawFrame(frame);
    timer = setInterval(() => {
      frame += 1;
      if (frame >= frameCount) {
        clearInterval(timer);
        timer = null;
        drawFrame(0);
        return;
      }
      drawFrame(frame);
    }, frameDuration);
  }

  sprite.addEventListener("load", () => {
    drawFrame(0);
    if (pending) {
      play();
    }
  });
  sprite.src = source;

  return { play };
}
