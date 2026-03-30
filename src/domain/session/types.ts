export interface SessionMessage {
  role: 'user' | 'agent';
  content: string;
  at: string;
}

export interface AgentStepRecord {
  stepId: string;
  title: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  summary?: string;
}
