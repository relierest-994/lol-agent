import type { VideoClipAsset } from '../../../domain';

export interface VideoUploadConstraints {
  maxDurationSeconds: number;
  recommendedMinDurationSeconds: number;
  recommendedMaxDurationSeconds: number;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface VideoUploadInput {
  user_id: string;
  match_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
}

export interface PreprocessValidation {
  valid: boolean;
  warnings: string[];
  error?: string;
}

export const DEFAULT_VIDEO_UPLOAD_CONSTRAINTS: VideoUploadConstraints = {
  maxDurationSeconds: 60,
  recommendedMinDurationSeconds: 10,
  recommendedMaxDurationSeconds: 30,
  maxSizeBytes: 50 * 1024 * 1024,
  allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['mp4', 'mov', 'webm', 'jpg', 'jpeg', 'png', 'webp'],
};

export class VideoAssetPreprocessor {
  constructor(private readonly constraints: VideoUploadConstraints = DEFAULT_VIDEO_UPLOAD_CONSTRAINTS) {}

  validate(input: VideoUploadInput): PreprocessValidation {
    const warnings: string[] = [];
    if (!input.match_id) {
      return { valid: false, warnings, error: 'match_id is required for clip diagnosis' };
    }
    if (!input.user_id) {
      return { valid: false, warnings, error: 'user_id is required' };
    }
    if (!input.file_name) {
      return { valid: false, warnings, error: 'file_name is required' };
    }

    const extension = input.file_name.split('.').pop()?.toLowerCase();
    if (!extension || !this.constraints.allowedExtensions.includes(extension)) {
      return { valid: false, warnings, error: `Unsupported extension. Allowed: ${this.constraints.allowedExtensions.join(', ')}` };
    }
    if (!this.constraints.allowedMimeTypes.includes(input.mime_type)) {
      return { valid: false, warnings, error: `Unsupported mime type. Allowed: ${this.constraints.allowedMimeTypes.join(', ')}` };
    }
    if (input.duration_seconds > this.constraints.maxDurationSeconds) {
      return { valid: false, warnings, error: `Clip duration exceeds ${this.constraints.maxDurationSeconds} seconds` };
    }
    if (input.size_bytes > this.constraints.maxSizeBytes) {
      return { valid: false, warnings, error: `File size exceeds ${this.constraints.maxSizeBytes} bytes` };
    }
    if (input.duration_seconds < this.constraints.recommendedMinDurationSeconds) {
      warnings.push(`Recommended duration is ${this.constraints.recommendedMinDurationSeconds}-${this.constraints.recommendedMaxDurationSeconds} seconds`);
    }
    if (input.duration_seconds > this.constraints.recommendedMaxDurationSeconds) {
      warnings.push(`Recommended duration is ${this.constraints.recommendedMinDurationSeconds}-${this.constraints.recommendedMaxDurationSeconds} seconds`);
    }
    return { valid: true, warnings };
  }

  buildStoragePath(asset: Pick<VideoClipAsset, 'user_id' | 'match_id' | 'asset_id' | 'file_name'>): string {
    return `clips/${asset.user_id}/${asset.match_id}/${asset.asset_id}-${asset.file_name}`;
  }
}
