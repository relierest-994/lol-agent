import type React from 'react';
import { useEffect, useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { setupProfileUseCase, type AppProfileDto } from '../../../../application';

export function ProfileSetupModal(props: {
  visible: boolean;
  currentProfile?: AppProfileDto;
  onDone: (profile: AppProfileDto) => void;
  onFeedback: (payload: { title: string; message: string }) => void;
  styles: Record<string, any>;
  renderPrimaryButton: (input: { title: string; onPress: () => void; disabled?: boolean }) => React.ReactElement;
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
      props.onFeedback({ title: '提示', message: '请先填写昵称' });
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
      props.onFeedback({ title: '保存失败', message: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={props.styles.modalMask}>
        <View style={props.styles.modalCard}>
          <Text style={props.styles.modalTitle}>完善资料</Text>
          <Text style={props.styles.modalDesc}>首次登录请设置昵称，头像可选，不填将使用默认头像。</Text>

          <TextInput
            style={props.styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="请输入昵称"
            placeholderTextColor="#97A5C7"
          />
          <TextInput
            style={props.styles.input}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="头像 URL（可选）"
            placeholderTextColor="#97A5C7"
          />

          {props.renderPrimaryButton({ title: saving ? '保存中...' : '保存并继续', onPress: () => void submit(), disabled: saving })}
        </View>
      </View>
    </Modal>
  );
}

