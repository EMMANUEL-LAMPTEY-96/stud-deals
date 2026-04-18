import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065' },
        vendor: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',500:'#22c55e',600:'#16a34a',700:'#15803d' },
      },
      animation: { 'fade-in':'fadeIn 0.4s ease-out','slide-up':'slideUp 0.4s ease-out','pulse-soft':'pulseSoft 2s ease-in-out infinite' },
      keyframes: {
        fadeIn:{ from:{opacity:'0'},to:{opacity:'1'} },
        slideUp:{ from:{opacity:'0',transform:'translateY(16px)'},to:{opacity:'1',transform:'translateY(0)'} },
        pulseSoft:{ '0%,100%':{opacity:'1'},'50%':{opacity:'0.7'} },
      },
    },
  },
  plugins: [],
}
export default config
