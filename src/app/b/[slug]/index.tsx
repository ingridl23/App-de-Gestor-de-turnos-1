import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Business, Service } from '@/types';

// ── Constantes ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  peluqueria: 'Peluquería',
  barberia: 'Barbería',
};

const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lunes primero

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BusinessWithData extends Business {
  services: Service[];
  availability: AvailabilitySlot[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function trimTime(t: string) {
  return t.substring(0, 5); // "09:00:00" → "09:00"
}

function buildScheduleByDay(availability: AvailabilitySlot[]) {
  const byDay = new Map<number, string[]>();
  for (const slot of [...availability].sort(
    (a, b) => a.start_time.localeCompare(b.start_time)
  )) {
    const arr = byDay.get(slot.day_of_week) ?? [];
    arr.push(`${trimTime(slot.start_time)} – ${trimTime(slot.end_time)}`);
    byDay.set(slot.day_of_week, arr);
  }
  return byDay;
}

// ── Modal de autenticación ─────────────────────────────────────────────────

function AuthModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        {/* Evitar que el tap en el contenido cierre el modal */}
        <Pressable onPress={() => {}}>
          <View className="bg-white rounded-t-3xl px-6 pt-4 pb-10 gap-5">
            <View className="w-10 h-1 bg-gray-200 rounded-full self-center" />

            <View className="gap-1.5">
              <Text className="text-xl font-bold text-gray-900 text-center">
                ¿Tenés cuenta?
              </Text>
              <Text className="text-sm text-gray-500 text-center">
                Iniciá sesión o registrate para reservar tu turno.
              </Text>
            </View>

            <View className="gap-3">
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/(auth)/login');
                }}
                className="bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Text className="text-white font-semibold text-base">
                  Iniciar sesión
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/(auth)/register');
                }}
                className="border border-gray-200 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Text className="text-gray-700 font-semibold text-base">
                  Crear cuenta
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Pantalla principal ─────────────────────────────────────────────────────

