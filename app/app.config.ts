// Nuxt UI theme. Colours, radii and surfaces only — control sizes are Nuxt
// UI's defaults (md: 32px tall, text-sm). The root font-size is the browser's
// (main.css), so those defaults render at the size the library designed.
export default defineAppConfig({
  ui: {
    // Pink primary on the custom pink-tinted "night" neutral (main.css);
    // violet = old Aura `help`, sky = old Aura `info`.
    colors: {
      primary: 'pink',
      neutral: 'night',
      info: 'sky',
      secondary: 'violet',
    },
    // 6px radius, centered content, medium weight for labels.
    button: {
      slots: {
        base: 'rounded-[6px] justify-center font-medium',
      },
    },
    // Form fields: night-950 well with a night-600 border, 6px radius. Focus
    // fades the 1px border to pink over 0.2s — no outline glow — with a
    // night-500 hover step.
    input: {
      slots: {
        base: 'rounded-[6px] placeholder:text-night-500 transition duration-200 focus-visible:outline-none',
      },
      variants: {
        variant: {
          outline: 'bg-night-950 ring-night-600 hover:ring-night-500',
        },
      },
    },
    textarea: {
      slots: {
        base: 'rounded-[6px] placeholder:text-night-500 transition duration-200 focus-visible:outline-none',
      },
      variants: {
        variant: {
          outline: 'bg-night-950 ring-night-600 hover:ring-night-500',
        },
      },
    },
    select: {
      slots: {
        base: 'rounded-[6px] transition duration-200 focus-visible:outline-none',
      },
      variants: {
        variant: {
          outline: 'bg-night-950 ring-night-600 hover:ring-night-500 hover:bg-night-950',
        },
      },
    },
    selectMenu: {
      slots: {
        base: 'rounded-[6px] transition duration-200 focus-visible:outline-none',
      },
      variants: {
        variant: {
          outline: 'bg-night-950 ring-night-600 hover:ring-night-500 hover:bg-night-950',
        },
      },
    },
    // Badges scale their icons with the text (chips on cards are tiny).
    badge: {
      slots: {
        base: 'rounded-[6px] font-medium',
      },
      variants: {
        size: {
          md: { leadingIcon: 'size-3', trailingIcon: 'size-3' },
        },
      },
    },
    // Overlays sit on the muted surface with a soft border.
    modal: {
      slots: {
        content: 'bg-night-900 ring ring-night-700/60 rounded-2xl shadow-2xl',
        overlay: 'bg-night-950/80 backdrop-blur-[2px]',
        title: 'font-display text-lg text-night-50',
      },
    },
    popover: {
      slots: {
        content: 'bg-night-900 ring ring-night-700/60 rounded-xl shadow-2xl',
      },
    },
    dropdownMenu: {
      slots: {
        content: 'bg-night-900 ring ring-night-700/60 rounded-xl shadow-xl',
      },
    },
    tooltip: {
      slots: {
        content: 'bg-night-800 ring ring-night-700/60 text-night-100',
      },
    },
    toast: {
      slots: {
        root: 'bg-night-900 ring ring-night-700/60 rounded-xl shadow-2xl',
        title: 'font-display',
      },
    },
    tabs: {
      slots: {
        list: 'bg-night-800 rounded-[8px]',
        indicator: 'rounded-[6px]',
      },
    },
  },
})
