import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#060611",
        mist: "#eef0ff",
        // Mature, restrained accent palette
        pulse: "#7c6aff",   // electric violet (was neon teal)
        flare: "#d4a853",   // warm gold (was coral orange)
        tide: "#818cf8",    // soft indigo (was bright blue)
        sage: "#2dd4bf",    // muted teal (retained as tertiary)
      },
      boxShadow: {
        panel: "0 28px 80px rgba(4, 4, 18, 0.52)",
        elevated: "0 1px 0 0 rgba(255,255,255,0.09) inset, 0 40px 100px rgba(4, 4, 20, 0.62)",
        glow: "0 0 0 1px rgba(255,255,255,0.07), 0 16px 60px rgba(124,106,255,0.16)",
        "glow-sm": "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(124,106,255,0.10)",
      },
      backgroundImage: {
        mesh: "radial-gradient(ellipse 80% 50% at 65% -10%, rgba(80,55,200,0.14), transparent), radial-gradient(ellipse 50% 40% at 15% 55%, rgba(20,50,130,0.08), transparent)"
      },
      fontFamily: {
        display: ["var(--font-inter)", "Segoe UI", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "Segoe UI", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        "tightest": "-0.05em",
        "display": "-0.04em",
      }
    }
  },
  plugins: []
};

export default config;
