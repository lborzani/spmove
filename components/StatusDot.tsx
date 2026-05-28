import React from 'react';
import { View } from 'react-native';
import { STATUS_META, type StatusType } from '@/constants/theme';

interface Props {
  status: StatusType;
  size?: number;
  glow?: boolean;
}

export function StatusDot({ status, size = 10 }: Props) {
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: meta.color,
        flexShrink: 0,
      }}
    />
  );
}
