import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';

export default function HomeScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-2xl font-bold text-gray-900">¡Bienvenido!</Text>
        <Text className="text-gray-500">{user?.email}</Text>
        <Pressable
          onPress={signOut}
          className="mt-4 border border-gray-200 rounded-xl px-6 py-3 active:opacity-80"
        >
          <Text className="text-gray-700 font-medium">Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
