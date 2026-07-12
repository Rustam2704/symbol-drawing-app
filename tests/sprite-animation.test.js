import assert from "node:assert/strict";
import test from "node:test";

import { createSpriteAnimation } from "../modules/sprite-animation.js";

test("sprite animation restarts and disposes its interval", () => {
  const draws = [];
  const cleared = [];
  let intervalCallback;
  class FakeImage {
    complete = true;
    naturalWidth = 320;
    addEventListener(type, listener) {
      this.listener = listener;
    }
    removeEventListener() {
      this.listener = null;
    }
    set src(value) {
      this.source = value;
    }
  }
  const animation = createSpriteAnimation({
    canvas: {
      getContext: () => ({
        clearRect() {},
        drawImage(...args) {
          draws.push(args);
        },
      }),
    },
    source: "sprite.png",
    frameSize: 80,
    frameCount: 2,
    frameDuration: 10,
    ImageClass: FakeImage,
    setIntervalFn(callback) {
      intervalCallback = callback;
      return 7;
    },
    clearIntervalFn(id) {
      cleared.push(id);
    },
  });
  animation.play();
  intervalCallback();
  intervalCallback();
  assert.ok(draws.length >= 3);
  animation.play();
  animation.dispose();
  assert.ok(cleared.includes(7));
});
