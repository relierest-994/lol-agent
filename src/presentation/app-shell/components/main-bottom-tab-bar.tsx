import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MainTab = 'HOME' | 'HEROES' | 'DATA_CENTER' | 'MINE';

export function MainBottomTabBar(props: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}): React.ReactElement {
  return (
    <View style={styles.bottomTabs}>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('HOME')} hitSlop={8}>
        <Text style={[styles.bottomTabText, props.activeTab === 'HOME' ? styles.bottomTabTextActive : undefined]}>首页</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('HEROES')} hitSlop={8}>
        <Text style={[styles.bottomTabText, props.activeTab === 'HEROES' ? styles.bottomTabTextActive : undefined]}>英雄</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('DATA_CENTER')} hitSlop={8}>
        <Text style={[styles.bottomTabText, props.activeTab === 'DATA_CENTER' ? styles.bottomTabTextActive : undefined]}>数据中心</Text>
      </Pressable>
      <Pressable style={styles.bottomTabItem} onPress={() => props.onChange('MINE')} hitSlop={8}>
        <Text style={[styles.bottomTabText, props.activeTab === 'MINE' ? styles.bottomTabTextActive : undefined]}>我的</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabs: {
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
});
