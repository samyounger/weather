import { RuntimeConfig } from '../../../shared/config/runtime-config';
import { AuthTokens, AuthUserCredentials, ConfirmSignUpInput, SignUpInput } from '../model/session';

type CognitoAuthenticationResult = {
  AccessToken: string;
  IdToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
};

type CognitoAuthResponse = {
  AuthenticationResult?: CognitoAuthenticationResult;
  message?: string;
  __type?: string;
};

const getEndpoint = (config: RuntimeConfig) => `https://cognito-idp.${config.cognitoRegion}.amazonaws.com/`;

const executeCognitoAction = async <TBody extends Record<string, unknown>>(
  config: RuntimeConfig,
  action: string,
  body: TBody,
) => {
  const response = await fetch(getEndpoint(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as CognitoAuthResponse;
  if (!response.ok) {
    throw new Error(payload.message ?? payload.__type ?? `Cognito request failed: ${action}`);
  }

  return payload;
};

const toTokens = (
  credentials: CognitoAuthenticationResult,
  email: string,
  refreshToken: string,
): AuthTokens => ({
  accessToken: credentials.AccessToken,
  idToken: credentials.IdToken,
  refreshToken,
  expiresAt: Date.now() + credentials.ExpiresIn * 1000,
  email,
});

export const signUp = async (config: RuntimeConfig, input: SignUpInput) => {
  await executeCognitoAction(config, 'SignUp', {
    ClientId: config.cognitoClientId,
    Username: input.email,
    Password: input.password,
    UserAttributes: [
      {
        Name: 'email',
        Value: input.email,
      },
    ],
  });
};

export const confirmSignUp = async (config: RuntimeConfig, input: ConfirmSignUpInput) => {
  await executeCognitoAction(config, 'ConfirmSignUp', {
    ClientId: config.cognitoClientId,
    Username: input.email,
    ConfirmationCode: input.confirmationCode,
  });
};

export const signIn = async (config: RuntimeConfig, credentials: AuthUserCredentials) => {
  const response = await executeCognitoAction(config, 'InitiateAuth', {
    ClientId: config.cognitoClientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: credentials.email,
      PASSWORD: credentials.password,
    },
  });

  if (!response.AuthenticationResult?.RefreshToken) {
    throw new Error('Cognito did not return a refresh token');
  }

  return toTokens(response.AuthenticationResult, credentials.email, response.AuthenticationResult.RefreshToken);
};

export const refreshTokens = async (
  config: RuntimeConfig,
  refreshToken: string,
) => {
  const response = await executeCognitoAction(config, 'InitiateAuth', {
    ClientId: config.cognitoClientId,
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  if (!response.AuthenticationResult) {
    throw new Error('Cognito did not return refreshed tokens');
  }

  return toTokens(response.AuthenticationResult, '', refreshToken);
};
