import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { User, LoginRequest, RegisterRequest } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  acceptInvite: (inviteCode: string, data: RegisterRequest) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  refreshUser: () => Promise<void>;
  updateAvatar: (photo: { uri: string; type?: string; fileName?: string | null }) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (data: LoginRequest) => {
        set({ isLoading: true });
        try {
          const response = await api.login(data);
          api.setToken(response.access_token);
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true });
        console.log('[AuthStore] Starting registration for:', data.email);
        try {
          await api.register(data);
          console.log('[AuthStore] Registration successful, attempting login...');
          await get().login({ email: data.email, password: data.password });
        } catch (error) {
          console.error('[AuthStore] Registration failed:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      acceptInvite: async (inviteCode: string, data: RegisterRequest) => {
        set({ isLoading: true });
        console.log('[AuthStore] Accepting invite with code:', inviteCode, 'for:', data.email);
        try {
          await api.acceptInvitation(inviteCode, data);
          console.log('[AuthStore] Invite accepted successfully, attempting login...');
          await get().login({ email: data.email, password: data.password });
        } catch (error) {
          console.error('[AuthStore] acceptInvite failed:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        api.setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User | null) => set({ user }),

      setToken: (token: string | null) => {
        api.setToken(token);
        set({ token, isAuthenticated: !!token });
      },

      refreshUser: async () => {
        try {
          const user = await api.request<User>('/api/auth/me');
          set({ user });
        } catch (error) {
          console.error('[AuthStore] refreshUser failed:', error);
        }
      },

      updateAvatar: async (photo) => {
        set({ isLoading: true });
        try {
          const updatedUser = await api.uploadAvatar(photo);
          set({ user: updatedUser, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.setToken(state.token);
        }
      },
    }
  )
);
