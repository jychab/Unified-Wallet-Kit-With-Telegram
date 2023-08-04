const plugin = require('tailwindcss/plugin')

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'jupiter-input-light': '#EBEFF1',
        'jupiter-bg': '#3A3B43',
        'jupiter-dark-bg': '#292A33',
        'jupiter-jungle-green': '#24AE8F',
        'jupiter-primary': '#FBA43A',
        warning: '#FAA63C',

        'v2-primary': 'rgba(199, 242, 132, 1)',
        'v2-background': '#304256',
        'v2-background-dark': '#19232D',
        'v2-lily': '#E8F9FF',
      },
      transitionProperty: {
        'height': 'height',
        'max-height': 'max-height',
      },
      keyframes: {
        'fade-in': {
          '0%': {
            opacity: '0.2',
          },
          '100%': {
            opacity: '1',
          },
        },
        'fade-out': {
          '0%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-in-out',
        'fade-out': 'fade-out 0.5s ease-out',
      },
      backgroundImage: {
        'v2-text-gradient': 'linear-gradient(247.44deg, #C7F284 13.88%, #00BEF0 99.28%)',
      }
    },
  },
}
