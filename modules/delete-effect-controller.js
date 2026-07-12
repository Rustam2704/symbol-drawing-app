export function createDeleteEffectController({
  context,
  cloneStrokes,
  drawScene,
  getCurrentHistoryNode,
  getPixelRatio = () => 1,
  requestFrame = requestAnimationFrame,
  setStrokes,
}) {
  let effects = [];
  let animationFrame = null;

  function drawParticle(effect, particleIndex, sampleTime) {
    const particles = effect.particles;
    const particleDuration = particles.duration[particleIndex];
    let x = particles.sx[particleIndex];
    let y = particles.sy[particleIndex];
    let alpha = 1;
    if (sampleTime > 0) {
      const clampedTime = Math.min(sampleTime, particleDuration);
      const simulationTime = clampedTime * 2;
      const upwardAcceleration = -54 * getPixelRatio();
      x += particles.vx[particleIndex] * simulationTime;
      y += particles.vy[particleIndex] * simulationTime + 0.5 * upwardAcceleration * simulationTime ** 2;
      const remainingLifetime = Math.max(0, particleDuration - clampedTime) * 2;
      alpha = Math.min(1, remainingLifetime / 0.3);
    }
    if (alpha <= 0) return;
    context.globalAlpha = alpha;
    const color = particles.palette[particles.colorIndex[particleIndex]];
    if (effect.renderColor !== color) {
      effect.renderColor = color;
      context.fillStyle = color;
    }
    context.fillRect(x, y, particles.size, particles.size);
  }

  function drawFrame(timestamp) {
    if (!effects.length) {
      animationFrame = null;
      return;
    }
    drawScene();
    const activeEffects = [];
    for (const effect of effects) {
      effect.renderColor = null;
      if (effect.lastTimestamp === null) effect.lastTimestamp = timestamp;
      const deltaTime = Math.min(0.05, (timestamp - effect.lastTimestamp) / 1000);
      effect.lastTimestamp = timestamp;
      effect.elapsed += deltaTime * (effect.direction === "reverse" ? 2 : 1);
      const runDuration = effect.direction === "reverse" ? effect.reverseFrom : effect.duration;
      const sampleTime =
        effect.direction === "reverse"
          ? Math.max(0, effect.reverseFrom - effect.elapsed)
          : Math.min(effect.duration, effect.elapsed);
      for (let index = 0; index < effect.particles.count; index += 1) {
        drawParticle(effect, index, sampleTime);
      }
      if (effect.elapsed < runDuration) {
        activeEffects.push(effect);
      } else if (effect.direction === "reverse" && getCurrentHistoryNode().id === effect.targetHistoryId) {
        setStrokes(cloneStrokes(effect.restoreStrokes));
      }
    }
    context.globalAlpha = 1;
    effects = activeEffects;
    if (effects.length) {
      animationFrame = requestFrame(drawFrame);
    } else {
      animationFrame = null;
      drawScene();
    }
  }

  function ensureRunning() {
    if (effects.length && animationFrame === null) animationFrame = requestFrame(drawFrame);
  }

  function start(historyNode, particles) {
    if (!particles.count) return false;
    const duration = particles.maxDuration;
    historyNode.deleteEffect = { particles, duration };
    effects.push({
      historyId: historyNode.id,
      particles,
      duration,
      direction: "forward",
      elapsed: 0,
      lastTimestamp: null,
    });
    ensureRunning();
    return true;
  }

  function settleReassembly() {
    if (!effects.some((effect) => effect.direction === "reverse")) return;
    effects = effects.filter((effect) => effect.direction !== "reverse");
    setStrokes(cloneStrokes(getCurrentHistoryNode().strokes));
    drawScene();
  }

  function undo(undoneNode, targetNode, reducedMotion) {
    const activeForward = effects.find(
      (effect) => effect.historyId === undoneNode.id && effect.direction === "forward",
    );
    effects = effects.filter((effect) => effect.historyId !== undoneNode.id);
    if (undoneNode.kind !== "delete" || !undoneNode.deleteEffect || reducedMotion) return false;

    const reverseFrom = activeForward
      ? Math.min(activeForward.elapsed, undoneNode.deleteEffect.duration)
      : undoneNode.deleteEffect.duration;
    setStrokes([]);
    if (reverseFrom <= 0) {
      setStrokes(cloneStrokes(targetNode.strokes));
      return true;
    }
    effects.push({
      historyId: undoneNode.id,
      particles: undoneNode.deleteEffect.particles,
      duration: undoneNode.deleteEffect.duration,
      direction: "reverse",
      reverseFrom,
      elapsed: 0,
      lastTimestamp: null,
      targetHistoryId: targetNode.id,
      restoreStrokes: cloneStrokes(targetNode.strokes),
    });
    ensureRunning();
    return true;
  }

  return { settleReassembly, start, undo };
}
