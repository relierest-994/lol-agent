import type { EntitlementFeature, Region } from '../../domain';
import { ChatShell } from '../chat-shell/chat-shell';
import { SessionHistory } from '../chat-shell/session-history';
import { DeepReviewSectionRenderer } from '../result-renderers/deep-review-section-renderer';
import { DiagnosisResultRenderer } from '../result-renderers/diagnosis-result-renderer';
import { EntitlementGate } from '../result-renderers/entitlement-gate';
import { ReportRenderer } from '../result-renderers/report-renderer';
import { AgentTaskStatusPanel } from '../status-panels/agent-task-status-panel';
import { EntitlementStatusBanner } from '../status-panels/entitlement-status-banner';
import { useAgentShell } from './use-agent-shell';

const regionLabels: Record<Region, string> = {
  INTERNATIONAL: '国际服',
  CN: '国服',
};

const unlockButtons: Array<{ featureCode: EntitlementFeature; label: string }> = [
  { featureCode: 'AI_FOLLOWUP', label: '解锁 AI 追问' },
  { featureCode: 'CLIP_REVIEW', label: '解锁素材诊断' },
];

const paymentStatusLabels: Record<string, string> = {
  IDLE: '空闲',
  CREATING_ORDER: '创建订单中',
  AWAITING_PAYMENT: '等待支付',
  CONFIRMING: '确认中',
  FAILED: '失败',
  SUCCESS: '成功',
};

interface AppShellProps {
  session: {
    userId: string;
    displayName: string;
  };
  onLogout: () => void;
}

export function AppShell({ session, onLogout }: AppShellProps) {
  const vm = useAgentShell(session.userId);

  return (
    <main className="app-shell">
      <section className="panel top-panel">
        <h1>LOL AI 复盘工作台</h1>
        <p>流程：先绑定账号并选择对局，点击“生成完整复盘”；之后在下方对话区继续 AI 追问（可上传视频/图片素材）。</p>

        <div className="control-row">
          <label>
            大区
            <select value={vm.region} onChange={(event) => vm.switchRegion(event.target.value as Region)}>
              <option value="INTERNATIONAL">国际服</option>
              <option value="CN">国服</option>
            </select>
          </label>
          {vm.region === 'INTERNATIONAL' && (
            <>
              <label>
                Riot ID
                <input
                  value={vm.riotGameName}
                  onChange={(event) => vm.setRiotGameName(event.target.value)}
                  placeholder="例如：Faker"
                />
              </label>
              <label>
                TagLine
                <input
                  value={vm.riotTagLine}
                  onChange={(event) => vm.setRiotTagLine(event.target.value)}
                  placeholder="例如：KR1"
                />
              </label>
            </>
          )}
          <div className="account-state">账号：{vm.accountLabel}（{regionLabels[vm.region]}）</div>
          <div className="account-state">会话ID：{session.userId}</div>
          <button type="button" className="ghost-btn" onClick={onLogout}>
            退出登录
          </button>
        </div>

        <div className="control-row">
          <button type="button" onClick={() => void vm.linkAccount()} disabled={vm.linkingAccount}>
            {vm.linkingAccount ? '绑定中...' : '绑定账号'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void vm.refreshRecentMatches()}
            disabled={!vm.linkedAccount || vm.loadingRecentMatches}
          >
            {vm.loadingRecentMatches ? '刷新中...' : '刷新最近对局'}
          </button>
          <button type="button" onClick={vm.runDeepReview} disabled={vm.running || !vm.linkedAccount}>
            生成完整复盘
          </button>
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
            确认支付回调
          </button>
        </div>

        <p className="muted">
          支付状态：{paymentStatusLabels[vm.paymentState.status] ?? vm.paymentState.status} - {vm.paymentState.message}
        </p>
        {vm.paymentState.checkout_url && (
          <p className="muted">
            收银台链接：<a href={vm.paymentState.checkout_url}>{vm.paymentState.checkout_url}</a>
          </p>
        )}

        {vm.linkedAccount && (
          <div className="control-row">
            <label>
              选择复盘对局
              <select
                value={vm.selectedMatchId ?? ''}
                onChange={(event) => vm.setSelectedMatchId(event.target.value || undefined)}
                disabled={vm.loadingRecentMatches || vm.recentMatches.length === 0}
              >
                {vm.recentMatches.length === 0 && <option value="">暂无对局，请先刷新</option>}
                {vm.recentMatches.map((match) => (
                  <option key={match.matchId} value={match.matchId}>
                    {match.championName} | {match.outcome === 'WIN' ? '胜利' : '失败'} | {match.queue} |{' '}
                    {new Date(match.playedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">未选择时默认使用最近一把。</span>
          </div>
        )}

        {vm.linkedAccount && vm.recentMatches.length > 0 && (
          <div className="match-list-grid">
            {vm.recentMatches.map((match) => {
              const active = vm.selectedMatchId === match.matchId;
              const outcomeLabel = match.outcome === 'WIN' ? '胜利' : '失败';
              const kda = `${match.kills}/${match.deaths}/${match.assists}`;
              return (
                <button
                  key={match.matchId}
                  type="button"
                  className={`match-card ${active ? 'active' : ''}`}
                  onClick={() => vm.setSelectedMatchId(match.matchId)}
                >
                  <div className="match-card-top">
                    <strong>{match.championName}</strong>
                    <span className={match.outcome === 'WIN' ? 'badge-win' : 'badge-loss'}>{outcomeLabel}</span>
                  </div>
                  <div className="muted">{match.queue}</div>
                  <div>KDA: {kda} | 时长: {match.durationMinutes} 分钟</div>
                  <div className="muted">{new Date(match.playedAt).toLocaleString()}</div>
                  <div className="muted">对局ID: {match.matchId}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <EntitlementStatusBanner entitlement={vm.entitlement} loading={vm.entitlementLoading} error={vm.entitlementError} />

      {vm.uiAlerts.length > 0 && (
        <section className="panel">
          <h2>运行提醒</h2>
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
          accountLinked={Boolean(vm.linkedAccount)}
          messages={vm.messages}
          quickPrompts={vm.quickPrompts}
          onUsePrompt={vm.applyQuickPrompt}
          attachment={vm.chatAttachment}
          onAttachmentChange={vm.setChatAttachment}
        />
        <SessionHistory items={vm.history} onSelect={vm.replayHistory} />
      </div>

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
