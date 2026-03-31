import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getHeroDetailUseCase,
  getHeroesUseCase,
  getDataCenterUseCase,
  getHomeDashboardUseCase,
  loginWithCodeUseCase,
  sendLoginCodeUseCase,
  setupProfileUseCase,
  type AppProfileDto,
  type DataCenterResponse,
  type HeroDetailResponse,
  type HeroListResponse,
  type HeroPosition,
  type HomeDashboardResponse,
} from './src/application';
import { loadRuntimeConfig } from './src/infrastructure/config/runtime-config';
import type { MatchSummary } from './src/domain';
import { getChampionAvatarUrl, getOutcomeColor, getOutcomeLabel, formatKda } from './src/presentation/app-shell/mobile-ui-model';
import { useAgentShell } from './src/presentation/app-shell/use-agent-shell';

type MainTab = 'HOME' | 'HEROES' | 'DATA_CENTER' | 'MINE';
type OverlayPage = 'MAIN' | 'REVIEW' | 'CHAT';

interface AppUserSession {
  userId: string;
  phone: string;
  nickname?: string;
  avatarUrl: string;
  sessionToken: string;
  profileCompleted: boolean;
}

const APP_NAME = '电竞私教复盘助手';

function heroChangeTagMeta(tag: 'BUFF' | 'NERF' | 'NEUTRAL'): { label: string; color: string; bg: string } {
  if (tag === 'BUFF') return { label: '增强', color: '#117A44', bg: '#E8FAF0' };
  if (tag === 'NERF') return { label: '削弱', color: '#B43232', bg: '#FDECEC' };
  return { label: '平衡', color: '#5E6F95', bg: '#EEF3FF' };
}

function PrimaryButton(props: { title: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <Pressable style={[styles.primaryBtn, props.disabled ? styles.btnDisabled : undefined]} onPress={props.onPress} disabled={props.disabled}>
      <Text style={styles.primaryBtnText}>{props.title}</Text>
    </Pressable>
  );
}

function GhostButton(props: { title: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <Pressable style={[styles.ghostBtn, props.disabled ? styles.btnDisabled : undefined]} onPress={props.onPress} disabled={props.disabled}>
      <Text style={styles.ghostBtnText}>{props.title}</Text>
    </Pressable>
  );
}

function SplashScreen(): React.ReactElement {
  return (
    <SafeAreaView style={styles.splashSafe}>
      <StatusBar style="light" />
      <View style={styles.splashOrbOuter}>
        <View style={styles.splashOrbInner}>
          <Text style={styles.splashLogo}>L</Text>
        </View>
      </View>
      <Text style={styles.splashTitle}>{APP_NAME}</Text>
      <Text style={styles.splashSub}>Agent-First LOL 复盘产品壳层</Text>
    </SafeAreaView>
  );
}

