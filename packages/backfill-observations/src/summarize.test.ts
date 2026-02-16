import { handler } from './summarize';

describe('summarize', () => {
  it('should return summary counts and chunk key lists', async () => {
    const subject = await handler({
      chunkResults: [
        {
          success: true,
          chunkKey: 'chunks/chunk-00000.json',
          result: { queryExecutionId: 'query-1' },
        },
        {
          success: false,
          chunkKey: 'chunks/chunk-00001.json',
          error: {
            Error: 'States.TaskFailed',
            Cause: 'Athena query failed',
          },
        },
      ],
    });

    expect(subject).toEqual({
      totalChunks: 2,
      succeededChunks: 1,
      failedChunks: 1,
      failedChunkKeys: ['chunks/chunk-00001.json'],
      succeededChunkKeys: ['chunks/chunk-00000.json'],
    });
  });

  it('should handle empty chunk results', async () => {
    const subject = await handler({});

    expect(subject).toEqual({
      totalChunks: 0,
      succeededChunks: 0,
      failedChunks: 0,
      failedChunkKeys: [],
      succeededChunkKeys: [],
    });
  });
});
