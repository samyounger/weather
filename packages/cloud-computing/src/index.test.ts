const config = jest.fn();

jest.mock('dotenv', () => ({
  __esModule: true,
  default: {
    config,
  },
}));

describe('cloud-computing index', () => {
  beforeEach(() => {
    jest.resetModules();
    config.mockClear();
  });

  it('should configure dotenv and export module members', async () => {
    const subject = await import('./index');

    expect(config).toHaveBeenCalledWith({ path: '../../.env' });
    expect(subject.Database).toBeDefined();
    expect(subject.Storage).toBeDefined();
    expect(subject.partitionDatePartsUtc).toBeDefined();
    expect(subject.partitionDateKeyUtc).toBeDefined();
  });
});
