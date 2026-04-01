import { AuthTokens } from './session';

const SESSION_STORAGE_KEY = 'weather-dashboard-session';

export const persistSession = (session: AuthTokens) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const getStoredSession = (): AuthTokens | null => {
  const storedValue = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  return JSON.parse(storedValue) as AuthTokens;
};

export const clearStoredSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const isSessionExpired = (session: AuthTokens) => session.expiresAt <= Date.now();
