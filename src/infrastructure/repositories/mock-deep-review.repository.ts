import type {
  DeepReviewResult,
  DeepReviewTask,
  DeepReviewTaskStatus,
  MatchAnalysisContext,
  MatchConversationMessage,
  MatchConversationSession,
} from '../../domain';
import { createPersistentStateStore, type PersistentStateStore } from '../persistence/persistent-state.store';

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function contextKey(userId: string, matchId: string): string {
  return `${userId}:${matchId}`;
}

export class MockDeepReviewRepository {
  private readonly tasks = new Map<string, DeepReviewTask>();
  private readonly latestTaskByUserMatch = new Map<string, string>();
  private readonly results = new Map<string, DeepReviewResult>();
  private readonly latestResultByUserMatch = new Map<string, string>();
  private readonly contexts = new Map<string, MatchAnalysisContext>();
  private readonly conversations = new Map<string, MatchConversationSession>();
  private readonly conversationByUserMatch = new Map<string, string>();
  private readonly messages = new Map<string, MatchConversationMessage[]>();
  private readonly store: PersistentStateStore;

  constructor(store: PersistentStateStore = createPersistentStateStore('deep-review-repository')) {
    this.store = store;
    this.hydrate();
  }

  getOrCreateContext(
    userId: string,
    matchId: string,
    region: 'INTERNATIONAL' | 'CN',
    nowIso: string
  ): MatchAnalysisContext {
    const key = contextKey(userId, matchId);
    const existing = this.contexts.get(key);
    if (existing) return existing;

    const created: MatchAnalysisContext = {
      context_id: randomId('ctx'),
      user_id: userId,
      match_id: matchId,
      region,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.contexts.set(key, created);
    this.persist();
    return created;
  }

  markBasicReviewGenerated(userId: string, matchId: string, region: 'INTERNATIONAL' | 'CN', nowIso: string): void {
    const context = this.getOrCreateContext(userId, matchId, region, nowIso);
    context.basic_review_generated_at = nowIso;
    context.updated_at = nowIso;
    this.persist();
  }

  createTask(input: Omit<DeepReviewTask, 'task_id' | 'created_at' | 'updated_at'>, nowIso: string): DeepReviewTask {
    const task: DeepReviewTask = {
      ...input,
      task_id: randomId('deep-task'),
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.tasks.set(task.task_id, task);
    this.latestTaskByUserMatch.set(contextKey(task.user_id, task.match_id), task.task_id);
    this.persist();
    return task;
  }

  updateTaskStatus(taskId: string, status: DeepReviewTaskStatus, nowIso: string, errorMessage?: string): DeepReviewTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    task.status = status;
    task.updated_at = nowIso;
    if (status === 'RUNNING') task.started_at = nowIso;
    if (status === 'COMPLETED' || status === 'FAILED') task.completed_at = nowIso;
    if (errorMessage) task.error_message = errorMessage;
    this.persist();
    return task;
  }

  saveResult(result: Omit<DeepReviewResult, 'result_id'>): DeepReviewResult {
    const created: DeepReviewResult = {
      ...result,
      result_id: randomId('deep-result'),
    };
    this.results.set(created.result_id, created);
    this.latestResultByUserMatch.set(contextKey(created.user_id, created.match_id), created.result_id);
    this.persist();
    return created;
  }

  getLatestTask(userId: string, matchId: string): DeepReviewTask | undefined {
    const taskId = this.latestTaskByUserMatch.get(contextKey(userId, matchId));
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  getLatestResult(userId: string, matchId: string): DeepReviewResult | undefined {
    const resultId = this.latestResultByUserMatch.get(contextKey(userId, matchId));
    return resultId ? this.results.get(resultId) : undefined;
  }

  markDeepReviewGenerated(userId: string, matchId: string, region: 'INTERNATIONAL' | 'CN', nowIso: string): void {
    const context = this.getOrCreateContext(userId, matchId, region, nowIso);
    context.deep_review_generated_at = nowIso;
    context.updated_at = nowIso;
    this.persist();
  }

  getOrCreateConversation(userId: string, matchId: string, nowIso: string): MatchConversationSession {
    const key = contextKey(userId, matchId);
    const existingId = this.conversationByUserMatch.get(key);
    if (existingId) {
      const existing = this.conversations.get(existingId);
      if (existing) return existing;
    }

    const session: MatchConversationSession = {
      conversation_id: randomId('conv'),
      user_id: userId,
      match_id: matchId,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.conversations.set(session.conversation_id, session);
    this.conversationByUserMatch.set(key, session.conversation_id);
    this.messages.set(session.conversation_id, []);
    this.persist();
    return session;
  }

  addConversationMessage(message: Omit<MatchConversationMessage, 'message_id'>): MatchConversationMessage {
    const created: MatchConversationMessage = {
      ...message,
      message_id: randomId('msg'),
    };
    const list = this.messages.get(message.conversation_id) ?? [];
    list.push(created);
    this.messages.set(message.conversation_id, list);
    const conv = this.conversations.get(message.conversation_id);
    if (conv) conv.updated_at = message.created_at;
    const key = contextKey(message.user_id, message.match_id);
    const ctx = this.contexts.get(key);
    if (ctx) {
      ctx.latest_question_at = message.created_at;
      ctx.updated_at = message.created_at;
    }
    this.persist();
    return created;
  }

  listConversationMessages(conversationId: string): MatchConversationMessage[] {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  private hydrate(): void {
    const state = this.store.read<{
      tasks: Array<[string, DeepReviewTask]>;
      latestTaskByUserMatch: Array<[string, string]>;
      results: Array<[string, DeepReviewResult]>;
      latestResultByUserMatch: Array<[string, string]>;
      contexts: Array<[string, MatchAnalysisContext]>;
      conversations: Array<[string, MatchConversationSession]>;
      conversationByUserMatch: Array<[string, string]>;
      messages: Array<[string, MatchConversationMessage[]]>;
    }>('state');
    if (!state) return;
    this.tasks.clear();
    this.latestTaskByUserMatch.clear();
    this.results.clear();
    this.latestResultByUserMatch.clear();
    this.contexts.clear();
    this.conversations.clear();
    this.conversationByUserMatch.clear();
    this.messages.clear();
    for (const [k, v] of state.tasks) this.tasks.set(k, v);
    for (const [k, v] of state.latestTaskByUserMatch) this.latestTaskByUserMatch.set(k, v);
    for (const [k, v] of state.results) this.results.set(k, v);
    for (const [k, v] of state.latestResultByUserMatch) this.latestResultByUserMatch.set(k, v);
    for (const [k, v] of state.contexts) this.contexts.set(k, v);
    for (const [k, v] of state.conversations) this.conversations.set(k, v);
    for (const [k, v] of state.conversationByUserMatch) this.conversationByUserMatch.set(k, v);
    for (const [k, v] of state.messages) this.messages.set(k, v);
  }

  private persist(): void {
    this.store.write('state', {
      tasks: [...this.tasks.entries()],
      latestTaskByUserMatch: [...this.latestTaskByUserMatch.entries()],
      results: [...this.results.entries()],
      latestResultByUserMatch: [...this.latestResultByUserMatch.entries()],
      contexts: [...this.contexts.entries()],
      conversations: [...this.conversations.entries()],
      conversationByUserMatch: [...this.conversationByUserMatch.entries()],
      messages: [...this.messages.entries()],
    });
  }
}
