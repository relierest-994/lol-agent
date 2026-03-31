import 'react-native-gesture-handler';
import type React from 'react';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { type AppProfileDto } from './src/application';
import { AppInnerShell } from './src/presentation/app-shell/components/app-inner-shell';
import { LoginPage } from './src/presentation/app-shell/components/auth/login-page';
import { ProfileSetupModal } from './src/presentation/app-shell/components/auth/profile-setup-modal';
import { SplashScreen } from './src/presentation/app-shell/components/auth/splash-screen';
import { BusinessFeedbackModal, type BusinessFeedbackState } from './src/presentation/app-shell/components/business-feedback-modal';
import type { AppUserSession } from './src/presentation/app-shell/types';

function PrimaryButton(props: { title: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  return (
    <Pressable style={[styles.primaryBtn, props.disabled ? styles.btnDisabled : undefined]} onPress={props.onPress} disabled={props.disabled}>
      <Text style={styles.primaryBtnText}>{props.title}</Text>
    </Pressable>
  );
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<AppUserSession>();
  const [splashVisible, setSplashVisible] = useState(true);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<BusinessFeedbackState>();

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {splashVisible ? <SplashScreen styles={styles} /> : null}
        {!splashVisible && !session ? (
          <LoginPage onLogin={setSession} onFeedback={setFeedback} styles={styles} renderPrimaryButton={PrimaryButton} />
        ) : null}
        {!splashVisible && session ? (
          <>
            <AppInnerShell session={session} onLogout={() => setSession(undefined)} styles={styles} />
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
              onFeedback={setFeedback}
              styles={styles}
              renderPrimaryButton={PrimaryButton}
            />
          </>
        ) : null}
        <BusinessFeedbackModal
          visible={Boolean(feedback)}
          title={feedback?.title ?? '提示'}
          message={feedback?.message ?? ''}
          onClose={() => setFeedback(undefined)}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 110, marginTop: 8 },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 6, minHeight: 8 },
  chartLabel: { color: '#6A7FA8', fontSize: 11, marginTop: 4 },
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
  mainLayout: { flex: 1 },
  mainPane: { flex: 1 },
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



