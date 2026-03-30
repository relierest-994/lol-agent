import { createCapabilityRegistry } from '../../capabilities/toolkit';
import type { CapabilityError, CapabilityExecutionContext } from '../../capabilities/toolkit';
import type { DeepReviewResult, Region, VideoDiagnosisResult } from '../../domain';
import { callBackendApi } from '../../application/http-api.client';
import { getLocalJobQueueRuntime } from '../../infrastructure/queue/job-queue.runtime';

const runtimeRegistry = createCapabilityRegistry();

function buildContext(userId: string, region: Region): CapabilityExecutionContext {
  return {
    userId,
    region,
    nowIso: new Date().toISOString(),
    sessionId: `ui-shell-${userId}`,
  };
}

function mapCapabilityError(error: CapabilityError): {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
} {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    retryable: Boolean(error.retryable),
  };
}

async function progressLocalQueue(): Promise<void> {
  await getLocalJobQueueRuntime().processDueJobs();
}

function normalizeDiagnosisResult(input: {
  taskId: string;
  userId: string;
  matchId: string;
  assetId: string;
  payload: {
    diagnosis_summary: string;
    structured_findings: VideoDiagnosisResult['structured_findings'];
    confidence_hints: VideoDiagnosisResult['confidence_hints'];
    recommended_next_questions: string[];
    render_payload: VideoDiagnosisResult['render_payload'];
    disclaimers: string[];
  };
}): VideoDiagnosisResult {
  return {
    result_id: `ui-result-${input.taskId}`,
    task_id: input.taskId,
    user_id: input.userId,
    match_id: input.matchId,
    asset_id: input.assetId,
    status: 'COMPLETED',
    diagnosis_summary: input.payload.diagnosis_summary,
    overall_judgement: input.payload.render_payload.summary,
    likely_issue_types: [],
    key_moments: input.payload.render_payload.key_moments,
    positional_or_trade_error: input.payload.structured_findings[0]?.insight ?? 'See structured findings',
    execution_or_decision_hints: input.payload.structured_findings.map((item) => item.advice),
    next_action_advice: input.payload.recommended_next_questions,
    structured_findings: input.payload.structured_findings,
    confidence_hints: input.payload.confidence_hints,
    disclaimers: input.payload.disclaimers,
    recommended_next_questions: input.payload.recommended_next_questions,
    render_payload: input.payload.render_payload,
    created_at: new Date().toISOString(),
  };
}

export type PollDiagnosisOutcome =
  | {
      status: 'PENDING' | 'RUNNING';
      message: string;
    }
  | {
      status: 'COMPLETED';
      result: VideoDiagnosisResult;
    }
  | {
      status: 'FAILED';
      error: {
        code: string;
        message: string;
        details?: string;
        retryable: boolean;
      };
    };

export async function pollVideoDiagnosisTask(input: {
  userId: string;
  region: Region;
  taskId: string;
  matchId: string;
  assetId: string;
}): Promise<PollDiagnosisOutcome> {
  try {
    const task = await callBackendApi<{ status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; error_message?: string }>({
      path: `video/tasks/${encodeURIComponent(input.taskId)}`,
      method: 'GET',
    });
    if (task.status === 'PENDING' || task.status === 'RUNNING') {
      return {
        status: task.status,
        message: `Diagnosis task is ${task.status.toLowerCase()}.`,
      };
    }
    if (task.status === 'FAILED') {
      return {
        status: 'FAILED',
        error: {
          code: 'PROVIDER_ERROR',
          message: task.error_message ?? 'Diagnosis task failed',
          retryable: true,
        },
      };
    }
    const completed = await callBackendApi<VideoDiagnosisResult | undefined>({
      path: `video/results/by-task/${encodeURIComponent(input.taskId)}`,
      method: 'GET',
    });
    if (!completed) {
      return {
        status: 'FAILED',
        error: {
          code: 'NOT_FOUND',
          message: 'Diagnosis result not found',
          retryable: true,
        },
      };
    }
    return {
      status: 'COMPLETED',
      result: completed,
    };
  } catch {
    await progressLocalQueue();
  }

  const context = buildContext(input.userId, input.region);
  const status = await runtimeRegistry.invoke<
    { task_id: string },
    { status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; error_message?: string }
  >({
    id: 'diagnosis.video.status',
    context,
    input: { task_id: input.taskId },
  });

  if (!status.result.ok) {
    return {
      status: 'FAILED',
      error: mapCapabilityError(status.result.error),
    };
  }

  const taskState = status.result.data.status;
  if (taskState === 'PENDING' || taskState === 'RUNNING') {
    return {
      status: taskState,
      message: `Diagnosis task is ${taskState.toLowerCase()}.`,
    };
  }

  if (taskState === 'FAILED') {
    return {
      status: 'FAILED',
      error: {
        code: 'PROVIDER_ERROR',
        message: status.result.data.error_message ?? 'Diagnosis task failed',
        retryable: true,
      },
    };
  }

  const completed = await runtimeRegistry.invoke<
    { task_id: string },
    {
      status: 'COMPLETED';
      diagnosis_summary: string;
      structured_findings: VideoDiagnosisResult['structured_findings'];
      confidence_hints: VideoDiagnosisResult['confidence_hints'];
      recommended_next_questions: string[];
      render_payload: VideoDiagnosisResult['render_payload'];
      disclaimers: string[];
    }
  >({
    id: 'diagnosis.video.get',
    context,
    input: { task_id: input.taskId },
  });
  if (!completed.result.ok) {
    return {
      status: 'FAILED',
      error: mapCapabilityError(completed.result.error),
    };
  }

  return {
    status: 'COMPLETED',
    result: normalizeDiagnosisResult({
      taskId: input.taskId,
      userId: input.userId,
      matchId: input.matchId,
      assetId: input.assetId,
      payload: completed.result.data,
    }),
  };
}

