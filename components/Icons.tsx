import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Icon({
  d,
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.7,
}: IconProps & { d: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

export function IcoHome({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoMap({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoBell({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 0 0 4 0"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoHistory({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoArrow({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return <Icon d="M5 12h14M13 6l6 6-6 6" size={size} color={color} strokeWidth={strokeWidth} />;
}

export function IcoArrowLeft({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return <Icon d="M19 12H5M11 6l-6 6 6 6" size={size} color={color} strokeWidth={strokeWidth} />;
}

export function IcoSearch({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm6-2 4 4"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoFilter({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return <Icon d="M3 5h18M6 12h12M10 19h4" size={size} color={color} strokeWidth={strokeWidth} />;
}

export function IcoAlert({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M12 9v4M12 17h.01M10.3 3.9 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoInfo({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M12 16v-5M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoLightning({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon d="M13 2 3 14h8l-1 8 10-12h-8z" size={size} color={color} strokeWidth={strokeWidth} />
  );
}

export function IcoChevronRight({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return <Icon d="M9 6l6 6-6 6" size={size} color={color} strokeWidth={strokeWidth} />;
}

// GPS crosshair — "locate me"
export function IcoLocate({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  );
}

// Bus front — "buscar linhas próximas"
export function IcoBusSearch({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
      <Path d="M1 9h16M7 17v2M11 17v2" />
      <Circle cx="17" cy="17" r="3" />
      <Path d="M19.3 19.3 21 21" />
    </Svg>
  );
}

export function IcoHeart({
  size = 22,
  color = '#f6fff4',
  filled = false,
  strokeWidth = 1.7,
}: IconProps & { filled?: boolean }) {
  const d =
    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

export function IcoPlus({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return <Icon d="M12 5v14M5 12h14" size={size} color={color} strokeWidth={strokeWidth} />;
}

export function IcoCamera({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoThumbUp({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoThumbDown({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3zM17 2h2.3A2 2 0 0 1 21 4v7a2 2 0 0 1-2 2h-2"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoSettings({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM7 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function IcoRefresh({ size = 22, color = '#f6fff4', strokeWidth = 1.7 }: IconProps) {
  return (
    <Icon
      d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}

// 4-pointed sparkle star
export function Sparkle({ size = 22, color = '#4FE566' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 1.5 C 12.6 7.6 16.4 11.4 22.5 12 C 16.4 12.6 12.6 16.4 12 22.5 C 11.4 16.4 7.6 12.6 1.5 12 C 7.6 11.4 11.4 7.6 12 1.5 Z" />
    </Svg>
  );
}

// App logo — same sparkle, standalone
export function IcoLogo({ size = 28, color = '#4FE566' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill={color}>
      <Path d="M16 2 C 16.8 10 21 14.2 30 15 C 21 15.8 16.8 20 16 28 C 15.2 20 11 15.8 2 15 C 11 14.2 15.2 10 16 2 Z" />
    </Svg>
  );
}