function LoginPage(props: { onLogin: (session: AppUserSession) => void }): React.ReactElement {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [codeHint, setCodeHint] = useState<string>();

  async function sendCode(): Promise<void> {
    if (!phone.trim()) {
      Alert.alert('提示', '请输入手机号');
      return;
    }
    setSendingCode(true);
    try {
      const response = await sendLoginCodeUseCase({ phone: phone.trim() });
      setCodeHint(response.mockCodeHint);
      Alert.alert('验证码已发送', `当前为 mock 验证码：${response.mockCodeHint}`);
    } catch (error) {
      Alert.alert('发送失败', error instanceof Error ? error.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }

  async function login(): Promise<void> {
    if (!phone.trim() || !code.trim()) {
      Alert.alert('提示', '请输入手机号和验证码');
      return;
    }
    setLoggingIn(true);
    try {
      const response = await loginWithCodeUseCase({
        phone: phone.trim(),
        verificationCode: code.trim(),
      });
      props.onLogin({
        userId: response.profile.userId,
        phone: response.profile.phone,
        nickname: response.profile.nickname,
        avatarUrl: response.profile.avatarUrl,
        sessionToken: response.sessionToken,
        profileCompleted: response.profile.profileCompleted,
      });
    } catch (error) {
      Alert.alert('登录失败', error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <View style={styles.loginHero}>
        <Text style={styles.heroTag}>{APP_NAME}</Text>
        <Text style={styles.heroTitle}>手机号登录</Text>
        <Text style={styles.heroSub}>未注册手机号将自动注册并登录。首次登录后需要补充昵称。</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>手机号</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          placeholderTextColor="#97A5C7"
        />
        <View style={styles.row}>
          <View style={styles.codeInputWrap}>
            <Text style={styles.fieldLabel}>验证码</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="请输入验证码"
              placeholderTextColor="#97A5C7"
            />
          </View>
          <PrimaryButton title={sendingCode ? '发送中...' : '发送验证码'} onPress={() => void sendCode()} disabled={sendingCode} />
        </View>

        {codeHint ? <Text style={styles.captionText}>当前 mock 验证码：{codeHint}</Text> : null}

        <PrimaryButton title={loggingIn ? '登录中...' : '登录并进入'} onPress={() => void login()} disabled={loggingIn} />
      </View>
    </SafeAreaView>
  );
}

function ProfileSetupModal(props: {
  visible: boolean;
  currentProfile?: AppProfileDto;
  onDone: (profile: AppProfileDto) => void;
}): React.ReactElement {
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.visible || !props.currentProfile) return;
    setNickname(props.currentProfile.nickname ?? '');
    setAvatarUrl(props.currentProfile.avatarUrl ?? '');
  }, [props.currentProfile, props.visible]);

  async function submit(): Promise<void> {
    if (!props.currentProfile) return;
    if (!nickname.trim()) {
      Alert.alert('提示', '请先填写昵称');
      return;
    }

    setSaving(true);
    try {
      const profile = await setupProfileUseCase({
        userId: props.currentProfile.userId,
        nickname: nickname.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      props.onDone(profile);
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={styles.modalMask}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>完善资料</Text>
          <Text style={styles.modalDesc}>首次登录请设置昵称，头像可选，不填将使用默认头像。</Text>

          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="请输入昵称"
            placeholderTextColor="#97A5C7"
          />
          <TextInput
            style={styles.input}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="头像 URL（可选）"
            placeholderTextColor="#97A5C7"
          />

          <PrimaryButton title={saving ? '保存中...' : '保存并继续'} onPress={() => void submit()} disabled={saving} />
        </View>
      </View>
    </Modal>
  );
}

function MatchRow(props: {
  item: MatchSummary;
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onCoach: () => void;
}): React.ReactElement {
  const outcomeColor = getOutcomeColor(props.item.outcome);

  return (
    <Pressable style={[styles.matchRow, props.selected ? styles.matchRowActive : undefined]} onPress={props.onSelect}>
      <View style={styles.matchHead}>
        <Image source={{ uri: getChampionAvatarUrl(props.item.championName) }} style={styles.heroAvatar} />
        <View style={styles.matchHeadBody}>
          <Text style={styles.matchTitle}>{props.item.championName}</Text>
          <Text style={styles.matchSub}>KDA {formatKda(props.item)} · {props.item.queue}</Text>
          <Text style={styles.matchSub}>{new Date(props.item.playedAt).toLocaleString()}</Text>
        </View>
        <Text style={[styles.outcomeText, { color: outcomeColor }]}>{getOutcomeLabel(props.item.outcome)}</Text>
      </View>
      <View style={styles.row}>
        <PrimaryButton title="生成复盘报告" onPress={props.onReview} />
        <GhostButton title="专属私教" onPress={props.onCoach} />
      </View>
    </Pressable>
  );
}

function BottomTabs(props: { tab: MainTab; onChange: (tab: MainTab) => void }): React.ReactElement {
  return (
    <View style={styles.bottomTabs}>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('HOME')}>
        <Text style={[styles.bottomTabText, props.tab === 'HOME' ? styles.bottomTabTextActive : undefined]}>首页</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('HEROES')}>
        <Text style={[styles.bottomTabText, props.tab === 'HEROES' ? styles.bottomTabTextActive : undefined]}>英雄</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('DATA_CENTER')}>
        <Text style={[styles.bottomTabText, props.tab === 'DATA_CENTER' ? styles.bottomTabTextActive : undefined]}>数据中心</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('MINE')}>
        <Text style={[styles.bottomTabText, props.tab === 'MINE' ? styles.bottomTabTextActive : undefined]}>我的</Text>
      </Pressable>
    </View>
  );
}

