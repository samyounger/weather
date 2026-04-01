import { clearStoredSession, getStoredSession, isSessionExpired, persistSession } from './session-storage';

describe('session-storage', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      configurable: true,
    });
  });

  it('persists and restores a session', () => {
    const session = {
      accessToken: 'access',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60000,
      email: 'user@example.com',
    };

    persistSession(session);

    expect(getStoredSession()).toEqual(session);
  });

  it('clears the stored session', () => {
    persistSession({
      accessToken: 'access',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60000,
      email: 'user@example.com',
    });

    clearStoredSession();

    expect(getStoredSession()).toBeNull();
  });

  it('detects expired sessions', () => {
    expect(isSessionExpired({
      accessToken: 'access',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresAt: Date.now() - 1,
      email: 'user@example.com',
    })).toBe(true);
  });
});
