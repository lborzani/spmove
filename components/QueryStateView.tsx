import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';

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
  const { rt } = useRuntimeTheme();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={rt.accent} />
        <Text style={[styles.loadingText, { color: rt.textDim }]}>{loadingText}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorTitle, { color: rt.text }]}>{errorTitle}</Text>
        <Text style={[styles.errorBody, { color: rt.textDim }]}>{errorBody}</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: rt.accent }]} onPress={onRetry}>
          <Text style={[styles.retryText, { color: rt.onAccent }]}>TENTAR NOVAMENTE</Text>
        </Pressable>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: rt.textDim }]}>{emptyText}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { fontSize: 13, marginTop: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  errorBody: { fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radiusCard,
  },
  retryText: { fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
