import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_META, type StatusType } from '@/constants/theme';

interface Props {
  status: StatusType;
  big?: boolean;
}

export function StatusPill({ status, big = false }: Props) {
  const meta = STATUS_META[status];
  return (
    <View style={[
      styles.pill,
      {
        paddingHorizontal: big ? 12 : 9,
        paddingVertical: big ? 6 : 4,
        backgroundColor: `${meta.color}33`,
        gap: 5,
      },
    ]}>
      <View style={[
        styles.dot,
        { backgroundColor: meta.color },
      ]} />
      <Text style={[
        styles.label,
        {
          color: meta.color,
          fontSize: big ? 13 : 11,
        },
      ]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
