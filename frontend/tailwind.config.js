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
        // Soft pink theme: the neutral greys carry a light rose tint, and the blue/indigo
        // accents used across components map to pink/rose.
        // ponytail: remapping the names keeps this one file; rename the classes if blue is ever needed again.
        slate: {
          50: '#fdf7f9',
          100: '#f9eef2',
          200: '#f1dfe6',
          300: '#e4c8d3',
          400: '#a07d8c',   // muted text: ~3.8:1 on white, still ~5:1 on the dark surfaces
          500: '#79596a',
          600: '#5c4150',
          700: '#523d47',
          800: '#3a2b33',
          900: '#261c22',
          950: '#160f13',
        },
        // Deeper pinks than stock pink so white button text keeps WCAG AA contrast (500+ is >= 4.6:1) and
        // pink text on dark surfaces (300/400) stays bright.
        blue: {
          50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
          500: '#db2777', 600: '#be185d', 700: '#9d174d', 800: '#831843', 900: '#500724', 950: '#3b0418',
        },
        indigo: colors.rose,
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