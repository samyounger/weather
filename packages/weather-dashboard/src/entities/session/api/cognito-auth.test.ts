import { confirmSignUp, refreshTokens, signIn, signUp } from './cognito-auth';

const runtimeConfig = {
  apiBaseUrl: 'https://example.execute-api.eu-west-2.amazonaws.com',
  cognitoRegion: 'eu-west-2',
  cognitoUserPoolId: 'eu-west-2_123',
  cognitoClientId: 'client-123',
  mockMode: false,
};

describe('cognito-auth', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('signs in with password auth', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        AuthenticationResult: {
          AccessToken: 'access',
          IdToken: 'id',
          RefreshToken: 'refresh',
          ExpiresIn: 3600,
        },
      }),
    });

    const tokens = await signIn(runtimeConfig, {
      email: 'user@example.com',
      password: 'password',
    });

    expect(tokens.accessToken).toBe('access');
    expect(tokens.idToken).toBe('id');
    expect(tokens.refreshToken).toBe('refresh');
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['X-Amz-Target']).toContain('InitiateAuth');
  });

  it('throws when sign in does not return a refresh token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        AuthenticationResult: {
          AccessToken: 'access',
          IdToken: 'id',
          ExpiresIn: 3600,
        },
      }),
    });

    await expect(signIn(runtimeConfig, {
      email: 'user@example.com',
      password: 'password',
    })).rejects.toThrow('Cognito did not return a refresh token');
  });

  it('refreshes tokens with the refresh token flow', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        AuthenticationResult: {
          AccessToken: 'next-access',
          IdToken: 'next-id',
          ExpiresIn: 3600,
        },
      }),
    });

    const tokens = await refreshTokens(runtimeConfig, 'refresh');

    expect(tokens.accessToken).toBe('next-access');
    expect(tokens.refreshToken).toBe('refresh');
  });

  it('throws when refresh does not return tokens', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(refreshTokens(runtimeConfig, 'refresh')).rejects.toThrow('Cognito did not return refreshed tokens');
  });

  it('signs up and confirms a user', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await signUp(runtimeConfig, { email: 'user@example.com', password: 'password' });
    await confirmSignUp(runtimeConfig, { email: 'user@example.com', confirmationCode: '123456' });

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('surfaces cognito errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'bad request' }),
    });

    await expect(signUp(runtimeConfig, { email: 'user@example.com', password: 'password' })).rejects.toThrow('bad request');
  });

  it('falls back to the cognito error type when no message is present', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ __type: 'NotAuthorizedException' }),
    });

    await expect(signUp(runtimeConfig, { email: 'user@example.com', password: 'password' })).rejects.toThrow('NotAuthorizedException');
  });

  it('uses a generic error when cognito does not return error details', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(signUp(runtimeConfig, { email: 'user@example.com', password: 'password' })).rejects.toThrow('Cognito request failed: SignUp');
  });

  it('uses local mock auth flows when mock mode is enabled', async () => {
    const tokens = await signIn({
      ...runtimeConfig,
      mockMode: true,
    }, {
      email: 'local-user@weather.test',
      password: 'password',
    });

    await expect(signUp({ ...runtimeConfig, mockMode: true }, { email: 'local-user@weather.test', password: 'password' })).resolves.toBeUndefined();
    await expect(confirmSignUp({ ...runtimeConfig, mockMode: true }, { email: 'local-user@weather.test', confirmationCode: '123456' })).resolves.toBeUndefined();
    await expect(refreshTokens({ ...runtimeConfig, mockMode: true }, 'refresh')).resolves.toEqual(expect.objectContaining({
      refreshToken: 'refresh',
    }));
    expect(tokens.email).toBe('local-user@weather.test');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
