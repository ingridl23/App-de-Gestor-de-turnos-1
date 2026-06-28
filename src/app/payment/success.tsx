import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentSuccessScreen() {
  const { status, external_reference } = useLocalSearchParams<{
    status?: string;
    payment_id?: string;
    external_reference?: string;
    merchant_order_id?: string;
  }>();

  const isPending = status === 'pending' || status === 'in_process';

  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center px-6 gap-6">
      <View
        className={`w-20 h-20 rounded-full items-center justify-center ${
          isPending ? 'bg-amber-100' : 'bg-green-100'
        }`}
      >
        <Ionicons
          name={isPending ? 'time' : 'checkmark'}
          size={44}
          color={isPending ? '#f59e0b' : '#22c55e'}
        />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-gray-900">
          {isPending ? 'Pago en proceso' : '¡Pago exitoso!'}
        </Text>
        <Text className="text-gray-500 text-center text-sm leading-relaxed">
          {isPending
            ? 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
            : 'Tu turno fue reservado y el pago fue acreditado correctamente.'}
        </Text>
        {external_reference && (
          <Text className="text-xs text-gray-300">Ref: {external_reference}</Text>
        )}
      </View>

      <View className="w-full gap-3">
        <Pressable
          onPress={() => router.replace('/(client-tabs)')}
          className="bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold text-base">Ver mis turnos</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
