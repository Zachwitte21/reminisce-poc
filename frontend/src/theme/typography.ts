import { TextStyle } from 'react-native';

export const typography = {
  heading1: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 40,
  } as TextStyle,

  heading2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  } as TextStyle,

  heading3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  } as TextStyle,

  body: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
  } as TextStyle,

  bodySmall: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,

  button: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  buttonSmall: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
