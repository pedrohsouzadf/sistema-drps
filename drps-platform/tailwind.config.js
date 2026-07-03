module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#f4f2ee',
          surface: '#fff',
          surface2: '#f9f8f6',
          border: '#e2ddd6',
          text: '#1a1612',
          text2: '#6b6560',
          text3: '#a09a93',
          primary: '#1d4e6b',
          light: '#e8f0f5',
          medium: '#2d7aaa',
          accent: '#c8600a',
          accentLight: '#fdf0e6',
          success: '#2a7d4f',
          successBg: '#e8f5ed',
          warning: '#b07d18',
          warningBg: '#fdf6e3',
          danger: '#a02828',
          dangerBg: '#fceaea',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
      },
      borderRadius: {
        'xl': '12px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
}
