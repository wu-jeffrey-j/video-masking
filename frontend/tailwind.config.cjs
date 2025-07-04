/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'figma-text-primary': '#30305D',
        'figma-text-secondary': '#56697F',
        'figma-placeholder': '#999999',
        'figma-button-disabled-bg': '#D5D5D5',
        'figma-border-gray': '#93A0AF',
        'figma-icon-blue': '#019AF9',
        'figma-icon-purple': '#8964F9',
        'figma-gradient-start': '#7766CD',
        'figma-gradient-end': '#02C7F8',
      },
      fontFamily: {
        inconsolata: ['Inconsolata', 'monospace'],
        albert: ['Albert Sans', 'sans-serif'],
      },
      boxShadow: {
        'figma-input-group': '0px 0px 20px 2px rgba(0, 0, 0, 0.07)',
      },
      borderRadius: {
        'figma-lg': '24px',
        'figma-md': '12px',
        'figma-pill': '500px',
      }
    },
  },
  plugins: [],
};
