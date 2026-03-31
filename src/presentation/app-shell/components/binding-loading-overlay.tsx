import type React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

export function BindingLoadingOverlay(props: { visible: boolean }): React.ReactElement {
  if (!props.visible) return <></>;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={styles.loadingMask}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#2F5FDB" />
          <Text style={styles.loadingText}>账号绑定中，请稍候...</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingMask: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,22,44,0.22)',
  },
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
});
