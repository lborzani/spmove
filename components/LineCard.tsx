import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme, STATUS_META } from '@/constants/theme';
import { LineBadge } from './LineBadge';
import { StatusPill } from './StatusPill';
import type { Line } from '@/constants/data';

interface Props {
  line: Line;
  onPress: () => void;
}

// Bold vibe: linha list item com barra colorida de status à esquerda.
export function LineCard({ line, onPress }: Props) {
  const meta = STATUS_META[line.status];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}
    >
      {/* faixa de status à esquerda */}
      <View style={[styles.statusStrip, { backgroundColor: meta.color }]} />

      <LineBadge line={line} size={40} />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{line.name}</Text>
          <Text style={styles.netLabel}>{line.net}</Text>
        </View>
        <Text style={styles.note} numberOfLines={1}>{line.note}</Text>
      </View>

      <StatusPill status={line.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    overflow: 'hidden',
  },
  statusStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  name: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  netLabel: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  note: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 1,
  },
});
