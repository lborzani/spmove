import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme, STATUS_META } from '@/constants/theme';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import { LineBadge } from './LineBadge';
import { StatusPill } from './StatusPill';
import { IcoHeart } from './Icons';
import type { Line } from '@/constants/data';

interface Props {
  line: Line;
  onPress: () => void;
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
  reportCount?: number;
}

export function LineCard({
  line,
  onPress,
  isFavorited = false,
  onFavoriteToggle,
  reportCount = 0,
}: Props) {
  const { rt } = useRuntimeTheme();
  const meta = STATUS_META[line.status];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: rt.surface, borderColor: rt.border, opacity: pressed ? 0.75 : 1 },
      ]}>
      <View style={[styles.statusStrip, { backgroundColor: meta.color }]} />
      <LineBadge line={line} size={40} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: rt.text }]}>{line.name}</Text>
          <Text style={[styles.netLabel, { color: rt.textFaint }]}>{line.net}</Text>
        </View>
        <View style={styles.noteRow}>
          <Text style={[styles.note, { color: rt.textDim }]} numberOfLines={1}>
            {line.note}
          </Text>
          {reportCount > 0 && (
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeText}>
                {reportCount} relato{reportCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
      <StatusPill status={line.status} />
      {onFavoriteToggle && (
        <Pressable onPress={onFavoriteToggle} hitSlop={8} style={styles.heartBtn}>
          <IcoHeart
            size={18}
            color={isFavorited ? '#ef4444' : rt.textFaint}
            filled={isFavorited}
            strokeWidth={2}
          />
        </Pressable>
      )}
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
    borderWidth: 1,
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
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  note: { fontSize: 12, flexShrink: 1 },
  reportBadge: {
    backgroundColor: '#f59e0b22',
    borderWidth: 1,
    borderColor: '#f59e0b55',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  reportBadgeText: { color: '#f59e0b', fontSize: 9, fontWeight: '700' },
  heartBtn: {
    padding: 4,
  },
});
