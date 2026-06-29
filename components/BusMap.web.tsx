import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import type { SPStop, SPVehicle, MetroStation, MetroLineData } from '@/constants/sptransTypes';

interface BusMapProps {
  userCoords?: { lat: number; lon: number } | null;
  spStops?: SPStop[];
  vehicles?: SPVehicle[];
  routeCoords?: [number, number][] | null;
  routeColor?: string | null;
  fitRoute?: boolean;
  allRoutes?: { coords: [number, number][]; color?: string }[] | null;
  selectedStopId?: number | null;
  metroStations?: MetroStation[];
  metroLines?: MetroLineData[];
  centerOn?: { lat: number; lon: number; zoom?: number } | null;
  onSpStopPress?: (stop: SPStop) => void;
  onLinePress?: (lineCode: string) => void;
  onMetroLinePress?: (lineId: string) => void;
  onNoRoute?: () => void;
  onMapPress?: () => void;
}

export function BusMap(_props: BusMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Mapa disponível apenas no app mobile</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  text: {
    color: theme.textDim,
    fontSize: 14,
  },
});
