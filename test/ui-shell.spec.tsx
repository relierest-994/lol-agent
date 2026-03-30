import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../src/presentation/app-shell/app-shell';
import { EntitlementStatusBanner } from '../src/presentation/status-panels/entitlement-status-banner';
import { DiagnosisResultRenderer } from '../src/presentation/result-renderers/diagnosis-result-renderer';

describe('UI Shell Regression', () => {
  it('renders phase3 shell modules', () => {
    const html = renderToStaticMarkup(<AppShell />);

    expect(html).toContain('Agent Chat Shell');
    expect(html).toContain('Agent Task Status');
    expect(html).toContain('Review Summary');
    expect(html).toContain('Deep Review');
    expect(html).toContain('Match Ask Panel');
    expect(html).toContain('Video Upload Panel');
    expect(html).toContain('Capability Gate');
    expect(html).toContain('Entitlement Status');
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

    expect(loadingHtml).toContain('Loading entitlement state');
    expect(errorHtml).toContain('provider timeout');
    expect(diagnosisHtml).toContain('FAILED');
    expect(diagnosisHtml).toContain('provider unavailable');
  });
});
