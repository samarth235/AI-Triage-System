/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#0D1117",
        panel: "rgba(15, 23, 42, 0.5)",
        panelSolid: "#111827",
        commandBlue: "#38bdf8",
        alertRed: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 10px 35px rgba(2, 6, 23, 0.45)",
        "status-red": "0 0 0 1px rgba(239,68,68,.35), 0 0 30px rgba(239,68,68,.28)",
        "status-orange": "0 0 0 1px rgba(249,115,22,.3), 0 0 28px rgba(249,115,22,.24)",
      },
      keyframes: {
        "alert-pulse": {
          "0%, 100%": { opacity: "0.9" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "alert-pulse": "alert-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

