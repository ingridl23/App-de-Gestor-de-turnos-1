import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';

export default function ClientHomeScreen() {
  const { user } = useAuthStore();
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    'cliente';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5 pb-2">
        <Text className="text-2xl font-bold text-gray-900">Hola, {firstName}</Text>
        <Text className="text-gray-500 mt-1 text-sm">
          Tus próximos turnos aparecerán acá.
        </Text>
      </View>

      <View className="flex-1 items-center justify-center gap-4 px-8">
        <View className="w-20 h-20 rounded-full bg-blue-50 items-center justify-center">
          <Ionicons name="calendar-outline" size={40} color="#93c5fd" />
        </View>
        <Text className="text-gray-400 text-sm text-center leading-relaxed">
          Todavía no tenés turnos reservados.{'\n'}
          Usá el link de tu peluquero/a para reservar.
        </Text>
      </View>
    </SafeAreaView>
  );
}
