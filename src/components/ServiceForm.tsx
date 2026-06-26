import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

export interface ServiceFormValues {
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
}

interface Props {
  initialValues?: Partial<ServiceFormValues>;
  onSubmit: (values: ServiceFormValues) => Promise<string | null>;
  submitLabel: string;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function ServiceForm({ initialValues, onSubmit, submitLabel }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [durationStr, setDurationStr] = useState(
    String(initialValues?.duration_minutes ?? 30)
  );
  const [priceStr, setPriceStr] = useState(
    initialValues?.price != null ? String(initialValues.price) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const duration = parseInt(durationStr, 10);
  const price = parseFloat(priceStr.replace(',', '.'));

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!durationStr || isNaN(duration) || duration <= 0) {
      setError('Ingresá una duración válida en minutos.');
      return;
    }
    if (!priceStr || isNaN(price) || price < 0) {
      setError('Ingresá un precio válido.');
      return;
    }

    setLoading(true);
    setError(null);

    const err = await onSubmit({
      name: name.trim(),
      description: description.trim(),
      duration_minutes: duration,
      price,
    });

    setLoading(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-600 text-sm">{error}</Text>
          </View>
        )}

        {/* Nombre */}
        <View className="gap-1">
          <Text className="text-sm font-medium text-gray-700">Nombre *</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="Ej: Corte de pelo"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
          />
        </View>

        {/* Descripción */}
        <View className="gap-1">
          <Text className="text-sm font-medium text-gray-700">Descripción</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="Opcional: detalles del servicio"
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            style={{ minHeight: 60 }}
          />
        </View>

        {/* Duración */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-700">Duración *</Text>
            {!isNaN(duration) && duration > 0 && (
              <Text className="text-sm text-blue-500">{formatDuration(duration)}</Text>
            )}
          </View>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
            placeholder="Minutos (ej: 30)"
            placeholderTextColor="#9ca3af"
            value={durationStr}
            onChangeText={setDurationStr}
            keyboardType="numeric"
          />
          {/* Presets rápidos */}
          <View className="flex-row flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setDurationStr(String(preset))}
                className={`px-3 py-1.5 rounded-lg border ${
                  durationStr === String(preset)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    durationStr === String(preset) ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {formatDuration(preset)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Precio */}
        <View className="gap-1">
          <Text className="text-sm font-medium text-gray-700">Precio (ARS) *</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl px-4 overflow-hidden">
            <Text className="text-gray-400 text-base mr-2">$</Text>
            <TextInput
              className="flex-1 py-3 text-gray-900 text-base"
              placeholder="0"
              placeholderTextColor="#9ca3af"
              value={priceStr}
              onChangeText={setPriceStr}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Botón */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="bg-blue-500 rounded-xl py-4 items-center active:opacity-80 mt-2"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">{submitLabel}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
