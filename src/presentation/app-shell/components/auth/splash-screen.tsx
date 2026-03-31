import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

const APP_NAME = '电竞私教复盘助手';

export function SplashScreen(props: { styles: Record<string, any> }): React.ReactElement {
  return (
    <SafeAreaView style={props.styles.splashSafe}>
      <StatusBar style="light" />
      <View style={props.styles.splashOrbOuter}>
        <View style={props.styles.splashOrbInner}>
          <Text style={props.styles.splashLogo}>L</Text>
        </View>
      </View>
      <Text style={props.styles.splashTitle}>{APP_NAME}</Text>
      <Text style={props.styles.splashSub}>Agent-First LOL 复盘产品壳层</Text>
    </SafeAreaView>
  );
}

