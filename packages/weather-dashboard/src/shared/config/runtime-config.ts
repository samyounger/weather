export type RuntimeConfig = {
  apiBaseUrl: string;
  cognitoRegion: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
};

export const parseRuntimeConfig = (value: unknown): RuntimeConfig => {
  const candidate = value as Partial<RuntimeConfig>;
  if (
    !candidate?.apiBaseUrl ||
    !candidate?.cognitoRegion ||
    !candidate?.cognitoUserPoolId ||
    !candidate?.cognitoClientId
  ) {
    throw new Error('runtime-config.json is missing required keys');
  }

  return {
    apiBaseUrl: candidate.apiBaseUrl,
    cognitoRegion: candidate.cognitoRegion,
    cognitoUserPoolId: candidate.cognitoUserPoolId,
    cognitoClientId: candidate.cognitoClientId,
  };
};
