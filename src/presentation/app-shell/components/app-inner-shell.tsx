import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import {
  getDataCenterUseCase,
  getHeroDetailUseCase,
  getHeroesUseCase,
  getHomeDashboardUseCase,
  getHomeVersionHistoryUseCase,
  getItemDetailUseCase,
  getItemsUseCase,
  getMatchDetailForAppUseCase,
  getRuneDetailUseCase,
  getRunesUseCase,
  type ChangeTag,
  type DataCenterResponse,
  type HeroDetailResponse,
  type HeroListResponse,
  type HeroPosition,
  type HomeDashboardResponse,
  type ItemDetailResponse,
  type ItemListResponse,
  type RuneDetailResponse,
  type RuneListResponse,
} from '../../../application';
import { loadRuntimeConfig } from '../../../infrastructure/config/runtime-config';
import type { MatchDetail, MatchSummary, MatchTimeline } from '../../../domain';
import { formatKda, getChampionAvatarUrl, getOutcomeColor, getOutcomeLabel } from '../mobile-ui-model';
import type { AppUserSession } from '../types';
import { useAgentShell } from '../use-agent-shell';
import { AccountBindModal } from './account-bind-modal';
import { BindingLoadingOverlay } from './binding-loading-overlay';
import { BusinessFeedbackModal, type BusinessFeedbackState } from './business-feedback-modal';
import { MainBottomTabBar, type MainTab } from './main-bottom-tab-bar';

type OverlayPage = 'MAIN' | 'REVIEW' | 'CHAT' | 'HERO_DETAIL' | 'ITEM_DETAIL' | 'RUNE_DETAIL' | 'MATCH_DETAIL';
type HeroMetaTab = 'HERO' | 'RUNE' | 'ITEM';

function changeTagLabel(tag: 'ALL' | ChangeTag): string {
  if (tag === 'ALL') return '全部';
  if (tag === 'BUFF') return '增强';
  if (tag === 'NERF') return '削弱';
  return '平衡';
}

function changeTagStyle(tag: ChangeTag): { color: string; bg: string } {
  if (tag === 'BUFF') return { color: '#117A44', bg: '#E8FAF0' };
  if (tag === 'NERF') return { color: '#B43232', bg: '#FDECEC' };
  return { color: '#5E6F95', bg: '#EEF3FF' };
}

function PrimaryButton(props: { styles: Record<string, any>; title: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <Pressable style={[props.styles.primaryBtn, props.disabled ? props.styles.btnDisabled : undefined]} onPress={props.onPress} disabled={props.disabled}>
      <Text style={props.styles.primaryBtnText}>{props.title}</Text>
    </Pressable>
  );
}

function GhostButton(props: { styles: Record<string, any>; title: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <Pressable style={[props.styles.ghostBtn, props.disabled ? props.styles.btnDisabled : undefined]} onPress={props.onPress} disabled={props.disabled}>
      <Text style={props.styles.ghostBtnText}>{props.title}</Text>
    </Pressable>
  );
}

