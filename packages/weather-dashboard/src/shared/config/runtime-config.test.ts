import { parseRuntimeConfig } from './runtime-config';

describe('parseRuntimeConfig', () => {
  it('returns a valid runtime config object', () => {
    expect(parseRuntimeConfig({
      apiBaseUrl: 'https://example.execute-api.eu-west-2.amazonaws.com',
      cognitoRegion: 'eu-west-2',
      cognitoUserPoolId: 'eu-west-2_123',
      cognitoClientId: 'abc123',
      mockMode: true,
    })).toEqual({
      apiBaseUrl: 'https://example.execute-api.eu-west-2.amazonaws.com',
      cognitoRegion: 'eu-west-2',
      cognitoUserPoolId: 'eu-west-2_123',
      cognitoClientId: 'abc123',
      mockMode: true,
    });
  });

  it('throws when required keys are missing', () => {
    expect(() => parseRuntimeConfig({ apiBaseUrl: 'https://example.com' })).toThrow(
      'runtime-config.json is missing required non-empty string values for: cognitoRegion, cognitoUserPoolId, cognitoClientId. Expected keys: apiBaseUrl, cognitoRegion, cognitoUserPoolId, cognitoClientId.',
    );
  });
});
