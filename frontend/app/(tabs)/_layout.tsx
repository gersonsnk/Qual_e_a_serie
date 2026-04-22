import { Tabs } from 'expo-router';
import React from 'react';
import { View, Image, Alert, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUser, setUser } from '@/store/userStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#475569',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
        tabBarIconStyle: { width: 40, height: 40, overflow: 'visible' },
        tabBarStyle: {
          backgroundColor: 'rgba(15,23,42,0.97)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(99,102,241,0.25)',
          height: 88,
          paddingBottom: 18,
          paddingTop: 8,
          elevation: 20,
          shadowColor: '#6366f1',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: 'Continue',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/images/favicon_bkp.png')}
              style={{ width: 35, height: 35, resizeMode: 'contain' }}
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            const { nome, sobrenome } = getUser();
            if (!nome.trim() || !sobrenome.trim()) {
              e.preventDefault(); // Impede a navegação
              Alert.alert(
                "Game não iniciado",
                "Clique em JOGAR AGORA!"
              );
            }
          },
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Config',
          tabBarIcon: () => (
            <Image
              source={require('../../assets/images/config.png')}
              style={{ width: 35, height: 35, resizeMode: 'contain' }}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    backgroundColor: '#1e293b',
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35, // Levanta o botão para fora da barra
    borderWidth: 4,
    borderColor: '#0f172a',
    elevation: 8,
    shadowColor: '#00d2ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
