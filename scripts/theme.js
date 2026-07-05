const THEME_KEY = "improving-muslim:theme";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function resolveTheme(theme) {
  if (theme === "dark" || theme === "light") return theme;
  return systemThemeQuery.matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

function readTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch (error) {
    return "system";
  }
}

applyTheme(readTheme());

const onSystemThemeChange = () => {
  if (readTheme() === "system") applyTheme("system");
};
if (typeof systemThemeQuery.addEventListener === "function") {
  systemThemeQuery.addEventListener("change", onSystemThemeChange);
} else if (typeof systemThemeQuery.addListener === "function") {
  systemThemeQuery.addListener(onSystemThemeChange); // Safari < 14
}

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
