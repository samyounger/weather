describe('client adapters', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NODE_ENV;
    process.env.AWS_PROFILE = 'engineering';
  });

  afterAll(() => {
    process.env = env;
  });

  it('should initialize storage and database clients with SSO credentials outside production', async () => {
    const credentials = { accessKeyId: 'a', secretAccessKey: 'b', sessionToken: 'c' };
    const provider = jest.fn().mockResolvedValue(credentials);
    const fromSSO = jest.fn().mockReturnValue(provider);
    const s3Ctor = jest.fn().mockImplementation((config) => ({ config }));
    const athenaCtor = jest.fn().mockImplementation((config) => ({ config }));

    jest.doMock("@aws-sdk/credential-provider-sso", () => ({ fromSSO }));
    jest.doMock("@aws-sdk/client-s3", () => ({ S3Client: s3Ctor }));
    jest.doMock("@aws-sdk/client-athena", () => ({ AthenaClient: athenaCtor }));

    const { storageClient, databaseClient } = await import('./client');

    await storageClient('eu-west-2');
    await databaseClient('eu-west-2');

    expect(fromSSO).toHaveBeenCalledTimes(2);
    expect(fromSSO).toHaveBeenNthCalledWith(1, { profile: 'engineering' });
    expect(fromSSO).toHaveBeenNthCalledWith(2, { profile: 'engineering' });
    expect(s3Ctor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials });
    expect(athenaCtor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials });
  });

  it('should initialize clients without SSO credentials in production', async () => {
    process.env.NODE_ENV = 'production';
    const fromSSO = jest.fn();
    const s3Ctor = jest.fn().mockImplementation((config) => ({ config }));
    const athenaCtor = jest.fn().mockImplementation((config) => ({ config }));

    jest.doMock("@aws-sdk/credential-provider-sso", () => ({ fromSSO }));
    jest.doMock("@aws-sdk/client-s3", () => ({ S3Client: s3Ctor }));
    jest.doMock("@aws-sdk/client-athena", () => ({ AthenaClient: athenaCtor }));

    const { storageClient, databaseClient } = await import('./client');

    await storageClient('eu-west-2');
    await databaseClient('eu-west-2');

    expect(fromSSO).not.toHaveBeenCalled();
    expect(s3Ctor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials: undefined });
    expect(athenaCtor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials: undefined });
  });

  it('should initialize clients without SSO credentials in lambda', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'tempest-store';
    const fromSSO = jest.fn();
    const s3Ctor = jest.fn().mockImplementation((config) => ({ config }));
    const athenaCtor = jest.fn().mockImplementation((config) => ({ config }));

    jest.doMock("@aws-sdk/credential-provider-sso", () => ({ fromSSO }));
    jest.doMock("@aws-sdk/client-s3", () => ({ S3Client: s3Ctor }));
    jest.doMock("@aws-sdk/client-athena", () => ({ AthenaClient: athenaCtor }));

    const { storageClient, databaseClient } = await import('./client');

    await storageClient('eu-west-2');
    await databaseClient('eu-west-2');

    expect(fromSSO).not.toHaveBeenCalled();
    expect(s3Ctor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials: undefined });
    expect(athenaCtor).toHaveBeenCalledWith({ region: 'eu-west-2', credentials: undefined });
  });
});
