import type { Settings } from "@/lib/types";

export const THEME_STORAGE_KEY = "theme";

const DEFAULT_FONT_SIZE = 15;
const DEFAULT_ACCENT = "#5b5bd6";

type UiThemeSettings = Partial<Pick<Settings, "ui_font_size" | "ui_accent_color">>;
export type ThemePreference = "light" | "dark";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function normalizeHexColor(value?: string) {
  if (!value) {
    return DEFAULT_ACCENT;
  }
  let normalized = value.trim().toLowerCase();
  if (!normalized.startsWith("#")) {
    normalized = `#${normalized}`;
  }
  if (normalized.length === 4) {
    normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    return DEFAULT_ACCENT;
  }
  return normalized;
}

function hexToRgb(value: string): Rgb | null {
  const normalized = normalizeHexColor(value);
  if (normalized.length !== 7) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  const toHex = (channel: number) => clampChannel(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shade(rgb: Rgb, amount: number) {
  const factor = 1 + amount;
  return {
    r: clampChannel(rgb.r * factor),
    g: clampChannel(rgb.g * factor),
    b: clampChannel(rgb.b * factor),
  };
}

export function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

export function resolveThemePreference(preference: ThemePreference | null): ThemePreference {
  if (preference) {
    return preference;
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyThemePreference(preference: ThemePreference | null) {
  if (typeof document === "undefined") {
    return;
  }
  const resolved = resolveThemePreference(preference);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyThemePreference(preference);
}

export function applyUiTheme(settings?: UiThemeSettings) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const fontSize = typeof settings?.ui_font_size === "number" ? settings.ui_font_size : DEFAULT_FONT_SIZE;
  const accent = normalizeHexColor(settings?.ui_accent_color);
  const rgb = hexToRgb(accent) ?? { r: 91, g: 91, b: 214 };
  const hover = rgbToHex(shade(rgb, -0.16));

  root.style.setProperty("--ui-font-size", `${fontSize}px`);
  root.style.setProperty("--ui-line-height", "1.6");
  root.style.setProperty("--accent-custom", accent);
  root.style.setProperty("--accent-custom-hover", hover);
  root.style.setProperty("--accent-custom-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);
}
