import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMPOAuthURL } from '@/lib/mercadopago';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';
import type { Payment, PaymentMode } from '@/types';

const N8N_OAUTH_URL = process.env.EXPO_PUBLIC_N8N_OAUTH_URL ?? '';

interface PaymentWithDetails extends Payment {
  appointments: {
    starts_at: string;
    client_name: string | null;
    appointment_services: Array<{ services: { name: string } | null }>;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-600 bg-amber-50',
  approved: 'text-green-600 bg-green-50',
  rejected: 'text-red-600 bg-red-50',
  refunded: 'text-gray-500 bg-gray-100',
  cancelled: 'text-gray-400 bg-gray-50',
};

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const { business, fetchBusiness } = useBusinessStore();

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('none');
  const [señaPercent, setSeñaPercent] = useState('30');
  const [savingConfig, setSavingConfig] = useState(false);

  const [connecting, setConnecting] = useState(false);

  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Sync local state from business
  useEffect(() => {
    if (!business) return;
    setPaymentMode(business.payment_mode);
    setSeñaPercent(String(business.seña_percent));
  }, [business?.id]);

  useEffect(() => {
    if (!business) return;
    setLoadingPayments(true);
    supabase
      .from('payments')
      .select(
        'id, appointment_id, mp_payment_id, mp_preference_id, amount, status, payer_email, created_at, updated_at, appointments(starts_at, client_name, appointment_services(services(name)))'
      )
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setPayments((data ?? []) as PaymentWithDetails[]);
        setLoadingPayments(false);
      });
  }, [business?.id]);

  // ── Conectar MercadoPago ────────────────────────────────────────────────

  async function handleConnect() {
    if (!business) return;
    setConnecting(true);
    try {
      const oauthUrl = getMPOAuthURL(business.id);
      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        'appdegestordeturnos1://mp-oauth/callback'
      );

      if (result.type !== 'success') return;

      const parsed = Linking.parse(result.url);
      const code = parsed.queryParams?.code as string | undefined;
      const state = parsed.queryParams?.state as string | undefined;

      if (!code || !state) {
        Alert.alert('Error', 'No se recibió el código de autorización de MercadoPago.');
        return;
      }

      if (!N8N_OAUTH_URL) {
        Alert.alert('Configuración incompleta', 'EXPO_PUBLIC_N8N_OAUTH_URL no está configurada.');
        return;
      }

      await fetch(N8N_OAUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          business_id: state,
          redirect_uri: 'appdegestordeturnos1://mp-oauth/callback',
        }),
      });

      // Refresh business after a brief delay for n8n to save the token
      await new Promise((r) => setTimeout(r, 1500));
      if (user) await fetchBusiness(user.id);
    } catch {
      Alert.alert('Error', 'No se pudo completar la conexión con MercadoPago.');
    } finally {
      setConnecting(false);
    }
  }

  // ── Guardar configuración ───────────────────────────────────────────────

  async function handleSaveConfig() {
    if (!business || !user) return;
    const pct = parseInt(señaPercent, 10);
    if (isNaN(pct) || pct < 10 || pct > 100) {
      Alert.alert('Valor inválido', 'El porcentaje de seña debe ser entre 10 y 100.');
      return;
    }
    setSavingConfig(true);
    const { error } = await supabase
      .from('businesses')
      .update({ payment_mode: paymentMode, seña_percent: pct })
      .eq('id', business.id);
    setSavingConfig(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    } else {
      await fetchBusiness(user.id);
      Alert.alert('Guardado', 'La configuración de cobros fue actualizada.');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-1 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>
        <Text className="text-base font-semibold text-gray-900 flex-1">Cobros</Text>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-4 mb-4">
            {/* Conexión MP */}
            <View className="bg-white rounded-2xl p-4 gap-4">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-sky-50 items-center justify-center">
                  <Ionicons name="card" size={20} color="#0ea5e9" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">MercadoPago</Text>
                  <Text className="text-xs text-gray-400">
                    {business?.mp_user_id ? `Conectado · ID ${business.mp_user_id}` : 'No conectado'}
                  </Text>
                </View>
                {business?.mp_user_id ? (
                  <View className="flex-row items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full">
                    <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <Text className="text-xs font-medium text-green-600">Activo</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleConnect}
                    disabled={connecting}
                    className="bg-sky-500 px-4 py-2 rounded-xl active:opacity-80"
                  >
                    {connecting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white text-xs font-semibold">Conectar</Text>
                    )}
                  </Pressable>
                )}
              </View>

              {!business?.mp_user_id && (
                <View className="bg-sky-50 rounded-xl px-3 py-2.5">
                  <Text className="text-xs text-sky-700 leading-relaxed">
                    Conectá tu cuenta de MercadoPago para cobrar señas o el servicio completo al momento de reservar.
                  </Text>
                </View>
              )}
            </View>

            {/* Modo de cobro */}
            {business?.mp_user_id && (
              <View className="bg-white rounded-2xl p-4 gap-4">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Modo de cobro
                </Text>

                {([ ['none', 'Sin cobro digital', 'El cliente paga en el local'],
                    ['seña', 'Seña al reservar', 'El cliente paga un porcentaje'],
                    ['full', 'Cobro completo', 'El cliente paga el total'] ] as const).map(
                  ([mode, label, desc]) => (
                    <Pressable
                      key={mode}
                      onPress={() => setPaymentMode(mode)}
                      className="flex-row items-center gap-3 active:opacity-80"
                    >
                      <View
                        className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                          paymentMode === mode
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {paymentMode === mode && (
                          <View className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-800">{label}</Text>
                        <Text className="text-xs text-gray-400">{desc}</Text>
                      </View>
                    </Pressable>
                  )
                )}

                {paymentMode === 'seña' && (
                  <View className="flex-row items-center gap-3 ml-8">
                    <Text className="text-sm text-gray-600">Porcentaje de seña:</Text>
                    <TextInput
                      value={señaPercent}
                      onChangeText={(t) => setSeñaPercent(t.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      maxLength={3}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 w-16 text-center text-sm text-gray-900"
                    />
                    <Text className="text-sm text-gray-400">%</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleSaveConfig}
                  disabled={savingConfig}
                  className={`rounded-xl py-3 items-center ${savingConfig ? 'bg-blue-300' : 'bg-blue-500 active:opacity-80'}`}
                >
                  {savingConfig ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">Guardar configuración</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* Título lista pagos */}
            {payments.length > 0 && (
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Últimos cobros
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loadingPayments ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#3b82f6" />
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-8 items-center gap-2">
              <Ionicons name="card-outline" size={32} color="#d1d5db" />
              <Text className="text-gray-400 text-sm text-center">
                Aún no hay cobros registrados.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const serviceNames = (item.appointments?.appointment_services ?? [])
            .map((s) => s.services?.name)
            .filter(Boolean)
            .join(', ') || 'Turno';
          const date = item.appointments?.starts_at
            ? new Date(item.appointments.starts_at).toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: '2-digit',
              })
            : '—';

          return (
            <View className="bg-white rounded-2xl px-4 py-3.5 mb-2 flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">
                  {item.appointments?.client_name ?? 'Cliente'}
                </Text>
                <Text className="text-xs text-gray-400">{serviceNames} · {date}</Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-sm font-bold text-gray-900">
                  ${Number(item.amount).toLocaleString('es-AR')}
                </Text>
                <View className={`px-2 py-0.5 rounded-full ${STATUS_COLOR[item.status] ?? ''}`}>
                  <Text className={`text-xs font-medium ${STATUS_COLOR[item.status]?.split(' ')[0] ?? 'text-gray-500'}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
