import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { NotificationPrefs } from '@/types';

const DEFAULT_PREFS: NotificationPrefs = {
  nueva_reserva: true,
  cancelacion: true,
  nuevo_mensaje: true,
  recordatorio_push: true,
  recordatorio_whatsapp: true,
};

export default function ClientProfileScreen() {
  const { user, signOut } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [phoneDirty, setPhoneDirty] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  // ── Carga inicial ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('phone, notification_prefs')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPhone((data.phone as string | null) ?? '');
          setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Partial<NotificationPrefs>) });
        }
        setLoadingPrefs(false);
      });
  }, [user?.id]);

  // ── Guardar teléfono ─────────────────────────────────────────────────

  async function savePhone() {
    if (!user || !phoneDirty) return;
    setSavingPhone(true);
    const { error } = await supabase
      .from('users')
      .update({ phone: phone.trim() || null })
      .eq('id', user.id);
    setSavingPhone(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el teléfono.');
    } else {
      setPhoneDirty(false);
    }
  }

  // ── Actualizar preferencia ────────────────────────────────────────────

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    if (!user) return;
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await supabase
      .from('users')
      .update({ notification_prefs: newPrefs })
      .eq('id', user.id);
  }

  // ── Render ────────────────────────────────────────────────────────────

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text className="text-xl font-bold text-gray-900 mb-5">Mi perfil</Text>

        {/* Info del usuario */}
        <View className="bg-white rounded-2xl p-4 flex-row items-center gap-4 mb-4">
          <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
            <Ionicons name="person" size={24} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{fullName}</Text>
            <Text className="text-sm text-gray-400">{user?.email}</Text>
          </View>
        </View>

        {/* Teléfono */}
        <View className="bg-white rounded-2xl px-4 py-3 mb-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Teléfono para WhatsApp
          </Text>
          <View className="flex-row items-center gap-2">
            <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t); setPhoneDirty(true); }}
              onBlur={savePhone}
              placeholder="+54 9 11 1234-5678"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              className="flex-1 text-sm text-gray-900 py-1"
            />
            {savingPhone && <ActivityIndicator size="small" color="#3b82f6" />}
            {phoneDirty && !savingPhone && (
              <Pressable onPress={savePhone} className="active:opacity-70">
                <Text className="text-blue-500 text-sm font-medium">Guardar</Text>
              </Pressable>
            )}
          </View>
          <Text className="text-xs text-gray-400 mt-2">
            Necesario para recibir recordatorios por WhatsApp. Incluí el código de país.
          </Text>
        </View>

        {/* Preferencias de notificación */}
        <View className="bg-white rounded-2xl overflow-hidden mb-4">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Recordatorios
            </Text>
          </View>

          {loadingPrefs ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#3b82f6" />
            </View>
          ) : (
            <>
              <PrefRow
                icon="notifications-outline"
                label="Push (1 hora antes)"
                value={prefs.recordatorio_push}
                onToggle={(v) => togglePref('recordatorio_push', v)}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <PrefRow
                icon="logo-whatsapp"
                iconColor="#22c55e"
                label="WhatsApp (24 horas antes)"
                value={prefs.recordatorio_whatsapp}
                onToggle={(v) => togglePref('recordatorio_whatsapp', v)}
                note={!phone ? 'Agregá tu teléfono para activar' : undefined}
                disabled={!phone}
              />
              <View className="h-px bg-gray-100 mx-4" />
              <PrefRow
                icon="chatbubble-outline"
                label="Nuevos mensajes"
                value={prefs.nuevo_mensaje}
                onToggle={(v) => togglePref('nuevo_mensaje', v)}
              />
            </>
          )}
        </View>

        {/* Cerrar sesión */}
        <Pressable
          onPress={signOut}
          className="bg-white border border-red-100 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-red-500 font-medium">Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Fila de preferencia ────────────────────────────────────────────────────

function PrefRow({
  icon,
  iconColor = '#6b7280',
  label,
  value,
  onToggle,
  note,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center px-4 py-3.5 gap-3">
      <Ionicons name={icon} size={18} color={disabled ? '#d1d5db' : iconColor} />
      <View className="flex-1">
        <Text className={`text-sm font-medium ${disabled ? 'text-gray-300' : 'text-gray-800'}`}>
          {label}
        </Text>
        {note && (
          <Text className="text-xs text-gray-400 mt-0.5">{note}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
        thumbColor={value ? '#3b82f6' : '#f9fafb'}
      />
    </View>
  );
}
