import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          subtle: "hsl(var(--surface-subtle))",
        },
        verified: {
          DEFAULT: "hsl(var(--verified))",
          bg: "hsl(var(--verified-bg))",
        },
        cyan: {
          DEFAULT: "hsl(var(--cyan))",
        },
        risk: {
          high: "hsl(var(--risk-high))",
          "high-bg": "hsl(var(--risk-high-bg))",
          med: "hsl(var(--risk-med))",
          "med-bg": "hsl(var(--risk-med-bg))",
          low: "hsl(var(--risk-low))",
          "low-bg": "hsl(var(--risk-low-bg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 18px 40px rgba(59, 130, 246, 0.18)",
        "glow-cyan": "0 22px 44px rgba(20, 184, 166, 0.18)",
        card: "0 18px 48px rgba(15, 23, 42, 0.08)",
      },
      backgroundImage: {
        "cyan-gradient": "linear-gradient(135deg, #14B8A6, #3B82F6)",
      },
    },
  },
  plugins: [],
};

export default config;
