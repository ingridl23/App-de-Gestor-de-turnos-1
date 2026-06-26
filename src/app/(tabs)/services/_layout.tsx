import { Stack } from 'expo-router';

export default function ServicesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#111827',
        headerShadowVisible: false,
        headerBackTitle: 'Volver',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mis Servicios' }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo Servicio' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar Servicio' }} />
    </Stack>
  );
}
