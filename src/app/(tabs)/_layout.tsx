import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useNotificationStore } from '@/store/notificationStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconsName, focused: boolean, color: string) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={color}
    />
  );
}

export default function TabsLayout() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e7eb' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused, color }) => tabIcon('home', focused, color),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Turnos',
          tabBarIcon: ({ focused, color }) => tabIcon('calendar', focused, color),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Servicios',
          tabBarIcon: ({ focused, color }) => tabIcon('cut', focused, color),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Horarios',
          tabBarIcon: ({ focused, color }) => tabIcon('time', focused, color),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ focused, color }) => tabIcon('chatbubbles', focused, color),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ focused, color }) => tabIcon('notifications', focused, color),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      {/* Ocultar pantallas sin tab visible */}
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
