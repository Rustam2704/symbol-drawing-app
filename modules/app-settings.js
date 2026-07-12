export const THEME_COLORS = Object.freeze({
  current: {
    paper: "#fbfaf7",
    grid: "rgba(73, 68, 60, 0.16)",
    guide: "rgba(35, 124, 107, 0.24)",
    margin: "rgba(179, 52, 45, 0.18)",
    pens: ["#1f1d1a", "#237c6b", "#b3342d"],
  },
  dark: {
    paper: "#070707",
    grid: "rgba(77, 77, 77, 0.28)",
    guide: "rgba(77, 77, 77, 0.4)",
    margin: "rgba(26, 26, 26, 0.65)",
    pens: ["#b3b3b3", "#4d4d4d", "#1a1a1a"],
  },
  violet: {
    paper: "#07052f",
    grid: "rgba(51, 181, 224, 0.18)",
    guide: "rgba(16, 192, 224, 0.4)",
    margin: "rgba(145, 43, 145, 0.4)",
    pens: ["#b8f4f2", "#10c0e0", "#922b91"],
  },
  sunset: {
    paper: "#062c3c",
    grid: "rgba(45, 139, 157, 0.22)",
    guide: "rgba(78, 190, 188, 0.42)",
    margin: "rgba(244, 132, 112, 0.42)",
    pens: ["#ffe0aa", "#4ebebc", "#f48470"],
  },
});

export function createSettingsStore(storage = globalThis.localStorage) {
  function read(key) {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      storage?.setItem(key, String(value));
    } catch {
      // Preferences are optional; application behavior must not depend on storage access.
    }
  }

  return {
    readBoolean(key) {
      return read(key) === "true";
    },
    writeBoolean(key, value) {
      write(key, value);
    },
    readTheme() {
      const theme = read("symbolPracticeTheme");
      return Object.hasOwn(THEME_COLORS, theme) ? theme : "current";
    },
    writeTheme(theme) {
      write("symbolPracticeTheme", Object.hasOwn(THEME_COLORS, theme) ? theme : "current");
    },
  };
}
