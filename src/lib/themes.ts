export type Theme = {
  id: string;
  name: string;
};

const THEMES_KEY = "dartlab:themes";
const MAPPING_KEY = "dartlab:company-themes";

export const ALL_THEME_ID = "__all__";
export const UNCATEGORIZED_THEME_ID = "__none__";

const DEFAULT_THEMES: Theme[] = [
  { id: "theme-semicon", name: "반도체" },
  { id: "theme-bio", name: "바이오" },
];

const DEFAULT_MAPPING: Record<string, string> = {
  "005930": "theme-semicon",
  "000660": "theme-semicon",
  "068270": "theme-bio",
};

export function loadThemes(): Theme[] {
  if (typeof window === "undefined") return DEFAULT_THEMES;
  try {
    const raw = window.localStorage.getItem(THEMES_KEY);
    if (raw === null) return DEFAULT_THEMES;
    const parsed = JSON.parse(raw) as Theme[];
    return Array.isArray(parsed) ? parsed : DEFAULT_THEMES;
  } catch {
    return DEFAULT_THEMES;
  }
}

export function saveThemes(themes: Theme[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  } catch {}
}

export function loadCompanyThemes(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_MAPPING;
  try {
    const raw = window.localStorage.getItem(MAPPING_KEY);
    if (raw === null) return DEFAULT_MAPPING;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : DEFAULT_MAPPING;
  } catch {
    return DEFAULT_MAPPING;
  }
}

export function saveCompanyThemes(mapping: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
  } catch {}
}

export function genThemeId(): string {
  return `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function pruneMappingForThemes(
  mapping: Record<string, string>,
  themes: Theme[],
): Record<string, string> {
  const themeIds = new Set(themes.map((t) => t.id));
  const next: Record<string, string> = {};
  for (const [ticker, themeId] of Object.entries(mapping)) {
    if (themeIds.has(themeId)) next[ticker] = themeId;
  }
  return next;
}
