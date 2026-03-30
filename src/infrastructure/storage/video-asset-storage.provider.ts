import { HttpClient, StorageClient } from '../clients';
import { loadRuntimeConfig } from '../config/runtime-config';
import { createPersistentStateStore } from '../persistence/persistent-state.store';

export type VideoStorageMode = 'local' | 'object';

export interface ReserveVideoUploadInput {
  user_id: string;
  match_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface ReservedVideoUpload {
  storage_path: string;
  object_key: string;
  upload_url?: string;
}

export interface VideoAssetStorageProvider {
  reserveUpload(input: ReserveVideoUploadInput): Promise<ReservedVideoUpload>;
  commitUpload(input: { object_key: string; storage_path: string; nowIso: string }): Promise<void>;
  rollbackUpload(input: { object_key: string; storage_path: string }): Promise<void>;
}

class LocalVideoAssetStorageProvider implements VideoAssetStorageProvider {
  private readonly store = createPersistentStateStore('local-video-storage');

  async reserveUpload(input: ReserveVideoUploadInput): Promise<ReservedVideoUpload> {
    const objectKey = `clips/${input.user_id}/${input.match_id}/${Date.now()}-${input.file_name}`;
    const storagePath = `local://${objectKey}`;
    this.store.write(`object:${objectKey}`, {
      status: 'RESERVED',
      storage_path: storagePath,
      size_bytes: input.size_bytes,
      mime_type: input.mime_type,
      created_at: new Date().toISOString(),
    });
    return {
      object_key: objectKey,
      storage_path: storagePath,
    };
  }

  async commitUpload(input: { object_key: string; storage_path: string; nowIso: string }): Promise<void> {
    this.store.write(`object:${input.object_key}`, {
      status: 'COMMITTED',
      storage_path: input.storage_path,
      updated_at: input.nowIso,
    });
  }

  async rollbackUpload(input: { object_key: string; storage_path: string }): Promise<void> {
    this.store.remove(`object:${input.object_key}`);
  }
}

class ObjectVideoAssetStorageProvider implements VideoAssetStorageProvider {
  constructor(private readonly client: StorageClient) {}

  async reserveUpload(input: ReserveVideoUploadInput): Promise<ReservedVideoUpload> {
    const objectKey = `clips/${input.user_id}/${input.match_id}/${Date.now()}-${input.file_name}`;
    const token = await this.client.requestUploadToken({
      object_key: objectKey,
      content_type: input.mime_type,
      size_bytes: input.size_bytes,
    });
    return {
      object_key: objectKey,
      storage_path: token.object_url,
      upload_url: token.upload_url,
    };
  }

  async commitUpload(_input: { object_key: string; storage_path: string; nowIso: string }): Promise<void> {
    return;
  }

  async rollbackUpload(input: { object_key: string; storage_path: string }): Promise<void> {
    await this.client.deleteObject(input.object_key);
  }
}

function resolveStorageMode(): VideoStorageMode {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const raw = env.VIDEO_STORAGE_MODE ?? env.APP_VIDEO_STORAGE_MODE ?? 'local';
  return raw === 'object' ? 'object' : 'local';
}

export function createVideoAssetStorageProvider(): VideoAssetStorageProvider {
  const mode = resolveStorageMode();
  if (mode === 'local') return new LocalVideoAssetStorageProvider();
  const config = loadRuntimeConfig();
  const client = new StorageClient(
    new HttpClient({
      baseUrl: config.storageApiUrl,
      timeoutMs: config.requestTimeoutMs,
      retries: config.requestRetries,
    }),
    config.storageBucket
  );
  return new ObjectVideoAssetStorageProvider(client);
}

