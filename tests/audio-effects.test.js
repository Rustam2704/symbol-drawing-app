import assert from "node:assert/strict";
import test from "node:test";

import { createAudioEffects } from "../modules/audio-effects.js";

test("audio preparation is scheduled and no-op environments remain safe", () => {
  let scheduled;
  const effects = createAudioEffects({
    windowRef: {},
    fetchImpl: () => {
      throw new Error("fetch should not run without an audio context");
    },
    schedulePrepare(callback) {
      scheduled = callback;
    },
  });
  assert.equal(typeof scheduled, "function");
  assert.doesNotThrow(() => scheduled());
  assert.doesNotThrow(() => effects.playPreparedDeleteSound());
  assert.doesNotThrow(() => effects.playReverseSound());
  assert.doesNotThrow(() => effects.stopDeleteSounds());
  assert.doesNotThrow(() => effects.dispose());
});

test("audio context creation is deferred until scheduled preparation", () => {
  let scheduled;
  let contextCount = 0;
  class AudioContext {
    constructor() {
      contextCount += 1;
    }
    close() {}
  }
  const effects = createAudioEffects({
    windowRef: { AudioContext },
    schedulePrepare: (callback) => { scheduled = callback; },
  });
  assert.equal(contextCount, 0);
  scheduled();
  assert.equal(contextCount, 1);
  effects.dispose();
});
