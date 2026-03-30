# Phase 3 Database & Storage Realization

## Summary

Phase 3 moves core persistence paths from in-memory-only behavior to persistent repository behavior and pluggable storage providers.

## Database / Persistence Layer

Primary repository state now persists through `PersistentStateStore`:

- `billing-repository`:
  - `src/infrastructure/repositories/mock-billing.repository.ts`
- `deep-review-repository`:
  - `src/infrastructure/repositories/mock-deep-review.repository.ts`
- `video-diagnosis-repository`:
  - `src/infrastructure/repositories/mock-video-diagnosis.repository.ts`

Store implementation:

- `src/infrastructure/persistence/persistent-state.store.ts`
  - Browser runtime: `localStorage`
  - Non-browser runtime: process-global persistent map (test/runtime scope)

This keeps repository abstractions unchanged while removing critical in-memory-only state behavior.

## Storage Provider Layer

Added pluggable video asset storage provider abstraction:

- `src/infrastructure/storage/video-asset-storage.provider.ts`
  - `LocalVideoAssetStorageProvider`
  - `ObjectVideoAssetStorageProvider` (via `StorageClient`)

Video upload flow now:

1. reserve storage object/path
2. write metadata asset record
3. validate and complete asset state
4. commit storage
5. rollback storage reservation on failure

Updated:

- `src/application/services/video-diagnosis.service.ts`
- `src/infrastructure/clients/storage/storage-client.ts` (`deleteObject`)

## Migration

Added schema extension migration:

- `migrations/20260330_phase3_db_storage_extension.sql`

Includes:

- linked accounts
- imported match summaries
- basic review reports
- entitlement and order tables
- agent task runs

## Environment

`.env.example` additions:

- `VITE_APP_ENV=dev`
- `APP_VIDEO_STORAGE_MODE=local`

`APP_VIDEO_STORAGE_MODE`:

- `local`: local persistent storage provider (default)
- `object`: object storage provider via storage API

## Reliability

- Upload rollback for validation failure and storage commit failure.
- Metadata/file consistency protection in upload pipeline.
- Provider config validation includes app environment checks.

## Tests Added

- `test/repository-persistence.spec.ts`
- `test/video-storage-persistence.spec.ts`
- `test/provider-config.spec.ts`

