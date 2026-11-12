import type { Config } from 'tailwindcss';

// "Illuminated ledger" design tokens: ink-indigo grounds, aged-brass gold,
// wax-seal accents. Deliberately NOT neon-on-black and NOT cream-and-terracotta.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#100F17', soft: '#15131E' },
        surface: { DEFAULT: '#1B1826', raised: '#242032', hover: '#2B2740' },
        hairline: '#332F47',
        parchment: { DEFAULT: '#EDEAF6', muted: '#A39EBD', dim: '#7A7694' },
        gold: { DEFAULT: '#D4A94E', bright: '#F0C869', dim: '#8A6F35' },
        arcane: { DEFAULT: '#7C6FE8', bright: '#9B8FFF', dim: '#4A4394' },
        ember: { DEFAULT: '#C9503F', bright: '#E36B54' },
        sage: { DEFAULT: '#6FA287', bright: '#89C2A4' },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        body: ['"Manrope Variable"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        seal: '0 1px 0 0 rgba(237,234,246,0.05) inset, 0 10px 28px -10px rgba(0,0,0,0.7)',
        glow: '0 0 26px -4px rgba(212,169,78,0.45)',
      },
      keyframes: {
        'crest-pulse': { '0%,100%': { filter: 'drop-shadow(0 0 0 rgba(212,169,78,0))' }, '50%': { filter: 'drop-shadow(0 0 10px rgba(212,169,78,0.55))' } },
        'float-up': { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-34px)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'crest-pulse': 'crest-pulse 2.6s ease-in-out infinite',
        'float-up': 'float-up 1.2s ease-out forwards',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
