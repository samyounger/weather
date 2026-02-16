describe('backfill-observations index exports', () => {
  it('should export planner and worker handlers', async () => {
    const subject = await import('./index');

    expect(subject.plannerHandler).toBeDefined();
    expect(subject.workerHandler).toBeDefined();
  });
});
