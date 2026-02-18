import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-heading)", "serif"],
        mono: ["var(--font-body)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        canvas: "var(--canvas)",
        text: "var(--text)",
        muted: "var(--muted)",
        edge: "var(--edge)",
        card: "var(--card)",
        accent: "var(--accent)"
      },
      boxShadow: {
        card: "0 8px 30px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
