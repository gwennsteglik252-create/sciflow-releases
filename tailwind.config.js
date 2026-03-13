/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './App.tsx',
        './index.tsx',
        './components/**/*.{ts,tsx}',
        './hooks/**/*.{ts,tsx}',
        './context/**/*.{ts,tsx}',
        './services/**/*.{ts,tsx}',
        './locales/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};

