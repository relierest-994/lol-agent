import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { loadRuntimeConfig } from './src/infrastructure/config/runtime-config';
import type { MatchSummary } from './src/domain';
import { useAgentShell } from './src/presentation/app-shell/use-agent-shell';

type TabKey = 'MATCHES' | 'PROFILE';
type PageKey = 'HOME' | 'REVIEW' | 'CHAT';

interface AppUserSession {
  userId: string;
  nickname: string;
}

const APP_NAME = '私有电竞教练';
const NICKNAME_STORE_KEY = 'lol-agent:app-user-nicknames';

function randomUserId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMatchTitle(match: MatchSummary): string {
  const outcome = match.outcome === 'WIN' ? '胜' : '负';
  return `${match.championName} · ${outcome} · ${match.queue}`;
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
          <Text style={styles.splashLogo}>E</Text>
        </View>
      </View>
      <Text style={styles.splashTitle}>{APP_NAME}</Text>
      <Text style={styles.splashSub}>你的专属 LOL AI 复盘助手</Text>
    </SafeAreaView>
  );
}

function LoginPage(props: { onLogin: (session: AppUserSession) => void }): React.ReactElement {
  const [nickname, setNickname] = useState('');
  const [checking, setChecking] = useState(false);

  async function submitLogin(): Promise<void> {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    setChecking(true);
    try {
      const raw = await AsyncStorage.getItem(NICKNAME_STORE_KEY);
      const used = raw ? (JSON.parse(raw) as string[]) : [];
      if (used.includes(trimmed)) {
        Alert.alert('昵称已存在', '请换一个昵称后再登录。');
        return;
      }
      await AsyncStorage.setItem(NICKNAME_STORE_KEY, JSON.stringify([...used, trimmed]));
      props.onLogin({ userId: randomUserId(), nickname: trimmed });
    } catch {
      Alert.alert('登录失败', '本地会话初始化失败，请重试。');
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />
      <View style={styles.loginHero}>
        <Text style={styles.heroTag}>{APP_NAME}</Text>
        <Text style={styles.heroTitle}>欢迎回来</Text>
        <Text style={styles.heroSub}>先登录应用账号，再绑定游戏账号开始复盘。</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>昵称（不可重复）</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="输入你的昵称"
          placeholderTextColor="#97A5C7"
        />
        <PrimaryButton title={checking ? '登录中...' : '进入应用'} onPress={() => void submitLogin()} disabled={checking || !nickname.trim()} />
      </View>
    </SafeAreaView>
  );
}

function MatchRow(props: {
  item: MatchSummary;
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onChat: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={props.onSelect} style={[styles.matchRow, props.selected ? styles.matchRowActive : undefined]}>
      <View style={styles.matchAccent} />
      <Text style={styles.matchTitle}>{formatMatchTitle(props.item)}</Text>
      <Text style={styles.matchSub}>
        KDA {props.item.kills}/{props.item.deaths}/{props.item.assists} · {props.item.durationMinutes} 分钟
      </Text>
      <Text style={styles.matchSub}>{new Date(props.item.playedAt).toLocaleString()}</Text>
      <View style={styles.row}>
        <PrimaryButton title="AI复盘" onPress={props.onReview} />
        <GhostButton title="和AI交流" onPress={props.onChat} />
      </View>
    </Pressable>
  );
}

function AppInner(props: { session: AppUserSession; onLogout: () => void }): React.ReactElement {
  const vm = useAgentShell(props.session.userId);
  const runtimeConfig = useMemo(() => loadRuntimeConfig(), []);

  const [tab, setTab] = useState<TabKey>('MATCHES');
  const [page, setPage] = useState<PageKey>('HOME');
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');

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

  const reviewSummary = useMemo(() => vm.result?.finalResponse?.summary ?? vm.result?.error ?? '暂无复盘结果', [vm.result]);

  async function handleBind(): Promise<void> {
    const ok = await vm.linkAccount();
    if (ok) setBindModalVisible(false);
  }

  async function startBasicReview(matchId: string): Promise<void> {
    vm.setSelectedMatchId(matchId);
    await vm.runBasicReview();
    setPage('REVIEW');
  }

  function openChat(matchId: string): void {
    vm.setSelectedMatchId(matchId);
    setPage('CHAT');
  }

  async function pickAsset(): Promise<void> {
    if (!canClipReview) {
      Alert.alert('功能未解锁', '多模态素材诊断需付费解锁。');
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
      Alert.alert('功能未解锁', 'AI追问需付费解锁。');
      return;
    }
    vm.setInput(chatInput);
    await vm.submitGoal();
    setChatInput('');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />

      <Modal visible={bindModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>请先绑定游戏账号</Text>
            <Text style={styles.modalDesc}>绑定后才能加载战绩并开始复盘。</Text>
            <View style={styles.row}>
              <GhostButton title="国际服" onPress={() => vm.switchRegion('INTERNATIONAL')} />
              <GhostButton title="国服（占位）" onPress={() => vm.switchRegion('CN')} />
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
                <Text style={styles.emptyTitle}>国服账号体系占位保留</Text>
                <Text style={styles.emptyDesc}>当前为 Wegame 占位入口，后续接入真实国服授权链路。</Text>
              </View>
            )}
            <View style={styles.row}>
              <PrimaryButton title={vm.linkingAccount ? '绑定中...' : '立即绑定'} onPress={() => void handleBind()} />
              <GhostButton title="暂不绑定" onPress={() => setBindModalVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {page === 'HOME' && (
        <ScrollView contentContainerStyle={styles.pageBody}>
          <View style={styles.topCard}>
            <Text style={styles.heroTag}>{APP_NAME}</Text>
            <Text style={styles.topTitle}>你好，{props.session.nickname}</Text>
            <Text style={styles.topSub}>自然语言下达目标，Agent 自动规划任务，结果统一收敛到可视化壳层。</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>战绩 {vm.recentMatches.length}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{linked ? '已绑定账号' : '未绑定账号'}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{canFollowup ? '追问已解锁' : '追问待解锁'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabRow}>
            <Pressable style={[styles.tabBtn, tab === 'MATCHES' ? styles.tabBtnActive : undefined]} onPress={() => setTab('MATCHES')}>
              <Text style={[styles.tabText, tab === 'MATCHES' ? styles.tabTextActive : undefined]}>战绩</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, tab === 'PROFILE' ? styles.tabBtnActive : undefined]} onPress={() => setTab('PROFILE')}>
              <Text style={[styles.tabText, tab === 'PROFILE' ? styles.tabTextActive : undefined]}>我的</Text>
            </Pressable>
          </View>

          {tab === 'MATCHES' && (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>最近战绩</Text>
                <GhostButton title="刷新" onPress={() => void vm.refreshRecentMatches()} disabled={!linked || vm.loadingRecentMatches} />
              </View>

              {!linked && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>请先绑定账号</Text>
                  <Text style={styles.emptyDesc}>绑定成功后可查看战绩并使用 AI 复盘。</Text>
                  <PrimaryButton title="去绑定账号" onPress={() => setBindModalVisible(true)} />
                </View>
              )}

              {linked && vm.recentMatches.length === 0 && (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>暂无战绩</Text>
                  <Text style={styles.emptyDesc}>点击刷新获取最近对局。</Text>
                </View>
              )}

              {linked &&
                vm.recentMatches.map((item) => (
                  <MatchRow
                    key={item.matchId}
                    item={item}
                    selected={vm.selectedMatchId === item.matchId}
                    onSelect={() => vm.setSelectedMatchId(item.matchId)}
                    onReview={() => void startBasicReview(item.matchId)}
                    onChat={() => openChat(item.matchId)}
                  />
                ))}
            </View>
          )}

          {tab === 'PROFILE' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>账号信息</Text>
              <Text style={styles.profileText}>昵称：{props.session.nickname}</Text>
              <Text style={styles.profileText}>游戏绑定：{linked ? vm.accountLabel : '未绑定'}</Text>
              <Text style={styles.profileText}>AI追问：{canFollowup ? '已解锁' : '未解锁'}</Text>
              <Text style={styles.profileText}>素材诊断：{canClipReview ? '已解锁' : '未解锁'}</Text>
              <View style={styles.row}>
                <GhostButton title="绑定账号" onPress={() => setBindModalVisible(true)} />
                <GhostButton title="退出登录" onPress={props.onLogout} />
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {page === 'REVIEW' && (
        <ScrollView contentContainerStyle={styles.pageBody}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>复盘摘要</Text>
              <GhostButton title="返回战绩" onPress={() => setPage('HOME')} />
            </View>
            <Text style={styles.reviewText}>{reviewSummary}</Text>
          </View>
        </ScrollView>
      )}

      {page === 'CHAT' && (
        <SafeAreaView style={styles.safe}>
          <View style={styles.chatHeader}>
            <Text style={styles.sectionTitle}>和 AI 交流</Text>
            <GhostButton title="返回战绩" onPress={() => setPage('HOME')} />
          </View>

          {!canFollowup && (
            <View style={styles.lockBanner}>
              <Text style={styles.lockText}>AI 追问未解锁，购买后可进入对话。</Text>
              <View style={styles.row}>
                <PrimaryButton title="解锁 AI追问" onPress={() => void vm.startPurchase('AI_FOLLOWUP')} />
                {vm.paymentState.status === 'AWAITING_PAYMENT' && (
                  <GhostButton title="确认支付回调" onPress={() => void vm.confirmPendingPayment()} />
                )}
              </View>
            </View>
          )}

          <ScrollView style={styles.chatList}>
            {vm.messages.length === 0 && <Text style={styles.emptyDesc}>暂无对话，输入问题开始交流。</Text>}
            {vm.messages.map((msg) => (
              <View key={msg.id} style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAgent]}>
                <Text style={styles.chatBubbleText}>{msg.content}</Text>
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
      )}
    </SafeAreaView>
  );
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<AppUserSession>();
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplashVisible(false), 1300);
    return () => clearTimeout(timer);
  }, []);

  if (splashVisible) {
    return <SplashScreen />;
  }

  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

  return <AppInner session={session} onLogout={() => setSession(undefined)} />;
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
  pageBody: { padding: 16, gap: 12, paddingBottom: 32 },
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
  topCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D8FF',
    borderWidth: 1,
    gap: 9,
    shadowColor: '#4D6DB8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTag: { color: '#2E5AB8', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: '#1F2B4A', fontSize: 26, fontWeight: '900' },
  topTitle: { color: '#1F2B4A', fontSize: 22, fontWeight: '900' },
  heroSub: { color: '#61739A', fontSize: 14, lineHeight: 20 },
  topSub: { color: '#61739A', fontSize: 13, lineHeight: 19 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    borderRadius: 999,
    backgroundColor: '#EEF3FF',
    borderColor: '#D2DFFF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: '#355CAF', fontSize: 11, fontWeight: '700' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CEDCFF',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
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
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CADAFE',
    backgroundColor: '#F3F7FF',
    paddingVertical: 10,
  },
  tabBtnActive: { backgroundColor: '#FFF7E8', borderColor: '#E5C47A' },
  tabText: { color: '#5A6E97', fontWeight: '700' },
  tabTextActive: { color: '#9A6A1C' },
  sectionTitle: { color: '#233256', fontSize: 17, fontWeight: '900' },
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
    gap: 6,
    overflow: 'hidden',
  },
  matchRowActive: { borderColor: '#A6C0FF', backgroundColor: '#F2F7FF' },
  matchAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#D4A53A',
  },
  matchTitle: { color: '#21345C', fontSize: 14, fontWeight: '800' },
  matchSub: { color: '#6A7FA8', fontSize: 12 },
  profileText: { color: '#3A4F7D', fontSize: 14, lineHeight: 22 },
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
