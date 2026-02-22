import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
            colors: {
                navy: {
                    50: "#e8eaf6",
                    100: "#c5cae9",
                    200: "#9fa8da",
                    300: "#7986cb",
                    400: "#5c6bc0",
                    500: "#3f51b5",
                    600: "#3949ab",
                    700: "#303f9f",
                    800: "#283593",
                    900: "#1a237e",
                    950: "#0d1257",
                },
                yellow: {
                    400: "#ffee58",
                    500: "#ffeb3b",
                    600: "#fdd835",
                    700: "#fbc02d",
                    800: "#f9a825",
                    900: "#f57f17",
                    baknus: "#ffd600",
                },
            },
            animation: {
                "bounce-slow": "bounce 1.5s infinite",
                "pulse-slow": "pulse 2s infinite",
                "fade-in": "fadeSlideIn 0.25s ease-out",
            },
            keyframes: {
                fadeSlideIn: {
                    "0%": { opacity: "0", transform: "translateY(8px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            backgroundImage: {
                "gradient-navy":
                    "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
                "gradient-brand":
                    "linear-gradient(135deg, #1a237e 0%, #ffd600 100%)",
            },
        },
    },
    plugins: [typography],
};

export default config;