export type PollDeepReviewOutcome =
  | {
      status: 'PENDING' | 'RUNNING' | 'NOT_FOUND';
      message: string;
    }
  | {
      status: 'COMPLETED';
      result: DeepReviewResult;
    }
  | {
      status: 'FAILED';
      error: {
        code: string;
        message: string;
        details?: string;
        retryable: boolean;
      };
    };

export async function pollDeepReviewTask(input: {
  userId: string;
  region: Region;
  matchId: string;
}): Promise<PollDeepReviewOutcome> {
  try {
    const status = await callBackendApi<{
      status: 'NOT_FOUND' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      task?: { error_message?: string };
    }>({
      path: 'reviews/deep/status',
      method: 'POST',
      body: { user_id: input.userId, match_id: input.matchId, now_iso: new Date().toISOString() },
    });

    if (status.status === 'NOT_FOUND' || status.status === 'PENDING' || status.status === 'RUNNING') {
      return {
        status: status.status,
        message: `Deep review task is ${status.status.toLowerCase()}.`,
      };
    }
    if (status.status === 'FAILED') {
      return {
        status: 'FAILED',
        error: {
          code: 'PROVIDER_ERROR',
          message: status.task?.error_message ?? 'Deep review task failed',
          retryable: true,
        },
      };
    }
    const result = await callBackendApi<DeepReviewResult | undefined>({
      path: 'reviews/deep/result',
      method: 'POST',
      body: { user_id: input.userId, match_id: input.matchId, now_iso: new Date().toISOString() },
    });
    if (!result) {
      return {
        status: 'NOT_FOUND',
        message: 'Deep review result is not ready.',
      };
    }
    return {
      status: 'COMPLETED',
      result,
    };
  } catch {
    await progressLocalQueue();
  }

  const context = buildContext(input.userId, input.region);
  const status = await runtimeRegistry.invoke<
    { user_id: string; match_id: string },
    {
      status: 'NOT_FOUND' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      task?: { error_message?: string };
    }
  >({
    id: 'review.deep.status',
    context,
    input: {
      user_id: input.userId,
      match_id: input.matchId,
    },
  });

  if (!status.result.ok) {
    return {
      status: 'FAILED',
      error: mapCapabilityError(status.result.error),
    };
  }

  const taskState = status.result.data.status;
  if (taskState === 'NOT_FOUND' || taskState === 'PENDING' || taskState === 'RUNNING') {
    return {
      status: taskState,
      message: `Deep review task is ${taskState.toLowerCase()}.`,
    };
  }
  if (taskState === 'FAILED') {
    return {
      status: 'FAILED',
      error: {
        code: 'PROVIDER_ERROR',
        message: status.result.data.task?.error_message ?? 'Deep review task failed',
        retryable: true,
      },
    };
  }

  const result = await runtimeRegistry.invoke<
    { user_id: string; match_id: string },
    { status: 'NOT_FOUND' | 'COMPLETED'; cached: boolean; result?: DeepReviewResult }
  >({
    id: 'review.deep.get',
    context,
    input: {
      user_id: input.userId,
      match_id: input.matchId,
    },
  });
  if (!result.result.ok) {
    return {
      status: 'FAILED',
      error: mapCapabilityError(result.result.error),
    };
  }
  if (result.result.data.status !== 'COMPLETED' || !result.result.data.result) {
    return {
      status: 'NOT_FOUND',
      message: 'Deep review result is not ready.',
    };
  }

  return {
    status: 'COMPLETED',
    result: result.result.data.result,
  };
}
