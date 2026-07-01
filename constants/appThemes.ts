export type AppThemeId =
  | 'dinamico'
  | 'midnight-indigo'
  | 'bordeaux-velvet'
  | 'mocha-earth'
  | 'magic-black';

export interface AppTheme {
  id: AppThemeId;
  name: string;
  isDynamic: boolean;
  /** Cor de fundo do banner (também usada como preview no seletor) */
  bg: string;
  /** Cor de texto sobre o banner */
  text: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'dinamico',
    name: 'Dinâmico',
    isDynamic: true,
    bg: '#4FE566', // preview: estado "normal"
    text: '#0d2415',
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    isDynamic: false,
    bg: '#212842',
    text: '#F0E7D5',
  },
  {
    id: 'bordeaux-velvet',
    name: 'Bordeaux Velvet',
    isDynamic: false,
    bg: '#53161D',
    text: '#FFFBF0',
  },
  {
    id: 'mocha-earth',
    name: 'Mocha Earth',
    isDynamic: false,
    bg: '#4B3935',
    text: '#F0E7D5',
  },
  {
    id: 'magic-black',
    name: 'Magic Black',
    isDynamic: false,
    bg: '#373A3E',
    text: '#E3E3DB',
  },
];
