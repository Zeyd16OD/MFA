/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light theme colors
        primary: {
          DEFAULT: 'rgb(76 102 43)',
          container: 'rgb(205 237 163)',
          on: 'rgb(255 255 255)',
          onContainer: 'rgb(53 78 22)',
        },
        secondary: {
          DEFAULT: 'rgb(88 98 73)',
          container: 'rgb(220 231 200)',
          on: 'rgb(255 255 255)',
          onContainer: 'rgb(64 74 51)',
        },
        tertiary: {
          DEFAULT: 'rgb(56 102 99)',
          container: 'rgb(188 236 231)',
          on: 'rgb(255 255 255)',
          onContainer: 'rgb(31 78 75)',
        },
        error: {
          DEFAULT: 'rgb(186 26 26)',
          container: 'rgb(255 218 214)',
          on: 'rgb(255 255 255)',
          onContainer: 'rgb(147 0 10)',
        },
        background: 'rgb(249 250 239)',
        onBackground: 'rgb(26 28 22)',
        surface: {
          DEFAULT: 'rgb(249 250 239)',
          dim: 'rgb(218 219 208)',
          bright: 'rgb(249 250 239)',
          container: {
            lowest: 'rgb(255 255 255)',
            low: 'rgb(243 244 233)',
            DEFAULT: 'rgb(238 239 227)',
            high: 'rgb(232 233 222)',
            highest: 'rgb(226 227 216)',
          },
          variant: 'rgb(225 228 213)',
        },
        onSurface: 'rgb(26 28 22)',
        onSurfaceVariant: 'rgb(68 72 61)',
        outline: {
          DEFAULT: 'rgb(117 121 108)',
          variant: 'rgb(197 200 186)',
        },
      },
    },
  },
  plugins: [],
}
