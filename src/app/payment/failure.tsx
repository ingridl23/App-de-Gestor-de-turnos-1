import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentFailureScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center px-6 gap-6">
      <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center">
        <Ionicons name="close" size={44} color="#ef4444" />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-gray-900">Pago no completado</Text>
        <Text className="text-gray-500 text-center text-sm leading-relaxed">
          Tu turno fue reservado, pero el pago no se completó.{'\n'}
          Podés abonar en el local o intentar nuevamente.
        </Text>
      </View>

      <View className="w-full gap-3">
        <Pressable
          onPress={() => router.back()}
          className="bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold text-base">Volver e intentar de nuevo</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(client-tabs)')}
          className="border border-gray-200 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-gray-700 font-medium">Ver mis turnos</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
