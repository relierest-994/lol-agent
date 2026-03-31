import type React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface BusinessFeedbackState {
  title: string;
  message: string;
}

export function BusinessFeedbackModal(props: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}): React.ReactElement {
  return (
    <Modal visible={props.visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.message}>{props.message}</Text>
          <Pressable style={styles.button} onPress={props.onClose}>
            <Text style={styles.buttonText}>我知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(9,20,45,0.3)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C8D9FF',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  title: { color: '#233256', fontSize: 17, fontWeight: '900' },
  message: { color: '#495F8D', fontSize: 14, lineHeight: 20 },
  button: {
    alignSelf: 'flex-end',
    backgroundColor: '#2F5FDB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
