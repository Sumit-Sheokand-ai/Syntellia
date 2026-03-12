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
        ink: "#050816",
        mist: "#e7ecff",
        pulse: "#7cf5d4",
        flare: "#ff8c6b",
        tide: "#6ca8ff"
      },
      boxShadow: {
        panel: "0 20px 80px rgba(5, 8, 22, 0.35)",
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 16px 60px rgba(124,245,212,0.18)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at top left, rgba(124, 245, 212, 0.18), transparent 32%), radial-gradient(circle at top right, rgba(108, 168, 255, 0.22), transparent 28%), radial-gradient(circle at bottom, rgba(255, 140, 107, 0.18), transparent 24%)"
      },
      fontFamily: {
        display: ["Segoe UI", "sans-serif"],
        body: ["Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
