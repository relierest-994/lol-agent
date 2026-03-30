import type { EntitlementFeature, Region } from '../../domain';
import { ChatShell } from '../chat-shell/chat-shell';
import { MatchAskPanel } from '../chat-shell/match-ask-panel';
import { SessionHistory } from '../chat-shell/session-history';
import { VideoUploadPanel } from '../chat-shell/video-upload-panel';
import { DeepReviewSectionRenderer } from '../result-renderers/deep-review-section-renderer';
import { DiagnosisResultRenderer } from '../result-renderers/diagnosis-result-renderer';
import { EntitlementGate } from '../result-renderers/entitlement-gate';
import { ReportRenderer } from '../result-renderers/report-renderer';
import { AgentTaskStatusPanel } from '../status-panels/agent-task-status-panel';
import { EntitlementStatusBanner } from '../status-panels/entitlement-status-banner';
import { useAgentShell } from './use-agent-shell';

const regionLabels: Record<Region, string> = {
  INTERNATIONAL: 'International',
  CN: 'CN',
};

const unlockButtons: Array<{ featureCode: EntitlementFeature; label: string }> = [
  { featureCode: 'DEEP_REVIEW', label: 'Unlock Deep Review' },
  { featureCode: 'AI_FOLLOWUP', label: 'Unlock AI Follow-up' },
  { featureCode: 'CLIP_REVIEW', label: 'Unlock Clip Diagnosis' },
];

export function AppShell() {
  const vm = useAgentShell();

  return (
    <main className="app-shell">
      <section className="panel top-panel">
        <h1>LOL Agent-First Review Shell (Phase 2)</h1>
        <p>Frontend shell only handles input, confirmation, observation, and structured result rendering.</p>
        <div className="control-row">
          <label>
            Region
            <select
              value={vm.region}
              onChange={(event) => vm.switchRegion(event.target.value as Region)}
            >
              <option value="INTERNATIONAL">International</option>
              <option value="CN">CN</option>
            </select>
          </label>
          <div className="account-state">Account: {vm.accountLabel} ({regionLabels[vm.region]})</div>
        </div>
        <div className="control-row">
          {unlockButtons.map((item) => (
            <button key={item.featureCode} type="button" onClick={() => void vm.startPurchase(item.featureCode)}>
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void vm.confirmPendingPayment()}
            disabled={vm.paymentState.status !== 'AWAITING_PAYMENT'}
          >
            Confirm Payment Callback
          </button>
          <button type="button" onClick={vm.runDeepReview} disabled={vm.running}>
            Run Deep Review
          </button>
        </div>
        <p className="muted">Payment: {vm.paymentState.status} - {vm.paymentState.message}</p>
        {vm.paymentState.checkout_url && (
          <p className="muted">
            Checkout URL: <a href={vm.paymentState.checkout_url}>{vm.paymentState.checkout_url}</a>
          </p>
        )}
      </section>

      <EntitlementStatusBanner
        entitlement={vm.entitlement}
        loading={vm.entitlementLoading}
        error={vm.entitlementError}
      />

      {vm.uiAlerts.length > 0 && (
        <section className="panel">
          <h2>Runtime Alerts</h2>
          <ul>
            {vm.uiAlerts.map((alert) => (
              <li key={`${alert.code}-${alert.message}`} className={alert.level === 'ERROR' ? 'error' : 'muted'}>
                [{alert.level}] {alert.code}: {alert.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="layout-grid">
        <ChatShell
          value={vm.input}
          onChange={vm.setInput}
          onSubmit={vm.submitGoal}
          running={vm.running}
          messages={vm.messages}
          quickPrompts={vm.quickPrompts}
          onUsePrompt={vm.applyQuickPrompt}
        />
        <SessionHistory items={vm.history} onSelect={vm.replayHistory} />
      </div>

      <MatchAskPanel
        value={vm.askInput}
        onChange={vm.setAskInput}
        onAsk={() => void vm.runFollowupAsk()}
        running={vm.running}
        answer={vm.result?.followupAnswer}
        suggestedQuestions={vm.suggestedQuestions}
        onUseSuggested={(question) => void vm.runFollowupAsk(question)}
        lockedInfo={vm.result?.lockedInfo}
      />

      <VideoUploadPanel
        draft={vm.clipDraft}
        onChange={vm.setClipDraft}
        question={vm.clipQuestion}
        onQuestionChange={vm.setClipQuestion}
        onDiagnose={() => void vm.runVideoDiagnosis()}
        running={vm.running}
        lockedInfo={vm.result?.lockedInfo}
        taskObservation={vm.taskObservation}
      />

      <AgentTaskStatusPanel result={vm.result} />

      <ReportRenderer report={vm.result?.report} lockedInfo={vm.result?.lockedInfo} error={vm.result?.error} />

      <DeepReviewSectionRenderer deepReview={vm.displayDeepReview} running={vm.running} taskObservation={vm.taskObservation} />

      <DiagnosisResultRenderer
        result={vm.displayVideoDiagnosis}
        running={vm.running}
        error={vm.result?.error}
        taskObservation={vm.taskObservation}
      />

      <EntitlementGate entitlement={vm.entitlement} />
    </main>
  );
}
