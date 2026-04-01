export type AuthUserCredentials = {
  email: string;
  password: string;
};

export type SignUpInput = AuthUserCredentials;

export type ConfirmSignUpInput = {
  email: string;
  confirmationCode: string;
};

export type AuthTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
};
