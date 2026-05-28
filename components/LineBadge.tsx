import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Line } from '@/constants/data';

interface Props {
  line: Line;
  size?: number;
}

export function LineBadge({ line, size = 40 }: Props) {
  const radius = Math.min(10, size * 0.28);
  const fontSize = size * 0.42;

  return (
    <View style={[
      styles.badge,
      {
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: line.color,
      },
    ]}>
      <Text style={[styles.num, { fontSize }]}>{line.num}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  num: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: undefined,
  },
});
