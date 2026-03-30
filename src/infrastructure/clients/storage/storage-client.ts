import { HttpClient } from '../http-client';

export class StorageClient {
  constructor(private readonly http: HttpClient, private readonly bucket: string) {}

  async requestUploadToken(input: {
    object_key: string;
    content_type: string;
    size_bytes: number;
  }): Promise<{ upload_url: string; object_url: string; expires_in_seconds: number }> {
    return this.http.request({
      path: 'uploads/presign',
      method: 'POST',
      body: {
        bucket: this.bucket,
        ...input,
      },
    });
  }

  async deleteObject(objectKey: string): Promise<{ ok: boolean }> {
    return this.http.request({
      path: 'objects/delete',
      method: 'POST',
      body: {
        bucket: this.bucket,
        object_key: objectKey,
      },
    });
  }
}
