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
