import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  loadingText: string;
  errorTitle?: string;
  errorBody?: string;
  emptyText?: string;
  onRetry: () => void;
}

export function QueryStateView({
  isLoading,
  isError,
  isEmpty = false,
  loadingText,
  errorTitle = 'Sem conexão',
  errorBody = 'Verifique sua internet.',
  emptyText = 'Sem dados.',
  onRetry,
}: Props) {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{errorTitle}</Text>
        <Text style={styles.errorBody}>{errorBody}</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>TENTAR NOVAMENTE</Text>
        </Pressable>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { color: theme.textDim, fontSize: 13, marginTop: 8 },
  errorTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  errorBody: { color: theme.textDim, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.accent,
    borderRadius: theme.radiusCard,
  },
  retryText: { color: theme.onAccent, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  emptyText: { color: theme.textDim, fontSize: 13, textAlign: 'center' },
});
