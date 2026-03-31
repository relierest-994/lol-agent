import type { MatchSummary } from '../../domain';

export function getOutcomeColor(outcome: MatchSummary['outcome']): string {
  return outcome === 'WIN' ? '#129A4A' : '#D34141';
}

export function getOutcomeLabel(outcome: MatchSummary['outcome']): string {
  return outcome === 'WIN' ? '胜利' : '失败';
}

export function formatKda(match: MatchSummary): string {
  return `${match.kills}/${match.deaths}/${match.assists}`;
}

function normalizeChampionName(championName: string): string {
  return championName.replace(/[^A-Za-z]/g, '') || 'Aatrox';
}

export function getChampionAvatarUrl(championName: string): string {
  const normalized = normalizeChampionName(championName);
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${normalized}.png`;
}

