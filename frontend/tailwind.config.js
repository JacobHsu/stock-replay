/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TradingView Dark Theme Colors
        tv: {
          bg: '#131722',           // Main background
          surface: '#1E222D',      // Panel background
          surfaceHover: '#2A2E39', // Hover state
          border: '#2A2E39',       // Border color
          borderLight: '#363A45',  // Light border
          text: '#D1D4DC',         // Primary text
          textSecondary: '#787B86', // Secondary text
          textMuted: '#434651',    // Muted text
          primary: '#2962FF',      // Primary blue
          primaryHover: '#1E53E5', // Primary hover
          success: '#089981',      // Green (buy)
          successHover: '#0B7A6A', // Green hover
          danger: '#F23645',       // Red (sell)
          dangerHover: '#CC2E3C',  // Red hover
          warning: '#FF9800',      // Orange warning
          chart: '#131722',        // Chart background
        },
        // Keep cyber colors for backward compatibility
        cyber: {
          bg: '#131722',
          surface: '#1E222D',
          border: '#2A2E39',
          primary: '#2962FF',
          secondary: '#787B86',
          accent: '#FF9800',
          success: '#089981',
          danger: '#F23645',
          warning: '#FF9800',
        },
      },
      backgroundImage: {
        'tv-gradient': 'linear-gradient(180deg, #131722 0%, #1E222D 100%)',
      },
      boxShadow: {
        'tv': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'tv-lg': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'tv-hover': '0 4px 12px rgba(41, 98, 255, 0.15)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.2s ease-in-out',
        'slideIn': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
