import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

interface SettingsState {
    themePreference: ThemePreference;
    setThemePreference: (theme: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            themePreference: 'system',
            setThemePreference: (theme) => set({ themePreference: theme }),
        }),
        {
            name: 'reminisce-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