function TrendBars(props: { styles: Record<string, any>; values: number[]; color: string; title: string }): React.ReactElement {
  if (!props.values.length) {
    return (
      <View style={props.styles.card}>
        <Text style={props.styles.itemTitle}>{props.title}</Text>
        <Text style={props.styles.emptyDesc}>暂无数据</Text>
      </View>
    );
  }
  const max = Math.max(1, ...props.values);
  return (
    <View style={props.styles.card}>
      <Text style={props.styles.itemTitle}>{props.title}</Text>
      <View style={props.styles.chartRow}>
        {props.values.map((value, index) => (
          <View key={`${props.title}-${index}`} style={props.styles.chartBarWrap}>
            <View style={[props.styles.chartBar, { backgroundColor: props.color, height: `${Math.max(8, (value / max) * 100)}%` }]} />
            <Text style={props.styles.chartLabel}>{index + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MatchRow(props: {
  styles: Record<string, any>;
  item: MatchSummary;
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onCoach: () => void;
  onOpenDetail: () => void;
}): React.ReactElement {
  const outcomeColor = getOutcomeColor(props.item.outcome);
  return (
    <Pressable style={[props.styles.matchRow, props.selected ? props.styles.matchRowActive : undefined]} onPress={props.onSelect}>
      <View style={props.styles.matchHead}>
        <Image source={{ uri: getChampionAvatarUrl(props.item.championName) }} style={props.styles.heroAvatar} />
        <View style={props.styles.matchHeadBody}>
          <Text style={props.styles.matchTitle}>{props.item.championName}</Text>
          <Text style={props.styles.matchSub}>KDA {formatKda(props.item)} · {props.item.queue}</Text>
          <Text style={props.styles.matchSub}>{new Date(props.item.playedAt).toLocaleString()}</Text>
        </View>
        <Text style={[props.styles.outcomeText, { color: outcomeColor }]}>{getOutcomeLabel(props.item.outcome)}</Text>
      </View>
      <View style={props.styles.row}>
        <PrimaryButton styles={props.styles} title="生成复盘报告" onPress={props.onReview} />
        <GhostButton styles={props.styles} title="专属私教" onPress={props.onCoach} />
        <GhostButton styles={props.styles} title="战绩详情" onPress={props.onOpenDetail} />
      </View>
    </Pressable>
  );
}

export function AppInnerShell(props: { session: AppUserSession; onLogout: () => void; styles: Record<string, any> }): React.ReactElement {
  const vm = useAgentShell(props.session.userId);
  const runtimeConfig = useMemo(() => loadRuntimeConfig(), []);
  const [mainTab, setMainTab] = useState<MainTab>('HOME');
  const [overlayPage, setOverlayPage] = useState<OverlayPage>('MAIN');
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindingOverlay, setBindingOverlay] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [feedback, setFeedback] = useState<BusinessFeedbackState>();
  const [homeData, setHomeData] = useState<HomeDashboardResponse>();
  const [homeHistoryVisible, setHomeHistoryVisible] = useState(false);
  const [homeHistory, setHomeHistory] = useState<Array<{ version: string; previousVersion?: string; cached: boolean }>>([]);
  const [selectedHomeVersion, setSelectedHomeVersion] = useState<string>();
  const [dataCenter, setDataCenter] = useState<DataCenterResponse>();
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [heroMetaTab, setHeroMetaTab] = useState<HeroMetaTab>('HERO');
  const [heroPosition, setHeroPosition] = useState<HeroPosition>('ALL');
  const [changeTag, setChangeTag] = useState<'ALL' | ChangeTag>('ALL');
  const [heroesData, setHeroesData] = useState<HeroListResponse>();
  const [itemsData, setItemsData] = useState<ItemListResponse>();
  const [runesData, setRunesData] = useState<RuneListResponse>();
  const [metaLoading, setMetaLoading] = useState(false);
  const [heroDetail, setHeroDetail] = useState<HeroDetailResponse>();
  const [itemDetail, setItemDetail] = useState<ItemDetailResponse>();
  const [runeDetail, setRuneDetail] = useState<RuneDetailResponse>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail>();
  const [matchTimeline, setMatchTimeline] = useState<MatchTimeline>();

  const linked = Boolean(vm.linkedAccount);
  const hasFollowupEntitlement = Boolean(vm.entitlement?.effectiveEntitlements?.some((item) => item.featureCode === 'AI_FOLLOWUP' && item.status === 'ACTIVE'));
  const hasClipEntitlement = Boolean(vm.entitlement?.effectiveEntitlements?.some((item) => item.featureCode === 'CLIP_REVIEW' && item.status === 'ACTIVE'));
  const followupQuota = vm.entitlement?.remainingQuota?.AI_FOLLOWUP;
  const clipQuota = vm.entitlement?.remainingQuota?.CLIP_REVIEW;
  const canFollowup = runtimeConfig.aiFollowupPaid ? Boolean(vm.entitlement?.features?.AI_FOLLOWUP) && (hasFollowupEntitlement || (typeof followupQuota === 'number' ? followupQuota > 0 : false)) : true;
  const canClipReview = runtimeConfig.clipReviewPaid ? Boolean(vm.entitlement?.features?.CLIP_REVIEW) && (hasClipEntitlement || (typeof clipQuota === 'number' ? clipQuota > 0 : false)) : true;
  const reviewSummary = useMemo(() => vm.result?.finalResponse?.summary ?? vm.result?.error ?? '暂无复盘结果', [vm.result]);
  useEffect(() => {
    const alert = vm.uiAlerts[0];
    if (!alert) return;
    setFeedback({ title: alert.level === 'ERROR' ? '操作失败' : alert.level === 'WARN' ? '提示' : '通知', message: alert.message });
  }, [vm.uiAlerts]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setDashboardLoading(true);
      try {
        const [home, center] = await Promise.all([getHomeDashboardUseCase(props.session.userId), getDataCenterUseCase(props.session.userId)]);
        if (!alive) return;
        setHomeData(home);
        setSelectedHomeVersion(home.latestVersion);
        setDataCenter(center);
      } catch (error) {
        if (alive) setFeedback({ title: '加载失败', message: error instanceof Error ? error.message : '首页数据加载失败' });
      } finally {
        if (alive) setDashboardLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.session.userId, linked]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setMetaLoading(true);
      try {
        if (heroMetaTab === 'HERO') {
          const heroes = await getHeroesUseCase({ userId: props.session.userId, position: heroPosition, changeTag });
          if (alive) setHeroesData(heroes);
        } else if (heroMetaTab === 'ITEM') {
          const items = await getItemsUseCase({ userId: props.session.userId, changeTag });
          if (alive) setItemsData(items);
        } else {
          const runes = await getRunesUseCase({ userId: props.session.userId, changeTag });
          if (alive) setRunesData(runes);
        }
      } catch (error) {
        if (alive) setFeedback({ title: '加载失败', message: error instanceof Error ? error.message : '元数据加载失败' });
      } finally {
        if (alive) setMetaLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.session.userId, heroMetaTab, heroPosition, changeTag]);

  async function handleBind(): Promise<void> {
    setBindModalVisible(false);
    setBindingOverlay(true);
    const result = await vm.linkAccount();
    setBindingOverlay(false);
    if (!result.ok) {
      setFeedback({ title: '账号绑定失败', message: result.message ?? '绑定失败，请稍后重试。' });
    }
  }

  async function startBasicReview(matchId: string): Promise<void> {
    vm.setSelectedMatchId(matchId);
    await vm.runBasicReview();
    setOverlayPage('REVIEW');
  }

  function openCoach(matchId: string): void {
    vm.setSelectedMatchId(matchId);
    setOverlayPage('CHAT');
  }

  async function openMatchDetail(matchId: string): Promise<void> {
    try {
      setDetailLoading(true);
      const response = await getMatchDetailForAppUseCase({ region: vm.region, matchId });
      setMatchDetail(response.detail);
      setMatchTimeline(response.timeline);
      setOverlayPage('MATCH_DETAIL');
    } catch (error) {
      setFeedback({ title: '加载失败', message: error instanceof Error ? error.message : '战绩详情加载失败' });
    } finally {
      setDetailLoading(false);
    }
  }

  async function openHeroDetail(championId: string): Promise<void> {
    try {
      setDetailLoading(true);
      const detail = await getHeroDetailUseCase({ userId: props.session.userId, championId });
      setHeroDetail(detail);
      setOverlayPage('HERO_DETAIL');
    } catch (error) {
      setFeedback({ title: '提示', message: error instanceof Error ? error.message : '英雄详情加载失败' });
    } finally {
      setDetailLoading(false);
    }
  }

  async function openItemDetail(itemId: string): Promise<void> {
    try {
      setDetailLoading(true);
      const detail = await getItemDetailUseCase({ userId: props.session.userId, itemId });
      setItemDetail(detail);
      setOverlayPage('ITEM_DETAIL');
    } catch (error) {
      setFeedback({ title: '提示', message: error instanceof Error ? error.message : '装备详情加载失败' });
    } finally {
      setDetailLoading(false);
    }
  }

  async function openRuneDetail(runeId: string): Promise<void> {
    try {
      setDetailLoading(true);
      const detail = await getRuneDetailUseCase({ userId: props.session.userId, runeId });
      setRuneDetail(detail);
      setOverlayPage('RUNE_DETAIL');
    } catch (error) {
      setFeedback({ title: '提示', message: error instanceof Error ? error.message : '天赋详情加载失败' });
    } finally {
      setDetailLoading(false);
    }
  }

  async function pickAsset(): Promise<void> {
    if (!canClipReview) {
      setFeedback({ title: '功能未解锁', message: '视频片段诊断需要先解锁能力。' });
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({ type: ['video/*', 'image/*'], multiple: false, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file) return;
    vm.setChatAttachment({
      file_name: file.name ?? 'asset',
      mime_type: file.mimeType ?? 'application/octet-stream',
      size_bytes: file.size ?? 0,
      duration_seconds: 20,
    });
    setFeedback({ title: '素材已添加', message: file.name ?? '已添加素材' });
  }

  async function submitChat(): Promise<void> {
    if (!canFollowup) {
      setFeedback({ title: '功能未解锁', message: 'AI 追问需要先解锁能力。' });
      return;
    }
    vm.setInput(chatInput);
    await vm.submitGoal();
    setChatInput('');
  }

  const handleTabChange = (tab: MainTab): void => {
    console.log('[tab] press ->', tab);
    setMainTab(tab);
    setOverlayPage('MAIN');
  };

  async function loadHomeByVersion(version?: string): Promise<void> {
    try {
      setDashboardLoading(true);
      const data = await getHomeDashboardUseCase(props.session.userId, version);
      setHomeData(data);
      setSelectedHomeVersion(data.latestVersion);
    } catch (error) {
      setFeedback({ title: '加载失败', message: error instanceof Error ? error.message : '版本信息加载失败' });
    } finally {
      setDashboardLoading(false);
    }
  }

  async function toggleHomeHistory(): Promise<void> {
    if (homeHistoryVisible) {
      setHomeHistoryVisible(false);
      return;
    }
    try {
      const history = await getHomeVersionHistoryUseCase(props.session.userId, 40);
      setHomeHistory(history.versions);
      setHomeHistoryVisible(true);
    } catch (error) {
      setFeedback({ title: '加载失败', message: error instanceof Error ? error.message : '历史版本加载失败' });
    }
  }

  function renderHome(): React.ReactElement {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}>
        <View style={props.styles.card}>
          <View style={props.styles.rowBetween}>
            <Text style={props.styles.sectionTitle}>最近版本变动</Text>
            <GhostButton styles={props.styles} title={homeHistoryVisible ? '收起历史' : '查看历史版本变动'} onPress={() => void toggleHomeHistory()} />
          </View>
          {dashboardLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          <Text style={props.styles.captionText}>当前版本：{homeData?.latestVersion ?? '--'}（上一版本：{homeData?.previousVersion ?? '--'}）</Text>
          {selectedHomeVersion ? <Text style={props.styles.captionText}>查看版本：{selectedHomeVersion}</Text> : null}

          {homeHistoryVisible ? (
            <View style={props.styles.card}>
              <Text style={props.styles.itemTitle}>历史版本列表</Text>
              <View style={props.styles.row}>
                {homeHistory.map((item) => (
                  <Pressable key={item.version} style={[props.styles.positionChip, selectedHomeVersion === item.version ? props.styles.positionChipActive : undefined]} onPress={() => void loadHomeByVersion(item.version)}>
                    <Text style={[props.styles.positionChipText, selectedHomeVersion === item.version ? props.styles.positionChipTextActive : undefined]}>
                      {item.version}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={props.styles.listItemCard}>
            <Text style={props.styles.itemTitle}>变动的英雄</Text>
            {(homeData?.report.heroChanges ?? []).length === 0 ? <Text style={props.styles.itemSub}>暂无明显英雄改动</Text> : null}
            {(homeData?.report.heroChanges ?? []).map((item) => (
              <View key={`hero-${item.championId}`} style={props.styles.homeHeroRow}>
                <Image source={{ uri: item.avatarUrl }} style={props.styles.homeHeroAvatar} />
                <View style={props.styles.homeHeroBody}>
                  <Text style={props.styles.itemTitle}>{item.championName}</Text>
                  <Text style={props.styles.itemSub}>{item.statDelta}</Text>
                  {item.skillDelta ? <Text style={props.styles.itemSub}>{item.skillDelta}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <View style={props.styles.listItemCard}>
            <Text style={props.styles.itemTitle}>变动的装备</Text>
            {(homeData?.report.itemChanges ?? []).length === 0 ? <Text style={props.styles.itemSub}>暂无明显装备改动</Text> : null}
            {(homeData?.report.itemChanges ?? []).map((item) => (
              <View key={`item-${item.itemId}`} style={props.styles.homeHeroRow}>
                <Image source={{ uri: item.iconUrl }} style={props.styles.homeHeroAvatar} />
                <View style={props.styles.homeHeroBody}>
                  <Text style={props.styles.itemTitle}>{item.itemName}</Text>
                  <Text style={props.styles.itemSub}>{item.changeSummary}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={props.styles.listItemCard}>
            <Text style={props.styles.itemTitle}>变动的天赋</Text>
            {(homeData?.report.runeChanges ?? []).length === 0 ? <Text style={props.styles.itemSub}>暂无明显天赋改动</Text> : null}
            {(homeData?.report.runeChanges ?? []).map((item) => (
              <View key={`rune-${item.runeId}`} style={props.styles.homeHeroRow}>
                <Image source={{ uri: item.iconUrl }} style={props.styles.homeHeroAvatar} />
                <View style={props.styles.homeHeroBody}>
                  <Text style={props.styles.itemTitle}>{item.runeName}</Text>
                  <Text style={props.styles.itemSub}>{item.changeSummary}</Text>
                </View>
              </View>
            ))}
          </View>

          {(homeData?.spotlight ?? []).map((item, index) => (
            <View key={`spot-${index}`} style={props.styles.highlightBox}>
              <Text style={props.styles.highlightText}>{item}</Text>
            </View>
          ))}
          {homeData?.buffHighlights?.length ? (
            <View style={props.styles.listItemCard}>
              <Text style={props.styles.itemTitle}>增强英雄</Text>
              {homeData.buffHighlights.slice(0, 6).map((item) => (
                <View key={`buff-${item.championId}`} style={props.styles.homeHeroRow}>
                  <Image source={{ uri: item.avatarUrl }} style={props.styles.homeHeroAvatar} />
                  <View style={props.styles.homeHeroBody}><Text style={props.styles.itemTitle}>{item.championName}</Text><Text style={props.styles.itemSub}>{item.summary}</Text></View>
                </View>
              ))}
            </View>
          ) : null}
          {homeData?.nerfHighlights?.length ? (
            <View style={props.styles.listItemCard}>
              <Text style={props.styles.itemTitle}>削弱英雄</Text>
              {homeData.nerfHighlights.slice(0, 6).map((item) => (
                <View key={`nerf-${item.championId}`} style={props.styles.homeHeroRow}>
                  <Image source={{ uri: item.avatarUrl }} style={props.styles.homeHeroAvatar} />
                  <View style={props.styles.homeHeroBody}><Text style={props.styles.itemTitle}>{item.championName}</Text><Text style={props.styles.itemSub}>{item.summary}</Text></View>
                </View>
              ))}
            </View>
          ) : null}
          {(homeData?.updates ?? []).map((item) => (
            <View key={item.id} style={props.styles.listItemCard}><Text style={props.styles.itemTitle}>{item.title}</Text><Text style={props.styles.itemSub}>Patch {item.patch}</Text><Text style={props.styles.itemDesc}>{item.detail}</Text></View>
          ))}
          <Text style={props.styles.captionText}>{homeData?.sourceNotice ?? '暂无版本信息'}</Text>
        </View>
      </ScrollView>
    );
  }
  function renderDataCenter(): React.ReactElement {
    const stats = dataCenter?.stats;
    const trendLabel = stats?.rankTrend === 'UP' ? '上升' : stats?.rankTrend === 'DOWN' ? '下降' : '平稳';
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}>
        <View style={props.styles.card}>
          <Text style={props.styles.sectionTitle}>数据中心</Text>
          {dashboardLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          <View style={props.styles.metricGrid}>
            <View style={props.styles.metricCard}><Text style={props.styles.metricLabel}>最近胜率</Text><Text style={props.styles.metricValue}>{stats ? `${stats.recentWinRate}%` : '--'}</Text></View>
            <View style={props.styles.metricCard}><Text style={props.styles.metricLabel}>段位趋势</Text><Text style={props.styles.metricValue}>{trendLabel ?? '--'}</Text></View>
            <View style={props.styles.metricCard}><Text style={props.styles.metricLabel}>胜负场</Text><Text style={props.styles.metricValue}>{stats ? `${stats.wins}/${stats.losses}` : '--'}</Text></View>
            <View style={props.styles.metricCard}><Text style={props.styles.metricLabel}>综合 KDA</Text><Text style={props.styles.metricValue}>{stats?.kda ?? '--'}</Text></View>
          </View>
          <View style={props.styles.highlightBox}><Text style={props.styles.highlightText}>{dataCenter?.narrative ?? '绑定账号后可生成训练趋势分析。'}</Text></View>
          {(dataCenter?.keyInsights ?? []).map((item, idx) => <Text key={`insight-${idx}`} style={props.styles.captionText}>• {item}</Text>)}
        </View>
        <TrendBars styles={props.styles} title="近局胜率趋势" values={dataCenter?.charts.winRateTrend ?? []} color="#2F5FDB" />
        <TrendBars styles={props.styles} title="近局 KDA 趋势" values={dataCenter?.charts.kdaTrend ?? []} color="#28A06C" />
        <TrendBars styles={props.styles} title="击杀走势" values={dataCenter?.charts.killsTrend ?? []} color="#7A5BFF" />
        <TrendBars styles={props.styles} title="死亡走势" values={dataCenter?.charts.deathsTrend ?? []} color="#CC4A4A" />
      </ScrollView>
    );
  }

  function renderHeroes(): React.ReactElement {
    const positionOptions: HeroPosition[] = ['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const changeOptions: Array<'ALL' | ChangeTag> = ['ALL', 'BUFF', 'NERF', 'NEUTRAL'];
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}>
        <View style={props.styles.card}>
          <Text style={props.styles.sectionTitle}>英雄生态</Text>
          <Text style={props.styles.captionText}>当前版本：{heroesData?.version ?? itemsData?.version ?? runesData?.version ?? '--'}</Text>
          <View style={props.styles.row}><GhostButton styles={props.styles} title="英雄" onPress={() => setHeroMetaTab('HERO')} /><GhostButton styles={props.styles} title="天赋" onPress={() => setHeroMetaTab('RUNE')} /><GhostButton styles={props.styles} title="装备" onPress={() => setHeroMetaTab('ITEM')} /></View>
          <View style={props.styles.row}>{changeOptions.map((item) => <Pressable key={`chg-${item}`} style={[props.styles.positionChip, changeTag === item ? props.styles.positionChipActive : undefined]} onPress={() => setChangeTag(item)}><Text style={[props.styles.positionChipText, changeTag === item ? props.styles.positionChipTextActive : undefined]}>{changeTagLabel(item)}</Text></Pressable>)}</View>
          {heroMetaTab === 'HERO' ? <View style={props.styles.row}>{positionOptions.map((item) => <Pressable key={item} style={[props.styles.positionChip, heroPosition === item ? props.styles.positionChipActive : undefined]} onPress={() => setHeroPosition(item)}><Text style={[props.styles.positionChipText, heroPosition === item ? props.styles.positionChipTextActive : undefined]}>{item === 'ALL' ? '全部' : item}</Text></Pressable>)}</View> : null}
          {metaLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          <View style={props.styles.heroGrid}>
            {heroMetaTab === 'HERO' ? (heroesData?.champions ?? []).map((item) => { const tagStyle = changeTagStyle(item.latestChangeTag); return <Pressable key={item.championId} style={props.styles.heroCard} onPress={() => void openHeroDetail(item.championId)}><Image source={{ uri: item.avatarUrl }} style={props.styles.heroCardAvatar} /><View style={props.styles.heroCardBody}><Text style={props.styles.itemTitle}>{item.name}</Text><Text style={props.styles.itemSub}>{item.title}</Text><View style={[props.styles.changeTag, { backgroundColor: tagStyle.bg }]}><Text style={[props.styles.changeTagText, { color: tagStyle.color }]}>{changeTagLabel(item.latestChangeTag)}</Text></View></View></Pressable>; }) : null}
            {heroMetaTab === 'ITEM' ? (itemsData?.items ?? []).map((item) => { const tagStyle = changeTagStyle(item.latestChangeTag); return <Pressable key={item.itemId} style={props.styles.heroCard} onPress={() => void openItemDetail(item.itemId)}><Image source={{ uri: item.iconUrl }} style={props.styles.heroCardAvatar} /><View style={props.styles.heroCardBody}><Text style={props.styles.itemTitle}>{item.name}</Text><Text style={props.styles.itemSub}>{item.plainText}</Text><View style={[props.styles.changeTag, { backgroundColor: tagStyle.bg }]}><Text style={[props.styles.changeTagText, { color: tagStyle.color }]}>{changeTagLabel(item.latestChangeTag)}</Text></View></View></Pressable>; }) : null}
            {heroMetaTab === 'RUNE' ? (runesData?.runes ?? []).map((item) => { const tagStyle = changeTagStyle(item.latestChangeTag); return <Pressable key={item.runeId} style={props.styles.heroCard} onPress={() => void openRuneDetail(item.runeId)}><Image source={{ uri: item.iconUrl }} style={props.styles.heroCardAvatar} /><View style={props.styles.heroCardBody}><Text style={props.styles.itemTitle}>{item.name}</Text><Text style={props.styles.itemSub}>{item.tree}</Text><View style={[props.styles.changeTag, { backgroundColor: tagStyle.bg }]}><Text style={[props.styles.changeTagText, { color: tagStyle.color }]}>{changeTagLabel(item.latestChangeTag)}</Text></View></View></Pressable>; }) : null}
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMine(): React.ReactElement {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}>
        <View style={props.styles.card}><Text style={props.styles.sectionTitle}>我的账号</Text><View style={props.styles.profileHead}><Image source={{ uri: props.session.avatarUrl }} style={props.styles.profileAvatar} /><View style={props.styles.profileBody}><Text style={props.styles.profileName}>{props.session.nickname ?? '未设置昵称'}</Text><Text style={props.styles.profileText}>手机号：{props.session.phone}</Text><Text style={props.styles.profileText}>游戏账号：{linked ? vm.accountLabel : '未绑定'}</Text></View></View><View style={props.styles.row}><GhostButton styles={props.styles} title="绑定账号" onPress={() => setBindModalVisible(true)} /><GhostButton styles={props.styles} title="退出登录" onPress={props.onLogout} /></View></View>
        <View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>战绩列表</Text><GhostButton styles={props.styles} title="刷新" onPress={() => void vm.refreshRecentMatches()} disabled={!linked || vm.loadingRecentMatches} /></View>{!linked ? <View style={props.styles.emptyBox}><Text style={props.styles.emptyTitle}>请先绑定游戏账号</Text><Text style={props.styles.emptyDesc}>绑定后可查看战绩并生成复盘报告。</Text><PrimaryButton styles={props.styles} title="去绑定" onPress={() => setBindModalVisible(true)} /></View> : null}{linked && vm.recentMatches.length === 0 ? <View style={props.styles.emptyBox}><Text style={props.styles.emptyTitle}>暂无战绩</Text><Text style={props.styles.emptyDesc}>当前账号无可展示对局数据。</Text></View> : null}{linked ? vm.recentMatches.map((item) => <MatchRow styles={props.styles} key={item.matchId} item={item} selected={vm.selectedMatchId === item.matchId} onSelect={() => vm.setSelectedMatchId(item.matchId)} onReview={() => void startBasicReview(item.matchId)} onCoach={() => openCoach(item.matchId)} onOpenDetail={() => void openMatchDetail(item.matchId)} />) : null}</View>
      </ScrollView>
    );
  }

  function renderMainTabContent(): React.ReactElement {
    if (mainTab === 'HOME') return renderHome();
    if (mainTab === 'HEROES') return renderHeroes();
    if (mainTab === 'DATA_CENTER') return renderDataCenter();
    return renderMine();
  }

  return (
    <SafeAreaView style={props.styles.safe}>
      <StatusBar style="dark" />
      <View style={props.styles.bgDecorTop} pointerEvents="none" />
      <View style={props.styles.bgDecorBottom} pointerEvents="none" />
      <AccountBindModal visible={bindModalVisible} region={vm.region} riotGameName={vm.riotGameName} riotTagLine={vm.riotTagLine} linking={vm.linkingAccount} onRegionChange={vm.switchRegion} onRiotGameNameChange={vm.setRiotGameName} onRiotTagLineChange={vm.setRiotTagLine} onBind={() => void handleBind()} onClose={() => setBindModalVisible(false)} />
      <BindingLoadingOverlay visible={bindingOverlay} />
      {overlayPage === 'MAIN' ? (
        <View style={props.styles.mainLayout}>
          <View style={props.styles.mainPane}>{renderMainTabContent()}</View>
          <View style={props.styles.bottomTabDock} pointerEvents="box-none">
            <MainBottomTabBar activeTab={mainTab} onChange={handleTabChange} />
          </View>
        </View>
      ) : null}
      {overlayPage === 'REVIEW' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}><View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>复盘摘要</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View><Text style={props.styles.reviewText}>{reviewSummary}</Text></View></ScrollView> : null}
      {overlayPage === 'CHAT' ? <SafeAreaView style={props.styles.safe}><View style={props.styles.chatHeader}><Text style={props.styles.sectionTitle}>专属私教</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View>{!canFollowup ? <View style={props.styles.lockBanner}><Text style={props.styles.lockText}>AI 追问未解锁，购买后可继续围绕本局追问。</Text><View style={props.styles.row}><PrimaryButton styles={props.styles} title="解锁 AI 追问" onPress={() => void vm.startPurchase('AI_FOLLOWUP')} />{vm.paymentState.status === 'AWAITING_PAYMENT' ? <GhostButton styles={props.styles} title="确认支付回调" onPress={() => void vm.confirmPendingPayment()} /> : null}</View></View> : null}<ScrollView style={props.styles.chatList}>{vm.messages.length === 0 ? <Text style={props.styles.emptyDesc}>暂无对话，输入问题开始交流。</Text> : null}{vm.messages.map((msg) => <View key={msg.id} style={[props.styles.chatBubble, msg.role === 'user' ? props.styles.chatBubbleUser : props.styles.chatBubbleAgent]}><Text style={[props.styles.chatBubbleText, msg.role === 'user' ? props.styles.chatBubbleTextUser : undefined]}>{msg.content}</Text></View>)}</ScrollView><View style={props.styles.chatInputBar}><TextInput style={[props.styles.input, props.styles.chatInput]} multiline value={chatInput} onChangeText={setChatInput} placeholder="继续提问，或结合素材让 AI 诊断" placeholderTextColor="#97A5C7" /><View style={props.styles.row}><GhostButton styles={props.styles} title="添加素材" onPress={() => void pickAsset()} disabled={!canClipReview} /><PrimaryButton styles={props.styles} title={vm.running ? '发送中...' : '发送'} onPress={() => void submitChat()} disabled={vm.running || !chatInput.trim()} /></View></View></SafeAreaView> : null}
      {overlayPage === 'HERO_DETAIL' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}><View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>英雄详情</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View>{detailLoading ? <ActivityIndicator color="#2F5FDB" /> : null}{heroDetail ? <><View style={props.styles.heroDetailHead}><Image source={{ uri: heroDetail.champion.avatarUrl }} style={props.styles.heroDetailAvatar} /><View style={props.styles.heroDetailBody}><Text style={props.styles.profileName}>{heroDetail.champion.name}</Text><Text style={props.styles.profileText}>{heroDetail.champion.title}</Text><Text style={props.styles.profileText}>版本：{heroDetail.version}</Text><Text style={props.styles.profileText}>位置：{heroDetail.champion.positions.join(' / ')}</Text></View></View><Text style={props.styles.profileText}>{heroDetail.champion.lore}</Text><View style={props.styles.highlightBox}><Text style={props.styles.highlightText}>版本变化：{heroDetail.champion.latestChangeSummary}</Text></View><Text style={props.styles.fieldLabel}>基础数值</Text>{Object.entries(heroDetail.champion.stats).map(([key, value]) => <Text key={key} style={props.styles.profileText}>{key}: {value}</Text>)}<Text style={props.styles.fieldLabel}>被动</Text><Text style={props.styles.profileText}>{heroDetail.champion.passive.name}：{heroDetail.champion.passive.description}</Text><Text style={props.styles.fieldLabel}>技能</Text>{heroDetail.champion.spells.map((spell) => <View key={spell.id} style={props.styles.skillItem}><Image source={{ uri: spell.iconUrl }} style={props.styles.skillIcon} /><View style={props.styles.skillBody}><Text style={props.styles.itemTitle}>{spell.name}</Text><Text style={props.styles.itemDesc}>{spell.description}</Text><Text style={props.styles.captionText}>冷却：{spell.cooldown ?? '--'} 消耗：{spell.cost ?? '--'} 射程：{spell.range ?? '--'}</Text></View></View>)}</> : <Text style={props.styles.emptyDesc}>暂无英雄详情</Text>}</View></ScrollView> : null}
      {overlayPage === 'ITEM_DETAIL' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}><View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>装备详情</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View>{itemDetail ? <><Text style={props.styles.profileName}>{itemDetail.item.name}</Text><Text style={props.styles.profileText}>版本：{itemDetail.version}</Text><Text style={props.styles.profileText}>总价：{itemDetail.item.goldTotal} / 售价：{itemDetail.item.goldSell}</Text><Text style={props.styles.profileText}>{itemDetail.item.plainText}</Text><Text style={props.styles.itemDesc}>{itemDetail.item.description}</Text><Text style={props.styles.fieldLabel}>标签：{itemDetail.item.tags.join(' / ') || '--'}</Text><Text style={props.styles.fieldLabel}>数值</Text>{Object.entries(itemDetail.item.stats).map(([key, value]) => <Text key={key} style={props.styles.profileText}>{key}: {value}</Text>)}</> : <Text style={props.styles.emptyDesc}>暂无装备详情</Text>}</View></ScrollView> : null}
      {overlayPage === 'RUNE_DETAIL' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}><View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>天赋详情</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View>{runeDetail ? <><Text style={props.styles.profileName}>{runeDetail.rune.name}</Text><Text style={props.styles.profileText}>版本：{runeDetail.version}</Text><Text style={props.styles.profileText}>符文系：{runeDetail.rune.tree}</Text><Text style={props.styles.profileText}>{runeDetail.rune.shortDesc}</Text><Text style={props.styles.itemDesc}>{runeDetail.rune.longDesc}</Text></> : <Text style={props.styles.emptyDesc}>暂无天赋详情</Text>}</View></ScrollView> : null}
      {overlayPage === 'MATCH_DETAIL' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={props.styles.pageBody}><View style={props.styles.card}><View style={props.styles.rowBetween}><Text style={props.styles.sectionTitle}>战绩详情</Text><GhostButton styles={props.styles} title="返回" onPress={() => setOverlayPage('MAIN')} /></View>{detailLoading ? <ActivityIndicator color="#2F5FDB" /> : null}{matchDetail ? <><Text style={props.styles.profileName}>{matchDetail.championName}</Text><Text style={props.styles.profileText}>{matchDetail.queue} · {getOutcomeLabel(matchDetail.outcome)}</Text><Text style={props.styles.profileText}>KDA {matchDetail.kills}/{matchDetail.deaths}/{matchDetail.assists}</Text><Text style={props.styles.profileText}>对局时长：{matchDetail.durationMinutes} 分钟</Text><Text style={props.styles.profileText}>补刀效率：{matchDetail.timelineSignals.csPerMinute}</Text><Text style={props.styles.profileText}>视野分：{matchDetail.timelineSignals.visionScore}</Text><Text style={props.styles.fieldLabel}>时间线</Text>{(matchTimeline?.events ?? []).slice(0, 30).map((event, index) => <Text key={`${event.minute}-${index}`} style={props.styles.profileText}>{event.minute} 分 · {event.note}</Text>)}</> : <Text style={props.styles.emptyDesc}>暂无战绩详情</Text>}</View></ScrollView> : null}
      <BusinessFeedbackModal
        visible={Boolean(feedback)}
        title={feedback?.title ?? '提示'}
        message={feedback?.message ?? ''}
        onClose={() => {
          setFeedback(undefined);
        }}
      />
    </SafeAreaView>
  );
}
