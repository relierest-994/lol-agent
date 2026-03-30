import { AgentOrchestrator } from '../../agent';
import type { LinkedAccount, Region } from '../../domain';
import { callBackendApi } from '../http-api.client';

export interface RunReviewInput {
  userId: string;
  region: Region;
  userInput: string;
  linkedAccount?: LinkedAccount;
  uploadedClip?: {
    file_name: string;
    mime_type: string;
    size_bytes: number;
    duration_seconds: number;
  };
}

const orchestrator = new AgentOrchestrator();

export async function runReviewUseCase(input: RunReviewInput) {
  try {
    return await callBackendApi<Awaited<ReturnType<typeof orchestrator.run>>>({
      path: 'agent/run',
      method: 'POST',
      body: input,
    });
  } catch {
    return orchestrator.run(input);
  }
}

