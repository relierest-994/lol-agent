import { useEffect, useMemo, useState } from 'react';
import {
  confirmPayment,
  createOrder,
  createPaymentCheckout,
  fetchRecentMatchesForLinkedAccount,
  linkAccountUseCase,
  queryCurrentEntitlements,
  runReviewUseCase,
} from '../../application';
import type { AgentRenderPayload, AgentSession } from '../../agent/protocol/agent-protocol';
import type {
  DeepReviewResult,
  EntitlementFeature,
  EntitlementState,
  LinkedAccount,
  MatchSummary,
  Region,
  VideoDiagnosisResult,
} from '../../domain';
import { pollDeepReviewTask, pollVideoDiagnosisTask } from './agent-shell-runtime';

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
      message: `${payload.display_message}（${payload.required_inputs.join(', ')}）`,
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

export function useAgentShell(userId: string) {
  const [region, setRegion] = useState<Region>('INTERNATIONAL');
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount>();
  const [riotGameName, setRiotGameName] = useState('');
  const [riotTagLine, setRiotTagLine] = useState('');
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [result, setResult] = useState<RunResult>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementState>();
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementError, setEntitlementError] = useState<string>();
  const [askInput, setAskInput] = useState('这局我最该先改掉的一个习惯是什么？');
  const [clipQuestion, setClipQuestion] = useState('请诊断这波团战为什么会输。');
  const [clipDraft, setClipDraft] = useState<ClipDraft>(DEFAULT_CLIP);
  const [chatAttachment, setChatAttachment] = useState<ClipDraft>();
  const [uiAlerts, setUiAlerts] = useState<UiAlert[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>();
  const [loadingRecentMatches, setLoadingRecentMatches] = useState(false);
  const [taskObservation, setTaskObservation] = useState<TaskObservation>();
  const [polledDeepReview, setPolledDeepReview] = useState<DeepReviewResult>();
  const [polledVideoDiagnosis, setPolledVideoDiagnosis] = useState<VideoDiagnosisResult>();
  const [paymentState, setPaymentState] = useState<PaymentUiState>({
    status: 'IDLE',
    message: '当前没有进行中的支付流程。',
  });

  useEffect(() => {
    void refreshEntitlement();
  }, [userId]);

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
  }, [taskObservation, running, result, region, userId]);

  const accountLabel = useMemo(() => {
    if (!linkedAccount) return '未绑定';
    return `${linkedAccount.gameName}#${linkedAccount.tagLine}`;
  }, [linkedAccount]);

  const displayDeepReview = result?.deepReview ?? polledDeepReview;
  const displayVideoDiagnosis = result?.videoDiagnosis ?? polledVideoDiagnosis;

  const quickPrompts = ['我这局中期为什么会断节奏？', '这把最该先改的一个习惯是什么？', '请按时间点告诉我3个关键失误。'];

  const suggestedQuestions = useMemo(() => {
    const fromVideo = displayVideoDiagnosis?.recommended_next_questions ?? [];
    if (fromVideo.length > 0) return fromVideo;
    return [
      '如果只能改一个习惯，优先改什么？',
      '给我 10/15/20 分钟行动清单。',
      '这局代价最大的决策失误是什么？',
    ];
  }, [displayVideoDiagnosis?.recommended_next_questions]);

  async function refreshEntitlement() {
    setEntitlementLoading(true);
    setEntitlementError(undefined);
    try {
      const response = await queryCurrentEntitlements({ userId });
      setEntitlement(response.state);
    } catch (error) {
      setEntitlementError(error instanceof Error ? error.message : '权益状态刷新失败');
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
    if (!linkedAccount) {
      setUiAlerts([
        {
          level: 'WARN',
          code: 'ACCOUNT_NOT_LINKED',
          message: '请先绑定账号，再发起复盘请求。',
          retryable: false,
        },
      ]);
      return;
    }

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
        userId,
        region,
        userInput: prompt,
        preferredMatchId: selectedMatchId,
        linkedAccount,
        uploadedClip,
      });

      if (response.linkedAccount) setLinkedAccount(response.linkedAccount);
      setResult(response);
      updatePendingObservation(response);

      const summary = response.finalResponse?.summary ?? response.error ?? 'Agent 已完成执行。';
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
        userId,
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
          message: '视频诊断已完成。',
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
      userId,
      region,
      matchId: selectedMatchId,
    });
    if (polled.status === 'COMPLETED') {
      setPolledDeepReview(polled.result);
      setTaskObservation({
        task_type: 'DEEP_REVIEW',
        status: 'COMPLETED',
        message: '深度复盘已完成。',
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
    const prompt = input.trim();
    if (!prompt && !chatAttachment) return;

    const hasBaseReview = Boolean(result?.report || displayDeepReview || polledDeepReview);
    if (!chatAttachment && !hasBaseReview) {
      setUiAlerts([
        {
          level: 'WARN',
          code: 'BASE_REVIEW_REQUIRED',
          message: '请先选择对局并点击“生成完整复盘”，再进行 AI 追问。',
          retryable: false,
        },
      ]);
      return;
    }

    if (!chatAttachment) {
      const followupPrompt = /^追问[:：]/.test(prompt) ? prompt : `追问：${prompt}`;
      await executeGoal(followupPrompt);
      return;
    }

    const multimodalPrompt = /(视频|片段|素材|图片|图像|诊断)/.test(prompt)
      ? prompt
      : `请结合我上传的素材进行分析：${prompt || '帮我诊断这个素材的关键问题。'}`;

    await executeGoal(multimodalPrompt, chatAttachment);
    setChatAttachment(undefined);
  }

  async function linkAccount() {
    if (linkingAccount) return;
    if (region === 'INTERNATIONAL' && (!riotGameName.trim() || !riotTagLine.trim())) {
      setUiAlerts([
        {
          level: 'WARN',
          code: 'ACCOUNT_INPUT_REQUIRED',
          message: '国际服绑定需要填写 Riot ID（gameName）和 TagLine。',
          retryable: false,
        },
      ]);
      return;
    }
    setLinkingAccount(true);
    try {
      const account = await linkAccountUseCase({
        userId,
        region,
        gameName: region === 'INTERNATIONAL' ? riotGameName.trim() : undefined,
        tagLine: region === 'INTERNATIONAL' ? riotTagLine.trim() : undefined,
      });
      setLinkedAccount(account);
      await refreshRecentMatches(account);
      setUiAlerts([
        {
          level: 'INFO',
          code: 'ACCOUNT_LINKED',
          message: `账号绑定成功：${account.gameName}#${account.tagLine}`,
          retryable: false,
        },
      ]);
    } catch (error) {
      setUiAlerts([
        {
          level: 'ERROR',
          code: 'ACCOUNT_LINK_FAILED',
          message: error instanceof Error ? error.message : '账号绑定失败',
          retryable: true,
        },
      ]);
    } finally {
      setLinkingAccount(false);
    }
  }

  async function runDeepReview() {
    await executeGoal('请对这局进行深度复盘。');
  }

  async function runFollowupAsk(question?: string) {
    const q = (question ?? askInput).trim();
    if (!q) return;
    setAskInput(q);
    await executeGoal(q);
  }

  async function runVideoDiagnosis() {
    const prompt = clipQuestion.trim();
    const multimodalPrompt = /(视频|片段|素材|图片|图像|诊断)/.test(prompt)
      ? prompt
      : `请诊断我上传的视频片段：${prompt || '请分析这段素材的关键失误。'}`;
    await executeGoal(multimodalPrompt, clipDraft);
  }

  async function startPurchase(featureCode: EntitlementFeature) {
    const planCode = featureToPlanCode[featureCode];
    setPaymentState({
      status: 'CREATING_ORDER',
      message: '正在创建支付订单...',
      feature_code: featureCode,
    });
    const created = await createOrder({ userId, planCode, featureCode });
    if (!created.ok) {
      setPaymentState({
        status: 'FAILED',
        message: `创建订单失败：${created.reason}`,
        feature_code: featureCode,
      });
      return;
    }

    const checkout = await createPaymentCheckout({
      userId,
      orderId: created.order.id,
      amountCents: created.order.amountCents,
      currency: created.order.currency,
      planCode,
      featureCode,
      returnUrl: 'https://example.com/payment/return',
    });

    setPaymentState({
      status: 'AWAITING_PAYMENT',
      message: '收银台已创建，完成支付后请点击“确认支付回调”。',
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
      message: '正在确认支付回调并刷新权益...',
    }));
    const confirmed = await confirmPayment({
      orderId: paymentState.order_id,
      transactionId: `txn-${Date.now()}`,
    });

    if (!confirmed.ok) {
      setPaymentState((prev) => ({
        ...prev,
        status: 'FAILED',
        message: `支付确认失败：${confirmed.reason}`,
      }));
      return;
    }

    await refreshEntitlement();
    setPaymentState((prev) => ({
      ...prev,
      status: 'SUCCESS',
      message: '支付已确认，权益已刷新。',
    }));
    setMessages((prev) => [
      ...prev,
      {
        id: `a-pay-${Date.now()}`,
        role: 'agent',
        content: `支付确认成功：${paymentState.feature_code ?? '能力'} 已刷新。`,
        at: new Date().toISOString(),
      },
    ]);
  }

  function switchRegion(nextRegion: Region) {
    setRegion(nextRegion);
    setLinkedAccount(undefined);
    setRecentMatches([]);
    setSelectedMatchId(undefined);
    setRiotGameName('');
    setRiotTagLine('');
    setTaskObservation(undefined);
    setUiAlerts([
      {
        level: 'INFO',
        code: 'REGION_CHANGED',
        message: '已切换分区，请先重新绑定该分区账号。',
        retryable: false,
      },
    ]);
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

  async function refreshRecentMatches(accountOverride?: LinkedAccount) {
    const account = accountOverride ?? linkedAccount;
    if (!account) return;
    setLoadingRecentMatches(true);
    try {
      const list = await fetchRecentMatchesForLinkedAccount({
        userId,
        region,
        accountId: account.accountId,
        limit: 10,
      });
      setRecentMatches(list);
      setSelectedMatchId((prev) => {
        if (prev && list.some((item) => item.matchId === prev)) return prev;
        return list[0]?.matchId;
      });
    } catch (error) {
      setUiAlerts([
        {
          level: 'WARN',
          code: 'MATCH_LIST_LOAD_FAILED',
          message: error instanceof Error ? error.message : '最近对局加载失败',
          retryable: true,
        },
      ]);
    } finally {
      setLoadingRecentMatches(false);
    }
  }

  return {
    region,
    linkedAccount,
    riotGameName,
    riotTagLine,
    accountLabel,
    input,
    running,
    linkingAccount,
    result,
    recentMatches,
    selectedMatchId,
    loadingRecentMatches,
    messages,
    history,
    quickPrompts,
    entitlement,
    entitlementLoading,
    entitlementError,
    askInput,
    clipQuestion,
    clipDraft,
    chatAttachment,
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
    setChatAttachment,
    setRiotGameName,
    setRiotTagLine,
    setSelectedMatchId,
    switchRegion,
    linkAccount,
    refreshRecentMatches,
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