export default function PublicBusinessProfile() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuthStore();

  const [data, setData] = useState<BusinessWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('businesses')
      .select(
        `*, services(id, name, description, duration_minutes, price, is_active),
         availability(day_of_week, start_time, end_time)`
      )
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data: result }) => {
        if (result) {
          setData(result as unknown as BusinessWithData);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [slug]);

  const handleShare = async () => {
    if (!data) return;
    await Share.share({
      message: `Reservá tu turno en ${data.name}: appdegestordeturnos1://b/${data.slug}`,
    });
  };

  const handleReservar = () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    const role = session.user.user_metadata?.role;
    if (role === 'emprendedor') {
      Alert.alert(
        'Cuenta de emprendedor',
        'Para reservar turnos como cliente necesitás iniciar sesión con una cuenta de cliente.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    router.push(`/b/${slug}/book` as never);
  };

  const handleChatear = () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    const role = session.user.user_metadata?.role;
    if (role === 'emprendedor') {
      Alert.alert(
        'Cuenta de emprendedor',
        'Para chatear como cliente necesitás iniciar sesión con una cuenta de cliente.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    router.push(`/b/${slug}/chat` as never);
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (notFound || !data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6 gap-4">
        <Ionicons name="storefront-outline" size={64} color="#d1d5db" />
        <Text className="text-xl font-bold text-gray-900 text-center">
          Negocio no encontrado
        </Text>
        <Text className="text-gray-500 text-center">
          El perfil que buscás no existe o fue eliminado.
        </Text>
      </SafeAreaView>
    );
  }

  const scheduleByDay = buildScheduleByDay(data.availability);
  const activeServices = (data.services ?? []).filter((s) => s.is_active !== false);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View className="bg-white items-center pt-8 pb-6 px-6 gap-4 border-b border-gray-100">
          {data.avatar_url ? (
            <Image
              source={{ uri: data.avatar_url }}
              className="w-24 h-24 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center">
              <Ionicons name="storefront" size={38} color="#3b82f6" />
            </View>
          )}

          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-gray-900 text-center">
              {data.name}
            </Text>
            {data.category ? (
              <View className="bg-blue-50 px-3 py-1 rounded-full">
                <Text className="text-blue-600 text-sm font-medium">
                  {CATEGORY_LABELS[data.category] ?? data.category}
                </Text>
              </View>
            ) : null}
            {data.description ? (
              <Text className="text-gray-500 text-center text-sm leading-relaxed mt-1">
                {data.description}
              </Text>
            ) : null}
          </View>

          {/* Contacto rápido */}
          {(data.address || data.phone) && (
            <View className="flex-row gap-2 w-full">
              {data.address && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://maps.google.com/?q=${encodeURIComponent(data.address!)}`
                    )
                  }
                  className="flex-1 flex-row items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 active:opacity-70"
                >
                  <Ionicons name="location-outline" size={15} color="#6b7280" />
                  <Text className="text-xs text-gray-600 flex-1" numberOfLines={2}>
                    {data.address}
                  </Text>
                </Pressable>
              )}
              {data.phone && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${data.phone}`)}
                  className="flex-row items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 active:opacity-70"
                >
                  <Ionicons name="call-outline" size={15} color="#6b7280" />
                  <Text className="text-xs text-gray-600">{data.phone}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* ── Servicios ───────────────────────────────────────── */}
        {activeServices.length > 0 && (
          <View className="mt-5 px-4 gap-3">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              Servicios y precios
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              {activeServices.map((service, i) => (
                <View key={service.id}>
                  {i > 0 && <View className="h-px bg-gray-100 mx-4" />}
                  <View className="flex-row items-center justify-between px-4 py-4">
                    <View className="flex-1 mr-4">
                      <Text className="text-sm font-semibold text-gray-900">
                        {service.name}
                      </Text>
                      {service.description ? (
                        <Text className="text-xs text-gray-400 mt-0.5">
                          {service.description}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center gap-1 mt-1">
                        <Ionicons name="time-outline" size={12} color="#9ca3af" />
                        <Text className="text-xs text-gray-400">
                          {service.duration_minutes} min
                        </Text>
                      </View>
                    </View>
                    <Text className="text-base font-bold text-blue-500">
                      ${service.price.toFixed(0)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Horarios ────────────────────────────────────────── */}
        <View className="mt-5 px-4 gap-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            Horarios de atención
          </Text>
          <View className="bg-white rounded-2xl px-4 py-1">
            {DAYS_ORDER.map((dayNum, i) => {
              const slots = scheduleByDay.get(dayNum);
              const isOpen = slots && slots.length > 0;
              const isLast = i === DAYS_ORDER.length - 1;
              return (
                <View key={dayNum}>
                  <View className="flex-row items-center justify-between py-3.5">
                    <Text
                      className={`text-sm font-medium w-28 ${
                        isOpen ? 'text-gray-800' : 'text-gray-400'
                      }`}
                    >
                      {DAY_LABELS[dayNum]}
                    </Text>
                    {isOpen ? (
                      <Text className="text-sm text-gray-600 flex-1 text-right">
                        {slots.join('  ·  ')}
                      </Text>
                    ) : (
                      <Text className="text-sm text-red-400">Cerrado</Text>
                    )}
                  </View>
                  {!isLast && <View className="h-px bg-gray-100" />}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Compartir ───────────────────────────────────────── */}
        <View className="mt-5 px-4">
          <Pressable
            onPress={handleShare}
            className="flex-row items-center justify-center gap-2 border border-gray-200 bg-white rounded-2xl py-3 active:opacity-80"
          >
            <Ionicons name="share-outline" size={17} color="#6b7280" />
            <Text className="text-gray-600 font-medium text-sm">Compartir perfil</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── CTA sticky ──────────────────────────────────────────── */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-6 flex-row gap-2">
        <Pressable
          onPress={handleChatear}
          className="flex-1 border border-gray-200 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-gray-700 font-semibold text-base">Chatear</Text>
        </Pressable>
        <Pressable
          onPress={handleReservar}
          className="flex-1 bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold text-base">Reservar turno</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
