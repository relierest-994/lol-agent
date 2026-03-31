import type React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Region = 'INTERNATIONAL' | 'CN';

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

export function AccountBindModal(props: {
  visible: boolean;
  region: Region;
  riotGameName: string;
  riotTagLine: string;
  linking: boolean;
  onRegionChange: (region: Region) => void;
  onRiotGameNameChange: (value: string) => void;
  onRiotTagLineChange: (value: string) => void;
  onBind: () => void;
  onClose: () => void;
}): React.ReactElement {
  if (!props.visible) return <></>;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalMask}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>绑定游戏账号</Text>
          <Text style={styles.modalDesc}>绑定后才能导入战绩并发起复盘。</Text>

          <View style={styles.row}>
            <GhostButton title="国际服" onPress={() => props.onRegionChange('INTERNATIONAL')} />
            <GhostButton title="国服" onPress={() => props.onRegionChange('CN')} />
          </View>

          {props.region === 'INTERNATIONAL' ? (
            <>
              <TextInput
                style={styles.input}
                value={props.riotGameName}
                onChangeText={props.onRiotGameNameChange}
                placeholder="Riot ID (gameName)"
                placeholderTextColor="#97A5C7"
              />
              <TextInput
                style={styles.input}
                value={props.riotTagLine}
                onChangeText={props.onRiotTagLineChange}
                placeholder="TagLine (例如 KR1)"
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
            <PrimaryButton title={props.linking ? '绑定中...' : '立即绑定'} onPress={props.onBind} disabled={props.linking} />
            <GhostButton title="暂不绑定" onPress={props.onClose} disabled={props.linking} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(9,20,45,0.25)',
    justifyContent: 'center',
    padding: 18,
  },
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
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CEDCFF',
    backgroundColor: '#F8FAFF',
    color: '#1F2B4A',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
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
});
