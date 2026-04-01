import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AuthTokens, AuthUserCredentials, ConfirmSignUpInput, SignUpInput, clearStoredSession, getStoredSession, isSessionExpired, persistSession } from '../../entities/session';
import { confirmSignUp, refreshTokens, signIn, signUp } from '../../entities/session';
import { useRuntimeConfig } from './runtime-config-provider';

type AuthContextValue = {
  session: AuthTokens | null;
  ready: boolean;
  signInWithPassword: (credentials: AuthUserCredentials) => Promise<void>;
  register: (input: SignUpInput) => Promise<void>;
  confirmRegistration: (input: ConfirmSignUpInput) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  ready: false,
  signInWithPassword: async () => undefined,
  register: async () => undefined,
  confirmRegistration: async () => undefined,
  signOut: () => undefined,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { config, ready: configReady } = useRuntimeConfig();
  const [session, setSession] = useState<AuthTokens | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configReady) {
      return;
    }

    const hydrate = async () => {
      if (!config) {
        setReady(true);
        return;
      }

      const storedSession = getStoredSession();
      if (!storedSession) {
        setReady(true);
        return;
      }

      if (!isSessionExpired(storedSession)) {
        setSession(storedSession);
        setReady(true);
        return;
      }

      if (!storedSession.refreshToken) {
        clearStoredSession();
        setReady(true);
        return;
      }

      try {
        const refreshed = await refreshTokens(config, storedSession.refreshToken);
        const nextSession = {
          ...refreshed,
          email: storedSession.email,
        };
        persistSession(nextSession);
        setSession(nextSession);
      } catch {
        clearStoredSession();
      } finally {
        setReady(true);
      }
    };

    void hydrate();
  }, [config, configReady]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    ready,
    signInWithPassword: async (credentials) => {
      if (!config) {
        throw new Error('Runtime configuration is unavailable');
      }

      const nextSession = await signIn(config, credentials);
      persistSession(nextSession);
      setSession(nextSession);
    },
    register: async (input) => {
      if (!config) {
        throw new Error('Runtime configuration is unavailable');
      }

      await signUp(config, input);
    },
    confirmRegistration: async (input) => {
      if (!config) {
        throw new Error('Runtime configuration is unavailable');
      }

      await confirmSignUp(config, input);
    },
    signOut: () => {
      clearStoredSession();
      setSession(null);
    },
  }), [config, ready, session]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
