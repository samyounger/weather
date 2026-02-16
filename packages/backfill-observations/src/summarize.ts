type WorkerSuccess = {
  success: true;
  chunkKey: string;
  result: unknown;
};

type WorkerFailure = {
  success: false;
  chunkKey: string;
  error: {
    Error?: string;
    Cause?: string;
  };
};

type ChunkResult = WorkerSuccess | WorkerFailure;

type SummarizeInput = {
  chunkResults?: ChunkResult[];
};

type SummarizeOutput = {
  totalChunks: number;
  succeededChunks: number;
  failedChunks: number;
  failedChunkKeys: string[];
  succeededChunkKeys: string[];
};

export const handler = async (event: SummarizeInput): Promise<SummarizeOutput> => {
  const chunkResults = event.chunkResults || [];

  const failedChunkKeys = chunkResults
    .filter((result): result is WorkerFailure => !result.success)
    .map((result) => result.chunkKey);

  const succeededChunkKeys = chunkResults
    .filter((result): result is WorkerSuccess => result.success)
    .map((result) => result.chunkKey);

  return {
    totalChunks: chunkResults.length,
    succeededChunks: succeededChunkKeys.length,
    failedChunks: failedChunkKeys.length,
    failedChunkKeys,
    succeededChunkKeys,
  };
};
