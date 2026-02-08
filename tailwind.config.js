/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1', // Indigo 500
          foreground: '#ffffff',
          dark: '#4f46e5',
        },
        secondary: {
          DEFAULT: '#10b981', // Emerald 500
          foreground: '#ffffff',
          dark: '#059669',
        },
        accent: {
          DEFAULT: '#f59e0b', // Amber 500
          foreground: '#ffffff',
        },
        background: {
          DEFAULT: '#ffffff',
          alt: '#f8fafc', // Slate 50
          dark: '#0f172a', // Slate 900
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#1e293b', // Slate 800
        }
      },
      borderRadius: {
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}

