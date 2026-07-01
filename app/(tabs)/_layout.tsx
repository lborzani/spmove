import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRuntimeTheme } from '@/context/RuntimeThemeContext';
import { IcoHome, IcoBell, IcoHistory, IcoMap } from '@/components/Icons';

interface TabIconProps {
  focused: boolean;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

function TabIcon({ focused, label, Icon }: TabIconProps) {
  const { rt } = useRuntimeTheme();
  return (
    <View style={styles.tabItem}>
      <View style={[styles.pill, focused && { backgroundColor: rt.accentSoft }]}>
        <Icon size={20} color={focused ? rt.accent : rt.textDim} />
      </View>
      <Text
        style={[styles.tabLabel, { color: focused ? rt.accent : rt.textDim }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { rt } = useRuntimeTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: `${rt.surface}f5`,
          borderTopColor: rt.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Início" Icon={IcoHome} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Alertas" Icon={IcoBell} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Histórico" Icon={IcoHistory} />
          ),
        }}
      />
      <Tabs.Screen
        name="onibus"
        options={{
          href: Platform.OS === 'web' ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Ônibus" Icon={IcoMap} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
    minWidth: 72,
  },
  pill: {
    width: 56,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
