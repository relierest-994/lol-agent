import { useEffect, useMemo, useState } from 'react';
import {
  confirmPayment,
  createOrder,
  createPaymentCheckout,
  queryCurrentEntitlements,
  runReviewUseCase,
} from '../../application';
import type { AgentRenderPayload, AgentSession } from '../../agent/protocol/agent-protocol';
import type {
  DeepReviewResult,
  EntitlementFeature,
  EntitlementState,
  LinkedAccount,
  Region,
  VideoDiagnosisResult,
} from '../../domain';
import { pollDeepReviewTask, pollVideoDiagnosisTask } from './agent-shell-runtime';

const USER_ID = 'phase2-user';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  at: string;
}

export interface HistoryItem {
  id: string;
  at: string;
  region: Region;
  prompt: string;
  result: RunResult;
}

export interface ClipDraft {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
}

export interface UiAlert {
  level: 'INFO' | 'WARN' | 'ERROR';
  code: string;
  message: string;
  retryable?: boolean;
}

export interface TaskObservation {
  task_type: 'VIDEO_DIAGNOSIS' | 'DEEP_REVIEW';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'NOT_FOUND';
  task_id?: string;
  message: string;
  updated_at: string;
}

export interface PaymentUiState {
  status: 'IDLE' | 'CREATING_ORDER' | 'AWAITING_PAYMENT' | 'CONFIRMING' | 'FAILED' | 'SUCCESS';
  message: string;
  checkout_url?: string;
  order_id?: string;
  feature_code?: EntitlementFeature;
}

type RunResult = Awaited<ReturnType<typeof runReviewUseCase>>;

const featureToPlanCode: Record<EntitlementFeature, string> = {
  BASIC_REVIEW: 'PRO_MONTHLY',
  BASIC_GROWTH_SUMMARY: 'PRO_MONTHLY',
  DEEP_REVIEW: 'DEEP_SINGLE',
  AI_FOLLOWUP: 'FOLLOWUP_PACK_5',
  CLIP_REVIEW: 'CLIP_PACK_3',
};

const DEFAULT_CLIP: ClipDraft = {
  file_name: 'clip.mp4',
  mime_type: 'video/mp4',
  size_bytes: 8 * 1024 * 1024,
  duration_seconds: 20,
};

function renderPayloadAlert(payload: AgentRenderPayload | undefined): UiAlert | undefined {
  if (!payload) return undefined;
  if (payload.state === 'SUCCESS') return undefined;
  if (payload.state === 'PENDING') {
    return {
      level: 'INFO',
      code: 'TASK_PENDING',
      message: payload.display_message,
      retryable: true,
    };
  }
  if (payload.state === 'PAYWALL') {
    return {
      level: 'WARN',
      code: payload.reason_code,
      message: payload.display_message,
      retryable: false,
    };
  }
  if (payload.state === 'RETRYABLE_ERROR') {
    return {
      level: 'WARN',
      code: payload.reason_code,
      message: payload.display_message,
      retryable: true,
    };
  }
  if (payload.state === 'INPUT_REQUIRED') {
    return {
      level: 'WARN',
      code: payload.reason_code,
      message: `${payload.display_message} (${payload.required_inputs.join(', ')})`,
      retryable: false,
    };
  }
  return {
    level: 'ERROR',
    code: payload.reason_code,
    message: payload.display_message,
    retryable: false,
  };
}

function sessionFromResult(result: RunResult | undefined): AgentSession | undefined {
  return result?.session;
}

