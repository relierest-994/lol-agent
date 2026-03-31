import { describe, expect, it } from 'vitest';
import { formatKda, getChampionAvatarUrl, getOutcomeColor, getOutcomeLabel } from '../src/presentation/app-shell/mobile-ui-model';

describe('mobile ui model regression', () => {
  it('maps outcome color and labels for win/loss', () => {
    expect(getOutcomeLabel('WIN')).toBe('胜利');
    expect(getOutcomeLabel('LOSS')).toBe('失败');
    expect(getOutcomeColor('WIN')).toBe('#129A4A');
    expect(getOutcomeColor('LOSS')).toBe('#D34141');
  });

  it('formats match kda and champion avatar url', () => {
    expect(
      formatKda({
        matchId: 'm1',
        championName: 'Ahri',
        queue: 'RANKED_SOLO',
        outcome: 'WIN',
        kills: 7,
        deaths: 2,
        assists: 9,
        durationMinutes: 31,
        playedAt: '2026-03-31T10:00:00.000Z',
      })
    ).toBe('7/2/9');

    expect(getChampionAvatarUrl('Lee Sin')).toContain('LeeSin.png');
    expect(getChampionAvatarUrl('')).toContain('Aatrox.png');
  });
});

