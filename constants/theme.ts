// Bold Expressive vibe — dark poster aesthetic, square radii, neon green accent.

export const theme = {
  // backgrounds
  bg: '#0d1614',
  surface: '#1a2826',
  surfaceElev: '#243634',
  surfaceMuted: '#0d1614',

  // borders
  border: 'rgba(79, 229, 102, 0.18)',
  borderStrong: 'rgba(79, 229, 102, 0.40)',

  // text
  text: '#f6fff4',
  textDim: 'rgba(246, 255, 244, 0.55)',
  textFaint: 'rgba(246, 255, 244, 0.32)',

  // accent palette
  accent: '#4FE566', // malaquita principal
  accent2: '#36DFBD', // turquesa
  accent3: '#AEF5E5', // icy aqua
  accentSoft: '#4fe56624',
  onAccent: '#0d1614',

  // chips
  chipBg: 'transparent',
  chipActive: '#4FE566',
  onChipActive: '#0d1614',

  // geometry — poster: tudo quadrado
  radiusCard: 4,
  radiusChip: 4,

  // fonts
  fontDisplay: 'SpaceGrotesk_700Bold',
  fontBody: 'SpaceGrotesk_400Regular',
  fontMono: 'SpaceGrotesk_600SemiBold', // fallback for mono labels
} as const;

export const STATUS_META = {
  normal: { label: 'Normal', short: 'OK', color: '#4FE566', textOn: '#0d2415' },
  atencao: { label: 'Atenção', short: 'AT', color: '#f5c54a', textOn: '#2a1f06' },
  lento: { label: 'Lento', short: 'LE', color: '#f08a3c', textOn: '#2a1404' },
  parado: { label: 'Parado', short: 'X', color: '#e64558', textOn: '#ffffff' },
} as const;

export type StatusType = keyof typeof STATUS_META;

// Shared text style tokens — import to avoid redefining in every screen.
export const textStyles = {
  eyebrow: {
    color: theme.textDim,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    fontWeight: '600' as const,
  },
  pageTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
    marginTop: 2,
  },
} as const;