function AppInner(props: {
  session: AppUserSession;
  onLogout: () => void;
}): React.ReactElement {
  const vm = useAgentShell(props.session.userId);
  const runtimeConfig = useMemo(() => loadRuntimeConfig(), []);

  const [mainTab, setMainTab] = useState<MainTab>('HOME');
  const [overlayPage, setOverlayPage] = useState<OverlayPage>('MAIN');
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindingOverlay, setBindingOverlay] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const [homeData, setHomeData] = useState<HomeDashboardResponse>();
  const [dataCenter, setDataCenter] = useState<DataCenterResponse>();
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [heroPosition, setHeroPosition] = useState<HeroPosition>('ALL');
  const [heroesData, setHeroesData] = useState<HeroListResponse>();
  const [heroDetail, setHeroDetail] = useState<HeroDetailResponse>();
  const [heroesLoading, setHeroesLoading] = useState(false);
  const [heroDetailLoading, setHeroDetailLoading] = useState(false);

  const linked = Boolean(vm.linkedAccount);
  const hasFollowupEntitlement = Boolean(
    vm.entitlement?.effectiveEntitlements?.some((item) => item.featureCode === 'AI_FOLLOWUP' && item.status === 'ACTIVE')
  );
  const hasClipEntitlement = Boolean(
    vm.entitlement?.effectiveEntitlements?.some((item) => item.featureCode === 'CLIP_REVIEW' && item.status === 'ACTIVE')
  );
  const followupQuota = vm.entitlement?.remainingQuota?.AI_FOLLOWUP;
  const clipQuota = vm.entitlement?.remainingQuota?.CLIP_REVIEW;

  const canFollowup = runtimeConfig.aiFollowupPaid
    ? Boolean(vm.entitlement?.features?.AI_FOLLOWUP) && (hasFollowupEntitlement || (typeof followupQuota === 'number' ? followupQuota > 0 : false))
    : true;
  const canClipReview = runtimeConfig.clipReviewPaid
    ? Boolean(vm.entitlement?.features?.CLIP_REVIEW) && (hasClipEntitlement || (typeof clipQuota === 'number' ? clipQuota > 0 : false))
    : true;

  useEffect(() => {
    if (!linked) setBindModalVisible(true);
  }, [linked]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setDashboardLoading(true);
      try {
        const [home, center] = await Promise.all([
          getHomeDashboardUseCase(props.session.userId),
          getDataCenterUseCase(props.session.userId),
        ]);
        if (!alive) return;
        setHomeData(home);
        setDataCenter(center);
      } catch {
        if (!alive) return;
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
      setHeroesLoading(true);
      try {
        const heroes = await getHeroesUseCase({
          userId: props.session.userId,
          position: heroPosition,
        });
        if (!alive) return;
        setHeroesData(heroes);
        const first = heroes.champions[0];
        if (!first) {
          setHeroDetail(undefined);
          return;
        }
        setHeroDetailLoading(true);
        const detail = await getHeroDetailUseCase({
          userId: props.session.userId,
          championId: first.championId,
        });
        if (!alive) return;
        setHeroDetail(detail);
      } catch {
        if (!alive) return;
      } finally {
        if (alive) {
          setHeroesLoading(false);
          setHeroDetailLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.session.userId, heroPosition]);

  const reviewSummary = useMemo(() => vm.result?.finalResponse?.summary ?? vm.result?.error ?? '暂无复盘结果', [vm.result]);

  async function handleBind(): Promise<void> {
    setBindModalVisible(false);
    setBindingOverlay(true);
    const ok = await vm.linkAccount();
    setBindingOverlay(false);
    if (!ok) {
      setBindModalVisible(true);
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

  async function pickAsset(): Promise<void> {
    if (!canClipReview) {
      Alert.alert('功能未解锁', '视频片段诊断需要先解锁能力。');
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['video/*', 'image/*'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file) return;
    vm.setChatAttachment({
      file_name: file.name ?? 'asset',
      mime_type: file.mimeType ?? 'application/octet-stream',
      size_bytes: file.size ?? 0,
      duration_seconds: 20,
    });
    Alert.alert('素材已添加', file.name ?? '已添加素材');
  }

  async function submitChat(): Promise<void> {
    if (!canFollowup) {
      Alert.alert('功能未解锁', 'AI 追问需要先解锁能力。');
      return;
    }
    vm.setInput(chatInput);
    await vm.submitGoal();
    setChatInput('');
  }

  async function openHeroDetail(championId: string): Promise<void> {
    setHeroDetailLoading(true);
    try {
      const detail = await getHeroDetailUseCase({
        userId: props.session.userId,
        championId,
      });
      setHeroDetail(detail);
    } catch {
      Alert.alert('提示', '英雄详情加载失败，请稍后重试。');
    } finally {
      setHeroDetailLoading(false);
    }
  }

  function renderHome(): React.ReactElement {
    return (
      <ScrollView contentContainerStyle={styles.pageBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>最近版本变动</Text>
          {dashboardLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          {homeData?.updates.map((item) => (
            <View key={item.id} style={styles.listItemCard}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemSub}>Patch {item.patch}</Text>
              <Text style={styles.itemDesc}>{item.detail}</Text>
            </View>
          ))}
          <Text style={styles.captionText}>{homeData?.sourceNotice ?? '暂无版本信息'}</Text>
        </View>
      </ScrollView>
    );
  }

  function renderDataCenter(): React.ReactElement {
    const stats = dataCenter?.stats;
    const trendLabel = stats?.rankTrend === 'UP' ? '上升' : stats?.rankTrend === 'DOWN' ? '下降' : '平稳';
    return (
      <ScrollView contentContainerStyle={styles.pageBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>数据中心</Text>
          {dashboardLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>最近胜率</Text>
              <Text style={styles.metricValue}>{stats ? `${stats.recentWinRate}%` : '--'}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>段位趋势</Text>
              <Text style={styles.metricValue}>{trendLabel ?? '--'}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>胜负场</Text>
              <Text style={styles.metricValue}>{stats ? `${stats.wins}/${stats.losses}` : '--'}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>综合 KDA</Text>
              <Text style={styles.metricValue}>{stats?.kda ?? '--'}</Text>
            </View>
          </View>
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>{dataCenter?.narrative ?? '绑定账号后可生成训练趋势分析。'}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderHeroes(): React.ReactElement {
    const positionOptions: HeroPosition[] = ['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

    return (
      <ScrollView contentContainerStyle={styles.pageBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>英雄池（最新版本）</Text>
          <View style={styles.row}>
            {positionOptions.map((item) => (
              <Pressable
                key={item}
                style={[styles.positionChip, heroPosition === item ? styles.positionChipActive : undefined]}
                onPress={() => setHeroPosition(item)}
              >
                <Text style={[styles.positionChipText, heroPosition === item ? styles.positionChipTextActive : undefined]}>{item === 'ALL' ? '全部' : item}</Text>
              </Pressable>
            ))}
          </View>
          {heroesLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          <Text style={styles.captionText}>{heroesData?.sourceNotice ?? '正在加载英雄数据'}</Text>
          <View style={styles.heroGrid}>
            {heroesData?.champions.map((item) => {
              const tag = heroChangeTagMeta(item.latestChangeTag);
              return (
                <Pressable key={item.championId} style={styles.heroCard} onPress={() => void openHeroDetail(item.championId)}>
                  <Image source={{ uri: item.avatarUrl }} style={styles.heroCardAvatar} />
                  <View style={styles.heroCardBody}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSub}>{item.title}</Text>
                    <View style={[styles.changeTag, { backgroundColor: tag.bg }]}>
                      <Text style={[styles.changeTagText, { color: tag.color }]}>{tag.label}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>英雄详情</Text>
          {heroDetailLoading ? <ActivityIndicator color="#2F5FDB" /> : null}
          {heroDetail ? (
            <>
              <View style={styles.heroDetailHead}>
                <Image source={{ uri: heroDetail.champion.avatarUrl }} style={styles.heroDetailAvatar} />
                <View style={styles.heroDetailBody}>
                  <Text style={styles.profileName}>{heroDetail.champion.name}</Text>
                  <Text style={styles.profileText}>{heroDetail.champion.title}</Text>
                  <Text style={styles.profileText}>位置：{heroDetail.champion.positions.join(' / ')}</Text>
                  <Text style={styles.profileText}>版本：{heroDetail.version}</Text>
                </View>
              </View>
              <View style={styles.highlightBox}>
                <Text style={styles.highlightText}>最新版本变化：{heroDetail.champion.latestChangeSummary}</Text>
              </View>
              <Text style={styles.fieldLabel}>被动</Text>
              <Text style={styles.profileText}>{heroDetail.champion.passive.name}：{heroDetail.champion.passive.description}</Text>
              <Text style={styles.fieldLabel}>技能</Text>
              {heroDetail.champion.spells.map((spell) => (
                <View key={spell.id} style={styles.skillItem}>
                  <Image source={{ uri: spell.iconUrl }} style={styles.skillIcon} />
                  <View style={styles.skillBody}>
                    <Text style={styles.itemTitle}>{spell.name}</Text>
                    <Text style={styles.itemDesc}>{spell.description}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptyDesc}>请选择英雄查看详情。</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  function renderMine(): React.ReactElement {
    return (
      <ScrollView contentContainerStyle={styles.pageBody}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>我的账号</Text>
          <View style={styles.profileHead}>
            <Image source={{ uri: props.session.avatarUrl }} style={styles.profileAvatar} />
            <View style={styles.profileBody}>
              <Text style={styles.profileName}>{props.session.nickname ?? '未设置昵称'}</Text>
              <Text style={styles.profileText}>手机号：{props.session.phone}</Text>
              <Text style={styles.profileText}>游戏账号：{linked ? vm.accountLabel : '未绑定'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <GhostButton title="绑定账号" onPress={() => setBindModalVisible(true)} />
            <GhostButton title="退出登录" onPress={props.onLogout} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>战绩列表</Text>
            <GhostButton title="刷新" onPress={() => void vm.refreshRecentMatches()} disabled={!linked || vm.loadingRecentMatches} />
          </View>

          {!linked ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>请先绑定游戏账号</Text>
              <Text style={styles.emptyDesc}>绑定后可查看战绩并生成复盘报告。</Text>
              <PrimaryButton title="去绑定" onPress={() => setBindModalVisible(true)} />
            </View>
          ) : null}

          {linked && vm.recentMatches.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>暂无战绩</Text>
              <Text style={styles.emptyDesc}>点击刷新获取最近对局。</Text>
            </View>
          ) : null}

          {linked
            ? vm.recentMatches.map((item) => (
                <MatchRow
                  key={item.matchId}
                  item={item}
                  selected={vm.selectedMatchId === item.matchId}
                  onSelect={() => vm.setSelectedMatchId(item.matchId)}
                  onReview={() => void startBasicReview(item.matchId)}
                  onCoach={() => openCoach(item.matchId)}
                />
              ))
            : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <Modal visible={bindModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>绑定游戏账号</Text>
            <Text style={styles.modalDesc}>绑定后才能导入战绩并发起复盘。</Text>
            <View style={styles.row}>
              <GhostButton title="国际服" onPress={() => vm.switchRegion('INTERNATIONAL')} />
              <GhostButton title="国服" onPress={() => vm.switchRegion('CN')} />
            </View>
            {vm.region === 'INTERNATIONAL' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={vm.riotGameName}
                  onChangeText={vm.setRiotGameName}
                  placeholder="Riot ID（gameName）"
                  placeholderTextColor="#97A5C7"
                />
                <TextInput
                  style={styles.input}
                  value={vm.riotTagLine}
                  onChangeText={vm.setRiotTagLine}
                  placeholder="TagLine（例如 KR1）"
                  placeholderTextColor="#97A5C7"
                />
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>国服接入占位</Text>
                <Text style={styles.emptyDesc}>当前使用 mock provider，后续可替换为真实 WeGame / 腾讯授权链路。</Text>
              </View>
            )}
            <View style={styles.row}>
              <PrimaryButton title={vm.linkingAccount ? '绑定中...' : '立即绑定'} onPress={() => void handleBind()} />
              <GhostButton title="暂不绑定" onPress={() => setBindModalVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={bindingOverlay} transparent animationType="none">
        <View style={styles.loadingMask}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2F5FDB" />
            <Text style={styles.loadingText}>账号绑定中，请稍候...</Text>
          </View>
        </View>
      </Modal>

      {overlayPage === 'MAIN' ? (
        <>
          {mainTab === 'HOME' ? renderHome() : null}
          {mainTab === 'HEROES' ? renderHeroes() : null}
          {mainTab === 'DATA_CENTER' ? renderDataCenter() : null}
          {mainTab === 'MINE' ? renderMine() : null}
          <BottomTabs tab={mainTab} onChange={setMainTab} />
        </>
      ) : null}

      {overlayPage === 'REVIEW' ? (
        <ScrollView contentContainerStyle={styles.pageBody}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>复盘摘要</Text>
              <GhostButton title="返回" onPress={() => setOverlayPage('MAIN')} />
            </View>
            <Text style={styles.reviewText}>{reviewSummary}</Text>
          </View>
        </ScrollView>
      ) : null}

      {overlayPage === 'CHAT' ? (
        <SafeAreaView style={styles.safe}>
          <View style={styles.chatHeader}>
            <Text style={styles.sectionTitle}>专属私教</Text>
            <GhostButton title="返回" onPress={() => setOverlayPage('MAIN')} />
          </View>

          {!canFollowup ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockText}>AI 追问未解锁，购买后可继续围绕本局追问。</Text>
              <View style={styles.row}>
                <PrimaryButton title="解锁 AI 追问" onPress={() => void vm.startPurchase('AI_FOLLOWUP')} />
                {vm.paymentState.status === 'AWAITING_PAYMENT' ? (
                  <GhostButton title="确认支付回调" onPress={() => void vm.confirmPendingPayment()} />
                ) : null}
              </View>
            </View>
          ) : null}

          <ScrollView style={styles.chatList}>
            {vm.messages.length === 0 ? <Text style={styles.emptyDesc}>暂无对话，输入问题开始交流。</Text> : null}
            {vm.messages.map((msg) => (
              <View key={msg.id} style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent]}>
                <Text style={[styles.chatBubbleText, msg.role === 'user' ? styles.chatBubbleTextUser : undefined]}>{msg.content}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.chatInputBar}>
            <TextInput
              style={[styles.input, styles.chatInput]}
              multiline
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="继续提问，或结合素材让 AI 诊断"
              placeholderTextColor="#97A5C7"
            />
            <View style={styles.row}>
              <GhostButton title="添加素材" onPress={() => void pickAsset()} disabled={!canClipReview} />
              <PrimaryButton title={vm.running ? '发送中...' : '发送'} onPress={() => void submitChat()} disabled={vm.running || !chatInput.trim()} />
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<AppUserSession>();
  const [splashVisible, setSplashVisible] = useState(true);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashVisible(false), 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session) {
      setProfileModalVisible(false);
      return;
    }
    setProfileModalVisible(!session.profileCompleted);
  }, [session]);

  function handleProfileDone(profile: AppProfileDto): void {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        profileCompleted: profile.profileCompleted,
      };
    });
    setProfileModalVisible(false);
  }

  if (splashVisible) {
    return <SplashScreen />;
  }

  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

  return (
    <>
      <AppInner session={session} onLogout={() => setSession(undefined)} />
      <ProfileSetupModal
        visible={profileModalVisible}
        currentProfile={{
          userId: session.userId,
          phone: session.phone,
          nickname: session.nickname,
          avatarUrl: session.avatarUrl,
          profileCompleted: session.profileCompleted,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        }}
        onDone={handleProfileDone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7FF' },
  splashSafe: {
    flex: 1,
    backgroundColor: '#102B66',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashOrbOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#D7A84B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashOrbInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#F9F3E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: { color: '#0F2A63', fontSize: 42, fontWeight: '900' },
  splashTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  splashSub: { color: '#D6E2FF', fontSize: 14 },
  bgDecorTop: {
    position: 'absolute',
    right: -50,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#DCE7FF',
  },
  bgDecorBottom: {
    position: 'absolute',
    left: -60,
    bottom: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E6EEFF',
  },
  pageBody: { padding: 16, gap: 12, paddingBottom: 92 },
  loginHero: {
    margin: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D8FF',
    borderWidth: 1,
    gap: 8,
    shadowColor: '#4D6DB8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTag: { color: '#2E5AB8', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: '#1F2B4A', fontSize: 26, fontWeight: '900' },
  heroSub: { color: '#61739A', fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CEDCFF',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#4D6DB8',
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 2,
  },
  fieldLabel: { color: '#4A5D86', fontSize: 13, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CEDCFF',
    backgroundColor: '#F8FAFF',
    color: '#1F2B4A',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeInputWrap: { flex: 1, gap: 6 },
  captionText: { color: '#61739A', fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  primaryBtn: {
    backgroundColor: '#2F5FDB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  ghostBtn: {
    backgroundColor: '#F3F7FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CADAFE',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostBtnText: { color: '#355CAF', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  sectionTitle: { color: '#233256', fontSize: 17, fontWeight: '900' },
  listItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E1FF',
    backgroundColor: '#FBFCFF',
    padding: 10,
    gap: 5,
  },
  itemTitle: { color: '#21345C', fontSize: 14, fontWeight: '800' },
  itemSub: { color: '#4F6696', fontSize: 12, fontWeight: '700' },
  itemDesc: { color: '#6279A6', fontSize: 12, lineHeight: 18 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E1FF',
    backgroundColor: '#F8FAFF',
    padding: 10,
    gap: 4,
  },
  metricLabel: { color: '#6780AF', fontSize: 12, fontWeight: '600' },
  metricValue: { color: '#20335A', fontSize: 18, fontWeight: '900' },
  highlightBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D8FF',
    backgroundColor: '#EEF3FF',
    padding: 12,
  },
  highlightText: { color: '#314E82', fontSize: 13, lineHeight: 20 },
  profileHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8EEFF' },
  profileBody: { flex: 1, gap: 3 },
  profileName: { color: '#20335A', fontSize: 18, fontWeight: '900' },
  profileText: { color: '#3A4F7D', fontSize: 13, lineHeight: 20 },
  emptyBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E1FF',
    backgroundColor: '#F8FAFF',
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyTitle: { color: '#2C3E67', fontSize: 15, fontWeight: '800' },
  emptyDesc: { color: '#6A7FA8', fontSize: 13, lineHeight: 18 },
  matchRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E1FF',
    backgroundColor: '#FBFCFF',
    padding: 12,
    gap: 8,
  },
  matchRowActive: { borderColor: '#A6C0FF', backgroundColor: '#F2F7FF' },
  matchHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  heroAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#D9E4FF' },
  matchHeadBody: { flex: 1, gap: 2 },
  matchTitle: { color: '#21345C', fontSize: 14, fontWeight: '800' },
  matchSub: { color: '#6A7FA8', fontSize: 12 },
  outcomeText: { fontSize: 14, fontWeight: '900' },
  reviewText: { color: '#334A76', fontSize: 14, lineHeight: 22 },
  modalMask: { flex: 1, backgroundColor: 'rgba(9,20,45,0.25)', justifyContent: 'center', padding: 18 },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8D9FF',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  modalTitle: { color: '#233256', fontSize: 18, fontWeight: '900' },
  modalDesc: { color: '#61739A', fontSize: 13, lineHeight: 18 },
  loadingMask: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,22,44,0.22)' },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8D9FF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: { color: '#36518A', fontSize: 13, fontWeight: '600' },
  bottomTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#D5E1FF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    height: 68,
    paddingBottom: 8,
  },
  bottomTabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottomTabText: { color: '#5A6E97', fontWeight: '700', fontSize: 13 },
  bottomTabTextActive: { color: '#2E5AB8' },
  positionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CADAFE',
    backgroundColor: '#F3F7FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  positionChipActive: { borderColor: '#2F5FDB', backgroundColor: '#EAF0FF' },
  positionChipText: { color: '#49608E', fontSize: 12, fontWeight: '700' },
  positionChipTextActive: { color: '#2F5FDB' },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E1FF',
    backgroundColor: '#FBFCFF',
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  heroCardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D9E4FF' },
  heroCardBody: { flex: 1, gap: 2 },
  changeTag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  changeTagText: { fontSize: 11, fontWeight: '800' },
  heroDetailHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroDetailAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#D9E4FF' },
  heroDetailBody: { flex: 1, gap: 2 },
  skillItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE6FF',
    backgroundColor: '#F8FAFF',
    padding: 8,
    flexDirection: 'row',
    gap: 8,
  },
  skillIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#D9E4FF' },
  skillBody: { flex: 1, gap: 2 },
  chatHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4C57E',
    backgroundColor: '#FFF8E9',
    padding: 12,
    gap: 8,
  },
  lockText: { color: '#8E6119', fontSize: 13, lineHeight: 18 },
  chatList: { flex: 1, paddingHorizontal: 16 },
  chatBubble: {
    marginVertical: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '88%',
  },
  chatBubbleUser: { backgroundColor: '#2F5FDB', alignSelf: 'flex-end' },
  chatBubbleAgent: { backgroundColor: '#EEF3FF', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#D5E2FF' },
  chatBubbleText: { color: '#1F2B4A', fontSize: 13, lineHeight: 19 },
  chatBubbleTextUser: { color: '#FFFFFF' },
  chatInputBar: {
    borderTopWidth: 1,
    borderTopColor: '#D7E2FF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chatInput: { minHeight: 74, textAlignVertical: 'top' },
});

