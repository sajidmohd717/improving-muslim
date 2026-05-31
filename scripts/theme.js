const THEME_KEY = "improving-muslim:theme";

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
}

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch (error) {
    return "light";
  }
}

applyTheme(readTheme());

window.improvingMuslimTheme = {
  key: THEME_KEY,
  read: readTheme,
  set(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      return;
    }
    applyTheme(theme);
  },
};
