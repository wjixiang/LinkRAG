/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", 
  theme: {
    extend: {
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
        '7xl': '4.5rem',
        '8xl': '6rem',
        '9xl': '8rem',
      },
      spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        accent: "hsl(var(--accent))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'hsl(var(--foreground))',
            '--tw-prose-headings': 'hsl(var(--foreground))',
            '--tw-prose-lead': 'hsl(var(--muted-foreground))',
            '--tw-prose-links': 'hsl(var(--primary))',
            '--tw-prose-bold': 'hsl(var(--foreground))',
            '--tw-prose-counters': 'hsl(var(--muted-foreground))',
            '--tw-prose-bullets': 'hsl(var(--muted-foreground))',
            '--tw-prose-hr': 'hsl(var(--border))',
            '--tw-prose-quotes': 'hsl(var(--foreground))',
            '--tw-prose-quote-borders': 'hsl(var(--border))',
            '--tw-prose-captions': 'hsl(var(--muted-foreground))',
            '--tw-prose-code': 'hsl(var(--foreground))',
            '--tw-prose-pre-code': 'hsl(var(--foreground))',
            '--tw-prose-pre-bg': 'hsl(var(--card))',
            '--tw-prose-th-borders': 'hsl(var(--border))',
            '--tw-prose-td-borders': 'hsl(var(--border))',
            
            // 覆盖默认样式
            a: {
              color: 'hsl(var(--link))',
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            h1: {
              color: 'hsl(var(--h1))',
              fontWeight: '600',
              fontSize: theme('fontSize.3xl'),
              borderBottomWidth: '1px',
              borderBottomColor: 'hsl(var(--border))',
              paddingBottom: theme('spacing.2'),
              marginBottom: theme('spacing.4'),
            },
            h2: {
              color: 'hsl(var(--h2))',
              fontWeight: '600',
              fontSize: theme('fontSize.2xl'),
              borderBottomWidth: '1px',
              borderBottomColor: 'hsl(var(--border))',
              paddingBottom: theme('spacing.2'),
              marginTop: theme('spacing.8'),
              marginBottom: theme('spacing.4'),
            },
            h3: {
              color: 'hsl(var(--h3))',
              fontWeight: '600',
              fontSize: theme('fontSize.2xl'),
              marginTop: theme('spacing.6'),
              marginBottom: theme('spacing.3'),
            },
            blockquote: {
              fontStyle: 'italic',
              borderLeftWidth: '4px',
              borderLeftColor: 'hsl(var(--border))',
              paddingLeft: theme('spacing.4'),
              color: 'hsl(var(--muted-foreground))',
            },
            'blockquote p:first-of-type::before': {
              content: 'none',
            },
            'blockquote p:last-of-type::after': {
              content: 'none',
            },
            code: {
              color: 'hsl(var(--foreground))',
              fontWeight: '500',
              backgroundColor: 'hsl(var(--muted))',
              padding: `${theme('spacing.1')} ${theme('spacing.1')}`,
              borderRadius: theme('borderRadius.md'),
              fontSize: '0.875em',
            },
            'code::before': {
              content: 'none',
            },
            'code::after': {
              content: 'none',
            },
            pre: {
              backgroundColor: 'hsl(var(--card))',
              borderRadius: theme('borderRadius.md'),
              padding: theme('spacing.4'),
              overflowX: 'auto',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              fontSize: '0.875em',
              lineHeight: '1.7142857',
            },
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              marginTop: theme('spacing.4'),
              marginBottom: theme('spacing.4'),
            },
            thead: {
              borderBottomWidth: '1px',
              borderBottomColor: 'hsl(var(--border))',
            },
            'thead th': {
              fontWeight: '600',
              padding: theme('spacing.2'),
              backgroundColor: 'hsl(var(--muted))',
            },
            'tbody tr': {
              borderBottomWidth: '1px',
              borderBottomColor: 'hsl(var(--border))',
            },
            'tbody tr:last-child': {
              borderBottomWidth: '0',
            },
            'tbody td': {
              padding: theme('spacing.2'),
            },
            hr: {
              borderTopWidth: '1px',
              borderColor: 'hsl(var(--border))',
              marginTop: theme('spacing.8'),
              marginBottom: theme('spacing.8'),
            },
            img: {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: theme('borderRadius.md'),
            },
            ol: {
              listStyleType: 'decimal',
              marginLeft: theme('spacing.6'),
            },
            ul: {
              listStyleType: 'disc',
              marginLeft: theme('spacing.6'),
            },
            li: {
              marginTop: theme('spacing.2'),
              marginBottom: theme('spacing.2'),
            },
            'li::marker': {
              color: 'hsl(var(--muted-foreground))',
            },
            // 'a .internal': {
            //   color: 'hsl(var(--muted-foreground))',
            // }

          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
