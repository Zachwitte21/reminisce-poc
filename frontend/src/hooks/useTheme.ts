import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ThemeColors } from '../theme/colors';
import { useSettingsStore } from '../stores/settings-store';

export function useTheme(): ThemeColors {
    const systemColorScheme = useColorScheme();
    const themePreference = useSettingsStore((state) => state.themePreference);

    const isDark =
        themePreference === 'dark' ||
        (themePreference === 'system' && systemColorScheme === 'dark');

    return isDark ? darkColors : lightColors;
}