export function useAgentShell() {
  const [region, setRegion] = useState<Region>('INTERNATIONAL');
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount>();
  const [input, setInput] = useState('Help me review my latest match.');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementState>();
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementError, setEntitlementError] = useState<string>();
  const [askInput, setAskInput] = useState('Which one habit should I fix first this match?');
  const [clipQuestion, setClipQuestion] = useState('Please diagnose why this skirmish failed.');
  const [clipDraft, setClipDraft] = useState<ClipDraft>(DEFAULT_CLIP);
  const [uiAlerts, setUiAlerts] = useState<UiAlert[]>([]);
  const [taskObservation, setTaskObservation] = useState<TaskObservation>();
  const [polledDeepReview, setPolledDeepReview] = useState<DeepReviewResult>();
  const [polledVideoDiagnosis, setPolledVideoDiagnosis] = useState<VideoDiagnosisResult>();
  const [paymentState, setPaymentState] = useState<PaymentUiState>({
    status: 'IDLE',
    message: 'No payment in progress.',
  });

  useEffect(() => {
    void refreshEntitlement();
  }, []);

  useEffect(() => {
    const payloadAlert = renderPayloadAlert(result?.renderPayload);
    setUiAlerts(payloadAlert ? [payloadAlert] : []);
  }, [result]);

  useEffect(() => {
    if (!taskObservation || running) return;
    if (taskObservation.status !== 'PENDING' && taskObservation.status !== 'RUNNING') return;
    const timer = setInterval(() => {
      void pollTaskOnce();
    }, 2000);
    return () => clearInterval(timer);
  }, [taskObservation, running]);

  const accountLabel = useMemo(() => {
    if (!linkedAccount) return 'No linked account';
    return `${linkedAccount.gameName}#${linkedAccount.tagLine}`;
  }, [linkedAccount]);

  const displayDeepReview = result?.deepReview ?? polledDeepReview;
  const displayVideoDiagnosis = result?.videoDiagnosis ?? polledVideoDiagnosis;

  const quickPrompts = [
    'Help me review my latest match.',
    'Run deep review for this match.',
    'Explain my mid game mistakes in this match.',
  ];

  const suggestedQuestions = useMemo(() => {
    const fromVideo = displayVideoDiagnosis?.recommended_next_questions ?? [];
    if (fromVideo.length > 0) return fromVideo;
    return [
      'If I only change one habit, what gives the biggest impact?',
      'Give me a 10/15/20 minute action checklist.',
      'What was the single most expensive decision in this match?',
    ];
  }, [displayVideoDiagnosis?.recommended_next_questions]);

  async function refreshEntitlement() {
    setEntitlementLoading(true);
    setEntitlementError(undefined);
    try {
      const response = await queryCurrentEntitlements({ userId: USER_ID });
      setEntitlement(response.state);
    } catch (error) {
      setEntitlementError(error instanceof Error ? error.message : 'Failed to refresh entitlement');
    } finally {
      setEntitlementLoading(false);
    }
  }

  function updatePendingObservation(response: RunResult): void {
    const payload = response.renderPayload;
    if (payload.state !== 'PENDING') return;

    const session = sessionFromResult(response);
    const nowIso = new Date().toISOString();
    if (payload.pending_task.action === 'diagnosis.video.status') {
      setTaskObservation({
        task_type: 'VIDEO_DIAGNOSIS',
        status: payload.pending_task.status,
        task_id: session?.assetContext.diagnosisTask?.task_id,
        message: payload.display_message,
        updated_at: nowIso,
      });
      return;
    }

    if (payload.pending_task.action === 'review.deep.status' || payload.pending_task.action === 'review.deep.generate') {
      setTaskObservation({
        task_type: 'DEEP_REVIEW',
        status: payload.pending_task.status,
        message: payload.display_message,
        updated_at: nowIso,
      });
    }
  }

  async function executeGoal(prompt: string, uploadedClip?: ClipDraft) {
    if (!prompt.trim() || running) return;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: prompt,
        at: now,
      },
    ]);

    setRunning(true);
    try {
      const response = await runReviewUseCase({
        userId: USER_ID,
        region,
        userInput: prompt,
        linkedAccount,
        uploadedClip,
      });

      if (response.linkedAccount) setLinkedAccount(response.linkedAccount);
      setResult(response);
      updatePendingObservation(response);

      const summary = response.finalResponse?.summary ?? response.error ?? 'Agent completed execution.';
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'agent',
          content: summary,
          at: new Date().toISOString(),
        },
      ]);

      setHistory((prev) => [
        {
          id: `h-${Date.now()}`,
          at: new Date().toISOString(),
          region,
          prompt,
          result: response,
        },
        ...prev,
      ]);

      await refreshEntitlement();
    } finally {
      setRunning(false);
    }
  }

  async function pollTaskOnce(): Promise<void> {
    if (!taskObservation) return;
    const session = sessionFromResult(result);
    if (!session) return;
    const selectedMatchId = session.matchContext.selectedMatchId;

    if (taskObservation.task_type === 'VIDEO_DIAGNOSIS') {
      const taskId = taskObservation.task_id ?? session.assetContext.diagnosisTask?.task_id;
      const clipAsset = session.assetContext.clipAsset;
      if (!taskId || !selectedMatchId || !clipAsset?.asset_id) return;
      const polled = await pollVideoDiagnosisTask({
        userId: USER_ID,
        region,
        taskId,
        matchId: selectedMatchId,
        assetId: clipAsset.asset_id,
      });
      if (polled.status === 'COMPLETED') {
        setPolledVideoDiagnosis(polled.result);
        setTaskObservation({
          task_type: 'VIDEO_DIAGNOSIS',
          status: 'COMPLETED',
          task_id: taskId,
          message: 'Video diagnosis completed.',
          updated_at: new Date().toISOString(),
        });
        setUiAlerts([]);
        return;
      }
      if (polled.status === 'FAILED') {
        setTaskObservation({
          task_type: 'VIDEO_DIAGNOSIS',
          status: 'FAILED',
          task_id: taskId,
          message: polled.error.message,
          updated_at: new Date().toISOString(),
        });
        setUiAlerts([
          {
            level: polled.error.retryable ? 'WARN' : 'ERROR',
            code: polled.error.code,
            message: polled.error.message,
            retryable: polled.error.retryable,
          },
        ]);
        return;
      }
      setTaskObservation({
        task_type: 'VIDEO_DIAGNOSIS',
        status: polled.status,
        task_id: taskId,
        message: polled.message,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    if (!selectedMatchId) return;
    const polled = await pollDeepReviewTask({
      userId: USER_ID,
      region,
      matchId: selectedMatchId,
    });
    if (polled.status === 'COMPLETED') {
      setPolledDeepReview(polled.result);
      setTaskObservation({
        task_type: 'DEEP_REVIEW',
        status: 'COMPLETED',
        message: 'Deep review completed.',
        updated_at: new Date().toISOString(),
      });
      setUiAlerts([]);
      return;
    }
    if (polled.status === 'FAILED') {
      setTaskObservation({
        task_type: 'DEEP_REVIEW',
        status: 'FAILED',
        message: polled.error.message,
        updated_at: new Date().toISOString(),
      });
      setUiAlerts([
        {
          level: polled.error.retryable ? 'WARN' : 'ERROR',
          code: polled.error.code,
          message: polled.error.message,
          retryable: polled.error.retryable,
        },
      ]);
      return;
    }
    setTaskObservation({
      task_type: 'DEEP_REVIEW',
      status: polled.status,
      message: polled.message,
      updated_at: new Date().toISOString(),
    });
  }

  async function submitGoal() {
    await executeGoal(input.trim());
  }

  async function runDeepReview() {
    await executeGoal('Run deep review for this match.');
  }

  async function runFollowupAsk(question?: string) {
    const q = (question ?? askInput).trim();
    if (!q) return;
    setAskInput(q);
    await executeGoal(q);
  }

  async function runVideoDiagnosis() {
    await executeGoal(clipQuestion.trim(), clipDraft);
  }

  async function startPurchase(featureCode: EntitlementFeature) {
    const planCode = featureToPlanCode[featureCode];
    setPaymentState({
      status: 'CREATING_ORDER',
      message: 'Creating payment order...',
      feature_code: featureCode,
    });
    const created = await createOrder({ userId: USER_ID, planCode, featureCode });
    if (!created.ok) {
      setPaymentState({
        status: 'FAILED',
        message: `Order creation failed: ${created.reason}`,
        feature_code: featureCode,
      });
      return;
    }

    const checkout = await createPaymentCheckout({
      userId: USER_ID,
      orderId: created.order.id,
      amountCents: created.order.amountCents,
      currency: created.order.currency,
      planCode,
      featureCode,
      returnUrl: 'https://example.com/payment/return',
    });

    setPaymentState({
      status: 'AWAITING_PAYMENT',
      message: 'Checkout created. Confirm payment callback when done.',
      checkout_url: checkout.checkout_url,
      order_id: created.order.id,
      feature_code: featureCode,
    });
  }

  async function confirmPendingPayment() {
    if (!paymentState.order_id) return;
    setPaymentState((prev) => ({
      ...prev,
      status: 'CONFIRMING',
      message: 'Confirming payment callback and refreshing entitlement...',
    }));
    const confirmed = await confirmPayment({
      orderId: paymentState.order_id,
      transactionId: `txn-${Date.now()}`,
    });

    if (!confirmed.ok) {
      setPaymentState((prev) => ({
        ...prev,
        status: 'FAILED',
        message: `Payment confirmation failed: ${confirmed.reason}`,
      }));
      return;
    }

    await refreshEntitlement();
    setPaymentState((prev) => ({
      ...prev,
      status: 'SUCCESS',
      message: 'Payment confirmed and entitlement refreshed.',
    }));
    setMessages((prev) => [
      ...prev,
      {
        id: `a-pay-${Date.now()}`,
        role: 'agent',
        content: `Payment confirmed: ${paymentState.feature_code ?? 'feature'} is now refreshed.`,
        at: new Date().toISOString(),
      },
    ]);
  }

  function switchRegion(nextRegion: Region) {
    setRegion(nextRegion);
    setLinkedAccount(undefined);
    setTaskObservation(undefined);
  }

  function applyQuickPrompt(prompt: string) {
    setInput(prompt);
  }

  function replayHistory(itemId: string) {
    const selected = history.find((item) => item.id === itemId);
    if (!selected) return;
    setRegion(selected.region);
    setResult(selected.result);
    setInput(selected.prompt);
    if (selected.result.linkedAccount) setLinkedAccount(selected.result.linkedAccount);
  }

  return {
    region,
    linkedAccount,
    accountLabel,
    input,
    running,
    result,
    messages,
    history,
    quickPrompts,
    entitlement,
    entitlementLoading,
    entitlementError,
    askInput,
    clipQuestion,
    clipDraft,
    suggestedQuestions,
    uiAlerts,
    taskObservation,
    paymentState,
    displayDeepReview,
    displayVideoDiagnosis,
    setInput,
    setAskInput,
    setClipQuestion,
    setClipDraft,
    switchRegion,
    applyQuickPrompt,
    submitGoal,
    replayHistory,
    startPurchase,
    confirmPendingPayment,
    runDeepReview,
    runFollowupAsk,
    runVideoDiagnosis,
    pollTaskOnce,
  };
}
