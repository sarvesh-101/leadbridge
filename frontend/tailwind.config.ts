import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
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
          50: "hsl(30 85% 96%)",
          100: "hsl(30 80% 88%)",
          200: "hsl(30 70% 74%)",
          300: "hsl(30 65% 62%)",
          400: "hsl(30 75% 52%)",
          500: "hsl(30 85% 55%)",
          600: "hsl(30 85% 48%)",
          700: "hsl(30 85% 40%)",
          800: "hsl(30 85% 30%)",
          900: "hsl(30 85% 18%)",
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
        /* ── Converza design tokens ──────────────────────────────────
           These resolve through rgb() channels so opacity modifiers work:
           `bg-success/10`, `border-line/40`, `text-ink-soft/70`. Never use
           the arbitrary `bg-[var(--token)]/10` form — Tailwind drops it. */
        canvas: "rgb(var(--bg-primary-rgb) / <alpha-value>)",
        "canvas-deep": "rgb(var(--bg-footer-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--bg-secondary-rgb) / <alpha-value>)",
          raised: "rgb(var(--bg-elevated-rgb) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--text-primary-rgb) / <alpha-value>)",
          soft: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
          muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--border-default-rgb) / <alpha-value>)",
          subtle: "rgb(var(--border-subtle-rgb) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--accent-primary-rgb) / <alpha-value>)",
          soft: "rgb(var(--accent-secondary-rgb) / <alpha-value>)",
          deep: "rgb(var(--accent-deep-rgb) / <alpha-value>)",
          copper: "rgb(var(--accent-copper-rgb) / <alpha-value>)",
          glow: "rgba(242, 140, 69, 0.12)",
        },
        success: "rgb(var(--semantic-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--semantic-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--semantic-error-rgb) / <alpha-value>)",
        "neutral-soft": "rgb(var(--semantic-neutral-rgb) / <alpha-value>)",
        gold: {
          DEFAULT: "hsl(45 70% 55%)",
          dim: "rgba(242, 140, 69, 0.19)",
        },

      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Clash Display", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        gradient: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "sonar-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "marquee-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-border": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "waveform": {
          "0%, 100%": { height: "4px" },
          "50%": { height: "16px" },
        },
        "countdown-pulse": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.02)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        shimmer: "shimmer 2s infinite",
        float: "float 3s ease-in-out infinite",
        pulse: "pulse 2s ease-in-out infinite",
        gradient: "gradient 8s ease infinite",
        "sonar-ring": "sonar-ring 1.5s ease-out infinite",
        "marquee-scroll": "marquee-scroll 30s linear infinite",
        "pulse-border": "pulse-border 1.5s ease-in-out infinite",
        "waveform": "waveform 0.8s ease-in-out infinite",
        "countdown-pulse": "countdown-pulse 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
