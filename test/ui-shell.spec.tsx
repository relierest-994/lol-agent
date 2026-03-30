import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../src/presentation/app-shell/app-shell';
import { EntitlementStatusBanner } from '../src/presentation/status-panels/entitlement-status-banner';
import { DiagnosisResultRenderer } from '../src/presentation/result-renderers/diagnosis-result-renderer';

describe('UI Shell Regression', () => {
  it('renders phase3 shell modules', () => {
    const html = renderToStaticMarkup(
      <AppShell
        session={{ userId: 'test-user', displayName: '测试用户' }}
        onLogout={() => undefined}
      />
    );

    expect(html).toContain('复盘对话');
    expect(html).toContain('任务状态');
    expect(html).toContain('基础复盘');
    expect(html).toContain('深度复盘');
    expect(html).toContain('对局追问');
    expect(html).toContain('视频片段诊断');
    expect(html).toContain('能力解锁状态');
    expect(html).toContain('权益状态');
  });

  it('renders loading and failure views for realtime adaptation', () => {
    const loadingHtml = renderToStaticMarkup(<EntitlementStatusBanner loading />);
    const errorHtml = renderToStaticMarkup(<EntitlementStatusBanner error="provider timeout" />);
    const diagnosisHtml = renderToStaticMarkup(
      <DiagnosisResultRenderer
        running={false}
        taskObservation={{
          task_type: 'VIDEO_DIAGNOSIS',
          status: 'FAILED',
          task_id: 'task-1',
          message: 'provider unavailable',
          updated_at: '2026-03-30T00:00:00.000Z',
        }}
      />
    );

    expect(loadingHtml).toContain('正在加载权益状态');
    expect(errorHtml).toContain('provider timeout');
    expect(diagnosisHtml).toContain('失败');
    expect(diagnosisHtml).toContain('provider unavailable');
  });
});
