const METHODS = ['debug', 'info', 'log', 'warn', 'error'];

beforeAll(() => {
  for (const method of METHODS) {
    jest.spyOn(console, method).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  jest.clearAllMocks();
});
