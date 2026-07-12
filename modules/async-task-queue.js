function abortError() {
  const error = new Error("Task queue was cleared.");
  error.name = "AbortError";
  return error;
}

export function createAsyncTaskQueue({ concurrency = 2 } = {}) {
  const limit = Math.max(1, Math.floor(concurrency));
  const pending = [];
  let active = 0;

  function drain() {
    while (active < limit && pending.length) {
      const entry = pending.shift();
      active += 1;
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  function run(task) {
    return new Promise((resolve, reject) => {
      pending.push({ task, resolve, reject });
      drain();
    });
  }

  function clear() {
    const error = abortError();
    pending.splice(0).forEach((entry) => entry.reject(error));
  }

  return {
    clear,
    run,
    get activeCount() {
      return active;
    },
    get pendingCount() {
      return pending.length;
    },
  };
}
