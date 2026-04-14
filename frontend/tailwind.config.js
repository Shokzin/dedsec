export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dedsec: {
          bg: "#0a0a0a",
          card: "#111111",
          border: "#1f1f1f",
          green: "#00ff41",
          cyan: "#00d4ff",
          red: "#ff3131",
          yellow: "#ffd700",
          muted: "#666666",
        }
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      }
    },
  },
  plugins: [],
}