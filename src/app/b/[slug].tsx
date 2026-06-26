import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import type { Business } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  peluqueria: 'Peluquería',
  barberia: 'Barbería',
};

export default function PublicBusinessProfile() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusiness(data as Business);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [slug]);

  const handleShare = async () => {
    if (!business) return;
    await Share.share({
      message: `Reservá tu turno en ${business.name}: appdegestordeturnos1://b/${business.slug}`,
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (notFound || !business) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-xl font-bold text-gray-900">Negocio no encontrado</Text>
        <Text className="text-gray-500 text-center mt-2">
          El perfil que buscás no existe o fue eliminado.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header con avatar */}
        <View className="items-center pt-10 pb-6 px-6 gap-4">
          {business.avatar_url ? (
            <Image
              source={{ uri: business.avatar_url }}
              className="w-28 h-28 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-28 h-28 rounded-full bg-blue-100 items-center justify-center">
              <Text className="text-5xl">✂️</Text>
            </View>
          )}

          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-gray-900 text-center">
              {business.name}
            </Text>
            {business.category && (
              <View className="bg-blue-50 px-3 py-1 rounded-full">
                <Text className="text-blue-600 text-sm font-medium">
                  {CATEGORY_LABELS[business.category] ?? business.category}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Info */}
        <View className="px-6 gap-4 pb-10">
          {business.description && (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Sobre nosotros
              </Text>
              <Text className="text-gray-700 leading-relaxed">{business.description}</Text>
            </View>
          )}

          {business.address && (
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://maps.google.com/?q=${encodeURIComponent(business.address!)}`
                )
              }
              className="flex-row items-start gap-3 active:opacity-70"
            >
              <Text className="text-xl">📍</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Dirección
                </Text>
                <Text className="text-blue-600 underline">{business.address}</Text>
              </View>
            </Pressable>
          )}

          {business.phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${business.phone}`)}
              className="flex-row items-start gap-3 active:opacity-70"
            >
              <Text className="text-xl">📞</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Teléfono
                </Text>
                <Text className="text-blue-600 underline">{business.phone}</Text>
              </View>
            </Pressable>
          )}

          {/* Compartir */}
          <Pressable
            onPress={handleShare}
            className="border border-gray-200 rounded-xl py-3 items-center mt-2 active:opacity-80"
          >
            <Text className="text-gray-700 font-medium">Compartir perfil</Text>
          </Pressable>

          {/* CTA reserva (próximamente) */}
          <View className="bg-blue-500 rounded-xl py-4 items-center opacity-60">
            <Text className="text-white font-semibold text-base">Reservar turno</Text>
            <Text className="text-blue-100 text-xs mt-1">Próximamente disponible</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
