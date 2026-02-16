import { storageClient } from './client';
import { Storage } from './storage';
import { S3Client } from "@aws-sdk/client-s3";

jest.mock('./client', () => ({
  storageClient: jest.fn(),
}));

describe('Storage', () => {
  const send = jest.fn();
  const storageClientMock = storageClient as jest.MockedFunction<typeof storageClient>;

  beforeEach(() => {
    send.mockReset();
    storageClientMock.mockReset();
    storageClientMock.mockResolvedValue({ send } as unknown as S3Client);
  });

  it('should create an object in S3', async () => {
    send.mockResolvedValue({ ETag: 'etag' });
    const subject = await new Storage().createObject('weather-tempest-records', 'foo.json', '{"foo":"bar"}');

    expect(subject).toEqual({ ETag: 'etag' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({
      Body: '{"foo":"bar"}',
      Bucket: 'weather-tempest-records',
      Key: 'foo.json',
      ContentType: 'application/json',
    });
  });

  it('should create a directory in S3', async () => {
    send.mockResolvedValue({ Location: '/weather-tempest-records' });
    const subject = await new Storage().createDirectory('weather-tempest-records', 'eu-west-2');

    expect(subject).toEqual({ Location: '/weather-tempest-records' });
    expect(send.mock.calls[0][0].input).toEqual({
      ACL: 'private',
      Bucket: 'weather-tempest-records',
      CreateBucketConfiguration: {
        LocationConstraint: 'eu-west-2',
      },
    });
  });

  it('should check if directory exists', async () => {
    send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
    const subject = await new Storage().directoryExists('weather-tempest-records');

    expect(subject).toEqual({ $metadata: { httpStatusCode: 200 } });
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'weather-tempest-records',
    });
  });
});
