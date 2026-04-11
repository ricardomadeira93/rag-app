import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-page)",
        ink: "var(--text-primary)",
        line: "var(--border-soft)",
        panel: "var(--bg-surface)",
        muted: "var(--text-muted)",
        warning: "var(--warning)",
        warningSoft: "var(--warning-light)",
        accent: "var(--accent)",
        accentSoft: "var(--accent-light)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
