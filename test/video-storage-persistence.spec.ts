import { describe, expect, it } from 'vitest';
import { VideoDiagnosisService } from '../src/application/services/video-diagnosis.service';
import { clearPersistentState } from '../src/infrastructure/persistence/persistent-state.store';
import type { VideoAssetStorageProvider } from '../src/infrastructure/storage/video-asset-storage.provider';

class TrackingStorageProvider implements VideoAssetStorageProvider {
  public rolledBack = 0;
  public committed = 0;

  async reserveUpload(input: {
    user_id: string;
    match_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  }) {
    return {
      object_key: `obj-${input.user_id}-${input.match_id}`,
      storage_path: `local://obj-${input.user_id}-${input.match_id}`,
    };
  }

  async commitUpload(): Promise<void> {
    this.committed += 1;
  }

  async rollbackUpload(): Promise<void> {
    this.rolledBack += 1;
  }
}

describe('Video storage persistence and rollback', () => {
  it('persists uploaded asset metadata across service instances', async () => {
    clearPersistentState('video-diagnosis-repository');
    const storage = new TrackingStorageProvider();
    const service1 = new VideoDiagnosisService(storage);
    const nowIso = new Date().toISOString();

    const uploaded = await service1.uploadVideoClip({
      user_id: 'video-persist-u1',
      match_id: 'EUW-1001',
      file_name: 'clip.mp4',
      mime_type: 'video/mp4',
      size_bytes: 1024 * 1024,
      duration_seconds: 18,
      nowIso,
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const service2 = new VideoDiagnosisService(storage);
    const asset = service2.getAsset(uploaded.asset.asset_id);
    expect(asset?.asset_id).toBe(uploaded.asset.asset_id);
    expect(storage.committed).toBe(1);
  });

  it('rolls back reserved storage when validation fails', async () => {
    const storage = new TrackingStorageProvider();
    const service = new VideoDiagnosisService(storage);
    const result = await service.uploadVideoClip({
      user_id: 'video-persist-u2',
      match_id: 'EUW-1001',
      file_name: 'clip.mp4',
      mime_type: 'video/mp4',
      size_bytes: 1024 * 1024,
      duration_seconds: 80,
      nowIso: new Date().toISOString(),
    });
    expect(result.ok).toBe(false);
    expect(storage.rolledBack).toBe(1);
  });
});
