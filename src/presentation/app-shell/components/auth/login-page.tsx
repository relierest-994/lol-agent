import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { useState } from 'react';
import { SafeAreaView, Text, TextInput, View } from 'react-native';
import { loginWithCodeUseCase, sendLoginCodeUseCase } from '../../../../application';
import type { AppUserSession } from '../../types';

const APP_NAME = '电竞私教复盘助手';

export function LoginPage(props: {
  onLogin: (session: AppUserSession) => void;
  onFeedback: (payload: { title: string; message: string }) => void;
  styles: Record<string, any>;
  renderPrimaryButton: (input: { title: string; onPress: () => void; disabled?: boolean }) => React.ReactElement;
}): React.ReactElement {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [codeHint, setCodeHint] = useState<string>();

  async function sendCode(): Promise<void> {
    if (!phone.trim()) {
      props.onFeedback({ title: '提示', message: '请输入手机号' });
      return;
    }
    setSendingCode(true);
    try {
      const response = await sendLoginCodeUseCase({ phone: phone.trim() });
      setCodeHint(response.mockCodeHint);
      props.onFeedback({ title: '验证码已发送', message: `当前为 mock 验证码：${response.mockCodeHint}` });
    } catch (error) {
      props.onFeedback({ title: '发送失败', message: error instanceof Error ? error.message : '验证码发送失败' });
    } finally {
      setSendingCode(false);
    }
  }

  async function login(): Promise<void> {
    if (!phone.trim() || !code.trim()) {
      props.onFeedback({ title: '提示', message: '请输入手机号和验证码' });
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
      props.onFeedback({ title: '登录失败', message: error instanceof Error ? error.message : '登录失败' });
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <SafeAreaView style={props.styles.safe}>
      <StatusBar style="dark" />
      <View style={props.styles.bgDecorTop} pointerEvents="none" />
      <View style={props.styles.bgDecorBottom} pointerEvents="none" />

      <View style={props.styles.loginHero}>
        <Text style={props.styles.heroTag}>{APP_NAME}</Text>
        <Text style={props.styles.heroTitle}>手机号登录</Text>
        <Text style={props.styles.heroSub}>未注册手机号将自动注册并登录。首次登录后需要补充昵称。</Text>
      </View>

      <View style={props.styles.card}>
        <Text style={props.styles.fieldLabel}>手机号</Text>
        <TextInput
          style={props.styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          placeholderTextColor="#97A5C7"
        />
        <View style={props.styles.row}>
          <View style={props.styles.codeInputWrap}>
            <Text style={props.styles.fieldLabel}>验证码</Text>
            <TextInput
              style={props.styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="请输入验证码"
              placeholderTextColor="#97A5C7"
            />
          </View>
          {props.renderPrimaryButton({ title: sendingCode ? '发送中...' : '发送验证码', onPress: () => void sendCode(), disabled: sendingCode })}
        </View>

        {codeHint ? <Text style={props.styles.captionText}>当前 mock 验证码：{codeHint}</Text> : null}

        {props.renderPrimaryButton({ title: loggingIn ? '登录中...' : '登录并进入', onPress: () => void login(), disabled: loggingIn })}
      </View>
    </SafeAreaView>
  );
}

