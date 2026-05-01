/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'hsl(var(--color-ink))',
          muted: 'hsl(var(--color-ink-muted))',
          soft: 'hsl(var(--color-ink-soft))',
        },
        paper: {
          DEFAULT: 'hsl(var(--color-paper))',
          aged: 'hsl(var(--color-paper-aged))',
          warm: 'hsl(var(--color-paper-warm))',
        },
        brass: {
          DEFAULT: 'hsl(var(--color-brass))',
          bright: 'hsl(var(--color-brass-bright))',
          muted: 'hsl(var(--color-brass-muted))',
        },
        panel: {
          DEFAULT: 'hsl(var(--color-panel))',
          elevated: 'hsl(var(--color-panel-elevated))',
          border: 'hsl(var(--color-panel-border))',
        },
        oxblood: 'hsl(var(--color-oxblood))',
        success: 'hsl(var(--color-success))',
        warning: 'hsl(var(--color-warning))',
        danger: 'hsl(var(--color-danger))',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Libre Franklin', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        brass: 'var(--shadow-brass)',
        inset: 'var(--shadow-inset)',
      },
      backgroundImage: {
        paper:
          'radial-gradient(circle at 20% 15%, hsl(var(--color-paper-warm) / 0.55), transparent 38%), linear-gradient(135deg, hsl(var(--color-paper)), hsl(var(--color-paper-aged)))',
        ink:
          'radial-gradient(circle at top left, hsl(var(--color-panel-elevated) / 0.75), transparent 34%), linear-gradient(135deg, hsl(var(--color-ink)), hsl(218 22% 6%))',
      },
      borderRadius: {
        ui: 'var(--radius-ui)',
        panel: 'var(--radius-panel)',
      },
    },
  },
  plugins: [],
};
