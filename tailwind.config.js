module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/app/_components/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#E10600",
          yellow: "#FFC300",
          black: "#0B0B0D",
          graphite: "#1C1C1F",
          border: "#2A2A2E",
          text2: "#9CA3AF",
          success: "#16A34A",
          info: "#2563EB",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        soft: "0 8px 20px rgba(0,0,0,0.25)",
        glowRed: "0 0 0 3px rgba(225,6,0,0.25)",
      },
    },
  },
  plugins: [],
};
