import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';

export default function ClientProfileScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5 pb-2">
        <Text className="text-xl font-bold text-gray-900">Mi perfil</Text>
      </View>

      {/* Info del usuario */}
      <View className="mx-4 mt-4 bg-white rounded-2xl p-4 flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
          <Ionicons name="person" size={24} color="#3b82f6" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {(user?.user_metadata?.full_name as string | undefined) ?? '—'}
          </Text>
          <Text className="text-sm text-gray-500">{user?.email}</Text>
        </View>
      </View>

      {/* Cerrar sesión */}
      <View className="mx-4 mt-4">
        <Pressable
          onPress={signOut}
          className="bg-white border border-red-100 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-red-500 font-medium">Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
