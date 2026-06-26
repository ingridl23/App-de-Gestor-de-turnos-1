import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { uploadBusinessAvatar } from '@/lib/storage';
import { generateSlug, slugWithSuffix } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';
import type { Business, BusinessCategory } from '@/types';

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'peluqueria', label: 'Peluquería' },
  { value: 'barberia', label: 'Barbería' },
];

export default function BusinessProfileScreen() {
  const { session } = useAuthStore();
  const { setBusiness } = useBusinessStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('peluqueria');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = name ? generateSlug(name) : 'tu-negocio';

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('El nombre del negocio es obligatorio.');
      return;
    }
    if (!session) return;

    setLoading(true);
    setError(null);

    // Subir foto si hay una seleccionada
    let avatarUrl: string | undefined;
    if (avatarUri) {
      const url = await uploadBusinessAvatar(session.user.id, avatarUri);
      if (url) avatarUrl = url;
    }

    // Intentar insertar con slug único
    let baseSlug = generateSlug(name.trim());
    let finalSlug = baseSlug;
    let attempt = 0;

    while (attempt < 5) {
      const slug = attempt === 0 ? baseSlug : slugWithSuffix(baseSlug, attempt);

      const { data, error: insertError } = await supabase
        .from('businesses')
        .insert({
          owner_id: session.user.id,
          name: name.trim(),
          category,
          slug,
          description: description.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          avatar_url: avatarUrl ?? null,
        })
        .select()
        .single();

      if (!insertError && data) {
        setBusiness(data as Business);
        return; // useProtectedRoute redirige a (tabs) automáticamente
      }

      // Código de violación de constraint unique en Postgres
      if (insertError?.code === '23505') {
        attempt++;
        continue;
      }

      setError(insertError?.message ?? 'Error al guardar. Intentá de nuevo.');
      setLoading(false);
      return;
    }

    setError('No se pudo generar un nombre único. Probá con otro nombre.');
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-2">
            <Text className="text-2xl font-bold text-gray-900">Configurá tu negocio</Text>
            <Text className="text-gray-500 mt-1">
              Tus clientes van a ver esta información al reservar un turno.
            </Text>
          </View>

          {/* Avatar picker */}
          <View className="items-center">
            <Pressable
              onPress={handlePickImage}
              className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center overflow-hidden"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="w-24 h-24" resizeMode="cover" />
              ) : (
                <View className="items-center gap-1">
                  <Text className="text-3xl">📷</Text>
                  <Text className="text-xs text-gray-400">Foto</Text>
                </View>
              )}
            </Pressable>
            <Text className="text-xs text-gray-400 mt-2">Tocá para agregar una foto</Text>
          </View>

          {/* Nombre */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">Nombre del negocio *</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="Ej: Barbería El Maestro"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Rubro */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">Rubro</Text>
            <View className="flex-row gap-3">
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  className={`flex-1 py-3 rounded-xl border items-center ${
                    category === cat.value
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Text
                    className={`font-medium text-sm ${
                      category === cat.value ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Descripción */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">Descripción</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="Contá un poco sobre tu negocio, especialidades, etc."
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          {/* Dirección */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">Dirección</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="Av. Corrientes 1234, Buenos Aires"
              placeholderTextColor="#9ca3af"
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Teléfono */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">Teléfono</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
              placeholder="+54 11 1234-5678"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* URL pública (preview) */}
          <View className="bg-blue-50 rounded-xl p-4 gap-1">
            <Text className="text-xs font-medium text-blue-600 uppercase tracking-wide">
              Tu URL pública
            </Text>
            <Text className="text-sm text-blue-800 font-mono">
              appdegestordeturnos1://b/{previewSlug}
            </Text>
            <Text className="text-xs text-blue-500 mt-1">
              Compartí este link con tus clientes para que puedan encontrarte.
            </Text>
          </View>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          {/* Botón guardar */}
          <Pressable
            onPress={handleSave}
            disabled={loading}
            className="bg-blue-500 rounded-xl py-4 items-center active:opacity-80"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Guardar y continuar
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
