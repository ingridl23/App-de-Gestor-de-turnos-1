import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBusinessStore } from '@/store/businessStore';
import { useServiceStore } from '@/store/serviceStore';
import type { Service } from '@/types';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-AR')}`;
}

function ServiceCard({
  service,
  onToggle,
  onEdit,
  onDelete,
}: {
  service: Service;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-white border border-gray-100 rounded-2xl p-4 gap-3 shadow-sm">
      {/* Row 1: nombre + switch */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`text-base font-semibold ${service.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
            {service.name}
          </Text>
          {service.description ? (
            <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
              {service.description}
            </Text>
          ) : null}
        </View>
        <Switch
          value={service.is_active}
          onValueChange={onToggle}
          trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
          thumbColor={service.is_active ? '#3b82f6' : '#d1d5db'}
        />
      </View>

      {/* Row 2: duración + precio + acciones */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text className="text-sm text-gray-500">{formatDuration(service.duration_minutes)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="cash-outline" size={14} color="#6b7280" />
            <Text className="text-sm text-gray-500">{formatPrice(service.price)}</Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <Pressable onPress={onEdit} hitSlop={8} className="active:opacity-60">
            <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} className="active:opacity-60">
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center">
        <Ionicons name="cut-outline" size={32} color="#3b82f6" />
      </View>
      <Text className="text-lg font-semibold text-gray-900 text-center">
        Aún no tenés servicios
      </Text>
      <Text className="text-gray-500 text-center text-sm">
        Creá tus servicios para que los clientes puedan reservar turnos.
      </Text>
      <Pressable
        onPress={onAdd}
        className="bg-blue-500 rounded-xl px-6 py-3 active:opacity-80"
      >
        <Text className="text-white font-semibold">Crear primer servicio</Text>
      </Pressable>
    </View>
  );
}

export default function ServicesScreen() {
  const { business } = useBusinessStore();
  const { services, isLoadingServices, fetchServices, toggleActive, deleteService } =
    useServiceStore();

  useFocusEffect(
    useCallback(() => {
      if (business?.id) fetchServices(business.id);
    }, [business?.id])
  );

  const activeCount = services.filter((s) => s.is_active).length;

  const handleToggle = async (service: Service, isActive: boolean) => {
    const err = await toggleActive(service.id, isActive);
    if (err) Alert.alert('Error', err);
  };

  const handleDelete = (service: Service) => {
    Alert.alert(
      'Eliminar servicio',
      `¿Eliminás "${service.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const err = await deleteService(service.id);
            if (err) Alert.alert('No se puede eliminar', err);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      {/* Sub-header con contador y botón agregar */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-sm text-gray-500">
          {activeCount} de 30 activos
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/services/new')}
          className="flex-row items-center gap-1 bg-blue-500 px-3 py-1.5 rounded-lg active:opacity-80"
          disabled={activeCount >= 30}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white text-sm font-medium">Nuevo</Text>
        </Pressable>
      </View>

      {isLoadingServices ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Cargando servicios...</Text>
        </View>
      ) : services.length === 0 ? (
        <EmptyState onAdd={() => router.push('/(tabs)/services/new')} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              onToggle={(isActive) => handleToggle(item, isActive)}
              onEdit={() => router.push(`/(tabs)/services/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
