import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { IcoHome, IcoBell, IcoHistory } from '@/components/Icons';

interface TabIconProps {
  focused: boolean;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

function TabIcon({ focused, label, Icon }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Icon
          size={20}
          color={focused ? theme.accent : theme.textDim}
        />
      </View>
      <Text style={[styles.tabLabel, { color: focused ? theme.accent : theme.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: `${theme.surface}f5`,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Início" Icon={IcoHome} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Alertas" Icon={IcoBell} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Histórico" Icon={IcoHistory} />
          ),
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
  pillActive: {
    backgroundColor: theme.accentSoft,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
