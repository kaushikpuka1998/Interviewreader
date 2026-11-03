import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../index.html",
    // Company badge colours live in the roadmap data the backend serves.
    "../backend/src/main/resources/roadmaps.json",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Calm green theme: the neutral greys carry a light green tint, and the blue/indigo accents used across
        // components map to emerald/teal; decorative pink/fuchsia map to teal/cyan. Red (rose/red) stays red,
        // because it marks real warnings (errors, delete, sign out).
        // ponytail: remapping the names keeps this one file; rename the classes if blue is ever needed again.
        slate: {
          50: '#f8fcfb',
          100: '#eff8f5',
          200: '#e1efea',
          300: '#cbe1d9',
          400: '#819c92',   // muted text, same lightness as before
          500: '#5d756c',
          600: '#445951',
          700: '#404f4a',
          800: '#2d3834',
          900: '#1d2522',
          950: '#101513',
        },
        // Deeper greens than stock emerald so white button text keeps WCAG AA contrast (500 is 4.6:1, 600 is 5.5:1)
        // and green text on dark surfaces (300/400) stays bright.
        blue: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
          500: '#04855f', 600: '#047857', 700: '#065f46', 800: '#064e3b', 900: '#022c22', 950: '#011a14',
        },
        indigo: { ...colors.teal, 500: '#0d8076', 600: '#0f766e', 700: '#115e59' },
        pink: { ...colors.teal, 500: '#0d8076', 600: '#0f766e' },
        fuchsia: colors.cyan,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.slate.800'),
            '--tw-prose-headings': theme('colors.slate.900'),
            '--tw-prose-lead': theme('colors.slate.700'),
            '--tw-prose-links': theme('colors.blue.700'),
            '--tw-prose-bold': theme('colors.slate.900'),
            '--tw-prose-counters': theme('colors.slate.500'),
            '--tw-prose-bullets': theme('colors.slate.400'),
            '--tw-prose-hr': theme('colors.slate.300'),
            '--tw-prose-quotes': theme('colors.slate.900'),
            '--tw-prose-quote-borders': theme('colors.slate.400'),
            '--tw-prose-captions': theme('colors.slate.600'),
            '--tw-prose-code': theme('colors.slate.900'),
            '--tw-prose-pre-code': theme('colors.slate.100'),
            '--tw-prose-pre-bg': theme('colors.slate.900'),
            '--tw-prose-th-borders': theme('colors.slate.300'),
            '--tw-prose-td-borders': theme('colors.slate.300'),
            maxWidth: 'none',
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.slate.300'),
            '--tw-prose-headings': theme('colors.slate.100'),
            '--tw-prose-lead': theme('colors.slate.400'),
            '--tw-prose-links': theme('colors.blue.400'),
            '--tw-prose-bold': theme('colors.slate.100'),
            '--tw-prose-counters': theme('colors.slate.500'),
            '--tw-prose-bullets': theme('colors.slate.600'),
            '--tw-prose-hr': theme('colors.slate.700'),
            '--tw-prose-quotes': theme('colors.slate.100'),
            '--tw-prose-quote-borders': theme('colors.slate.600'),
            '--tw-prose-captions': theme('colors.slate.500'),
            '--tw-prose-code': theme('colors.slate.100'),
            '--tw-prose-pre-code': theme('colors.slate.100'),
            '--tw-prose-pre-bg': theme('colors.slate.800'),
            '--tw-prose-th-borders': theme('colors.slate.600'),
            '--tw-prose-td-borders': theme('colors.slate.700'),
          },
        },
      }),
    },
  },
  plugins: [],
}