import { create } from 'zustand';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  company_id: number;
  company_name: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const getInitialAuth = () => {
  try {
    const savedToken = localStorage.getItem('rudra_auth_token');
    const savedUser = localStorage.getItem('rudra_auth_user');
    if (savedToken && savedUser) {
      return {
        token: savedToken,
        user: JSON.parse(savedUser) as AuthUser,
        isAuthenticated: true,
      };
    }
  } catch (err) {
    console.error('Failed to parse saved auth', err);
  }
  return {
    token: null,
    user: null,
    isAuthenticated: false,
  };
};

const initial = getInitialAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  isAuthenticated: initial.isAuthenticated,

  setAuth: (token: string, user: AuthUser) => {
    try {
      localStorage.setItem('rudra_auth_token', token);
      localStorage.setItem('rudra_auth_user', JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save auth to localStorage', e);
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    try {
      localStorage.removeItem('rudra_auth_token');
      localStorage.removeItem('rudra_auth_user');
    } catch (e) {
      console.error('Failed to clear auth from localStorage', e);
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
