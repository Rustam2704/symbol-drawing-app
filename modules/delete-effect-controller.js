import {
  DELETE_VIDEO_FORWARD_FRAMES,
  DELETE_VIDEO_FPS,
} from "./delete-trajectory-renderer.js";

export function createDeleteEffectController({
  cancelFrame = globalThis.cancelAnimationFrame,
  cloneStrokes,
  drawStrokes,
  getCurrentHistoryNode,
  onFinish = () => {},
  renderer,
  effectType = "default",
  requestFrame = globalThis.requestAnimationFrame,
  setStrokes,
}) {
  const effects = new Map();
  let animationFrame = null;
  let nextRenderId = 1;

  function cancelAnimation() {
    if (animationFrame === null) return;
    cancelFrame?.(animationFrame);
    animationFrame = null;
  }

  function schedule() {
    if (animationFrame !== null || effects.size === 0) return;
    animationFrame = requestFrame(renderFrame);
  }

  function commands(excluded = new Set()) {
    return [...effects.values()]
      .filter((effect) => !excluded.has(effect.renderId))
      .map((effect) => ({ id: effect.renderId, frame: effect.frame }));
  }

  function drawCurrent(excluded) {
    if (renderer.getStatus() !== "ready") return;
    renderer.drawEffects(commands(excluded));
  }

  function removeEffects(finishedEffects) {
    if (!finishedEffects.length) return;
    const excluded = new Set(finishedEffects.map((effect) => effect.renderId));

    // Erase the finished effects while their buffers still exist, then release
    // the buffers. Other simultaneous deletions are immediately redrawn.
    drawCurrent(excluded);
    for (const effect of finishedEffects) {
      effects.delete(effect.renderId);
      renderer.removeEffect(effect.renderId);
      if (
        effect.direction === "reverse" &&
        getCurrentHistoryNode().id === effect.targetHistoryId
      ) {
        setStrokes(cloneStrokes(effect.restoreStrokes));
        drawStrokes();
      }
    }

    if (effects.size === 0) {
      cancelAnimation();
      onFinish();
    }
  }

  function failAllEffects() {
    const failed = [...effects.values()];
    for (const effect of failed) {
      if (
        effect.direction === "reverse" &&
        getCurrentHistoryNode().id === effect.targetHistoryId
      ) {
        setStrokes(cloneStrokes(effect.restoreStrokes));
        drawStrokes();
      }
      renderer.removeEffect(effect.renderId);
    }
    effects.clear();
    cancelAnimation();
    renderer.clear();
    onFinish();
  }

  function renderFrame(timestamp) {
    animationFrame = null;
    if (effects.size === 0) return;
    const status = renderer.getStatus();
    if (status === "failed") {
      failAllEffects();
      return;
    }
    if (status === "loading") {
      for (const effect of effects.values()) effect.lastTimestamp = timestamp;
      schedule();
      return;
    }

    for (const effect of effects.values()) {
      if (effect.lastTimestamp === null) effect.lastTimestamp = timestamp;
      const deltaSeconds = Math.min(0.05, Math.max(0, timestamp - effect.lastTimestamp) / 1000);
      effect.lastTimestamp = timestamp;
      effect.frameAccumulator += deltaSeconds * DELETE_VIDEO_FPS;
      const recordedFrameSteps = Math.floor(effect.frameAccumulator);
      if (recordedFrameSteps === 0) continue;
      effect.frameAccumulator -= recordedFrameSteps;
      effect.frame += effect.direction === "reverse"
        ? -recordedFrameSteps * 2
        : recordedFrameSteps;
      effect.frame = Math.max(0, Math.min(DELETE_VIDEO_FORWARD_FRAMES - 1, effect.frame));
    }

    drawCurrent();
    const finished = [...effects.values()].filter((effect) => (
      effect.direction === "forward"
        ? effect.frame >= DELETE_VIDEO_FORWARD_FRAMES - 1
        : effect.frame <= 0
    ));
    removeEffects(finished);
    schedule();
  }

  function makeEffect(historyNode, particles, frame = 0, direction = "forward") {
    const renderId = `delete-effect-${nextRenderId}`;
    nextRenderId += 1;
    renderer.setEffectParticles(renderId, particles);
    const effect = {
      renderId,
      historyId: historyNode.id,
      particles,
      direction,
      frame,
      frameAccumulator: 0,
      lastTimestamp: null,
      targetHistoryId: null,
      restoreStrokes: null,
    };
    effects.set(renderId, effect);
    return effect;
  }

  function start(historyNode, particles) {
    if (!particles?.count) return false;
    historyNode.deleteEffect = { particles, effectType };
    makeEffect(historyNode, particles);
    drawCurrent();
    schedule();
    return true;
  }

  function findRestartableEffect(targetHistoryId) {
    return [...effects.values()].find((effect) => (
      effect.direction === "reverse" && effect.targetHistoryId === targetHistoryId
    ));
  }

  function canRestartDelete(targetHistoryId) {
    return Boolean(findRestartableEffect(targetHistoryId));
  }

  function restartDelete(targetHistoryId, historyNode) {
    const effect = findRestartableEffect(targetHistoryId);
    if (!effect) return false;
    effect.historyId = historyNode.id;
    effect.direction = "forward";
    effect.frameAccumulator = 0;
    effect.lastTimestamp = null;
    effect.targetHistoryId = null;
    effect.restoreStrokes = null;
    historyNode.deleteEffect = { particles: effect.particles, effectType };
    drawCurrent();
    schedule();
    return true;
  }

  function settleReassembly() {
    const reversing = [...effects.values()].filter((effect) => effect.direction === "reverse");
    removeEffects(reversing);
  }

  function undo(undoneNode, targetNode, reducedMotion) {
    if (
      undoneNode.kind !== "delete"
      || !undoneNode.deleteEffect
      || undoneNode.deleteEffect.effectType !== effectType
      || reducedMotion
    ) {
      return false;
    }

    setStrokes([]);
    let effect = [...effects.values()].find((candidate) => (
      candidate.historyId === undoneNode.id && candidate.direction === "forward"
    ));
    if (!effect) {
      effect = makeEffect(
        undoneNode,
        undoneNode.deleteEffect.particles,
        DELETE_VIDEO_FORWARD_FRAMES - 1,
        "reverse",
      );
    } else {
      effect.direction = "reverse";
    }
    effect.frameAccumulator = 0;
    effect.lastTimestamp = null;
    effect.targetHistoryId = targetNode.id;
    effect.restoreStrokes = cloneStrokes(targetNode.strokes);
    drawCurrent();
    schedule();
    return true;
  }

  function isActive() {
    return effects.size !== 0;
  }

  return {
    canRestartDelete,
    isActive,
    restartDelete,
    settleReassembly,
    start,
    undo,
  };
}
