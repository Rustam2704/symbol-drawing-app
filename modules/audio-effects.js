export function createAudioEffects({
  deleteRate = 2,
  reverseRate = 2,
  windowRef = globalThis.window || {},
  fetchImpl = globalThis.fetch,
  schedulePrepare = (callback) => callback(),
} = {}) {
  const AudioContextClass = windowRef.AudioContext || windowRef.webkitAudioContext;
  const OfflineAudioContextClass = windowRef.OfflineAudioContext || windowRef.webkitOfflineAudioContext;
  let audioContext = null;
  const activeDeleteSources = new Set();
  const activeReverseSources = new Set();
  let preparedDeleteSounds = null;
  let preparedReverseSounds = null;

  function ensureAudioContext() {
    if (!audioContext && AudioContextClass) audioContext = new AudioContextClass();
    return audioContext;
  }

  async function renderAcceleratedBuffer(buffer, rate) {
    const duration = buffer.duration / rate;
    const offline = new OfflineAudioContextClass(
      buffer.numberOfChannels,
      Math.ceil(duration * audioContext.sampleRate),
      audioContext.sampleRate,
    );
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(offline.destination);
    source.start(0);
    return offline.startRendering();
  }

  async function prepareDeleteSounds() {
    if (!ensureAudioContext() || !OfflineAudioContextClass) {
      return;
    }

    try {
      const paths = [
        ...Array.from({ length: 3 }, (_, index) => `./assets/finger-snap${index + 1}.ogg`),
        ...Array.from({ length: 6 }, (_, index) => `./assets/thanos_dust_${index + 1}.mp3`),
      ];
      const encoded = await Promise.all(
        paths.map(async (path) => {
          const response = await fetchImpl(path);
          if (!response.ok) {
            throw new Error(`Could not preload ${path}`);
          }
          return response.arrayBuffer();
        }),
      );
      const decoded = await Promise.all(encoded.map((source) => audioContext.decodeAudioData(source)));
      preparedDeleteSounds = {
        snaps: decoded.slice(0, 3),
        dust: await Promise.all(decoded.slice(3, 9).map((buffer) => renderAcceleratedBuffer(buffer, deleteRate))),
      };
    } catch {
      preparedDeleteSounds = null;
    }
  }

  async function prepareReverseSounds() {
    if (!ensureAudioContext() || !OfflineAudioContextClass) {
      return;
    }

    try {
      const paths = [
        ...Array.from({ length: 3 }, (_, index) => `./assets/finger-snap${index + 1}-reversed.ogg`),
        "./assets/bell-reverse.ogg?v=2",
      ];
      const encoded = await Promise.all(
        paths.map(async (path) => {
          const response = await fetchImpl(path);
          if (!response.ok) {
            throw new Error(`Could not preload ${path}`);
          }
          return response.arrayBuffer();
        }),
      );
      const decoded = await Promise.all(encoded.map((source) => audioContext.decodeAudioData(source)));
      preparedReverseSounds = {
        snaps: decoded.slice(0, 3),
        bell: await renderAcceleratedBuffer(decoded[3], reverseRate),
      };
    } catch {
      preparedReverseSounds = null;
    }
  }

  function playPreparedDeleteSound() {
    if (!audioContext || !preparedDeleteSounds) {
      return;
    }

    audioContext.resume();
    const buffers = [
      preparedDeleteSounds.snaps[Math.floor(Math.random() * preparedDeleteSounds.snaps.length)],
      preparedDeleteSounds.dust[Math.floor(Math.random() * preparedDeleteSounds.dust.length)],
    ];
    const startTime = audioContext.currentTime + 0.005;
    buffers.forEach((buffer) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      activeDeleteSources.add(source);
      source.addEventListener("ended", () => activeDeleteSources.delete(source), { once: true });
      source.start(startTime);
    });
  }

  function stopDeleteSounds() {
    activeDeleteSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source may already have finished between the click and this loop.
      }
    });
    activeDeleteSources.clear();
  }

  function playReverseSound() {
    if (!audioContext || !preparedReverseSounds) {
      return;
    }

    audioContext.resume();
    const buffers = [
      preparedReverseSounds.snaps[Math.floor(Math.random() * preparedReverseSounds.snaps.length)],
      preparedReverseSounds.bell,
    ];
    const startTime = audioContext.currentTime + 0.005;
    buffers.forEach((buffer) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      activeReverseSources.add(source);
      source.addEventListener("ended", () => activeReverseSources.delete(source), { once: true });
      source.start(startTime);
    });
  }

  function stopSources(sources) {
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already be stopped.
      }
    });
    sources.clear();
  }

  function dispose() {
    stopSources(activeDeleteSources);
    stopSources(activeReverseSources);
    const closeResult = audioContext?.close?.();
    closeResult?.catch?.(() => {});
    audioContext = null;
    preparedDeleteSounds = null;
    preparedReverseSounds = null;
  }

  schedulePrepare(() => {
    prepareDeleteSounds();
    prepareReverseSounds();
  });

  return {
    dispose,
    playPreparedDeleteSound,
    playReverseSound,
    stopDeleteSounds,
  };
}
