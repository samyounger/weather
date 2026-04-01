export type RuntimeConfig = {
  apiBaseUrl: string;
  cognitoRegion: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  mockMode?: boolean;
};

export const parseRuntimeConfig = (value: unknown): RuntimeConfig => {
  const candidate = value as Partial<RuntimeConfig>;
  const requiredKeys = ['apiBaseUrl', 'cognitoRegion', 'cognitoUserPoolId', 'cognitoClientId'] as const;
  const missingKeys = requiredKeys.filter((key) => {
    const rawValue = candidate?.[key];

    return typeof rawValue !== 'string' || rawValue.trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(
      `runtime-config.json is missing required non-empty string values for: ${missingKeys.join(', ')}. `
      + 'Expected keys: apiBaseUrl, cognitoRegion, cognitoUserPoolId, cognitoClientId.',
    );
  }

  const apiBaseUrl = candidate.apiBaseUrl as string;
  const cognitoRegion = candidate.cognitoRegion as string;
  const cognitoUserPoolId = candidate.cognitoUserPoolId as string;
  const cognitoClientId = candidate.cognitoClientId as string;

  return {
    apiBaseUrl,
    cognitoRegion,
    cognitoUserPoolId,
    cognitoClientId,
    mockMode: candidate.mockMode === true,
  };
};
