const THEME_KEY = "improving-muslim:theme";

function applyTheme(theme) {
  const selectedTheme = ["light", "dark"].includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = selectedTheme;
}

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch (error) {
    return "system";
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
