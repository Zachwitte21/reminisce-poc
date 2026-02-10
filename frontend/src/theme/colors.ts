export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  surface: string;
  success: string;
  successLight: string;
  danger: string;
  dangerDark: string;
  warning: string;
  text: string;
  textSecondary: string;
  textLight: string;
  textInverse: string;
  border: string;
  borderLight: string;
  overlay: string;
  overlayLight: string;
}

export const lightColors: ThemeColors = {
  primary: '#00b0f0',
  primaryDark: '#0084b5',
  primaryLight: '#33c0f3',

  background: '#f5fcff',
  surface: '#FFFFFF',

  success: '#7dd421',
  successLight: '#97dc4d',

  danger: '#FF6B6B',
  dangerDark: '#E55555',

  warning: '#FFA726',

  text: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  textInverse: '#FFFFFF',

  border: '#d9d8d4',
  borderLight: '#e6e5e1',

  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const darkColors: ThemeColors = {
  primary: '#0fbfff',
  primaryDark: '#0099cc',
  primaryLight: '#3fcbff',

  background: '#00070a',
  surface: '#121212',

  success: '#88de2b',
  successLight: '#a0e555',

  danger: '#FF8585',
  dangerDark: '#FF5C5C',

  warning: '#FFB74D',

  text: '#cccccc',
  textSecondary: '#999999',
  textLight: '#666666',
  textInverse: '#121212',

  border: '#2c2b27',
  borderLight: '#3e3d36',

  overlay: 'rgba(0, 0, 0, 0.8)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

export type ColorKey = keyof ThemeColors;

// For backward compatibility during migration
export const colors = lightColors;
