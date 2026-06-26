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
import { Link } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cliente');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUpWithEmail } = useAuthStore();

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError('Completá todos los campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    const err = await signUpWithEmail(email.trim(), password, fullName.trim(), role);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6 gap-4">
        <Text className="text-2xl font-bold text-gray-900 text-center">
          ¡Revisá tu email!
        </Text>
        <Text className="text-gray-500 text-center">
          Te enviamos un link de confirmación. Verificá tu casilla y luego iniciá
          sesión.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable className="bg-blue-500 rounded-xl py-4 px-8 mt-2 active:opacity-80">
            <Text className="text-white font-semibold text-base">Ir a iniciar sesión</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4">
          <Text className="text-3xl font-bold text-gray-900">Crear cuenta</Text>
          <Text className="text-gray-500 mt-1">¿Cómo querés usar TurnosApp?</Text>
        </View>

        {/* Selector de rol */}
        <View className="flex-row gap-3">
          {(['cliente', 'emprendedor'] as UserRole[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              className={`flex-1 py-3 rounded-xl border items-center ${
                role === r ? 'bg-blue-500 border-blue-500' : 'border-gray-200 bg-white'
              }`}
            >
              <Text
                className={`font-medium text-sm ${
                  role === r ? 'text-white' : 'text-gray-700'
                }`}
              >
                {r === 'cliente' ? 'Soy cliente' : 'Soy emprendedor'}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-600 text-sm">{error}</Text>
          </View>
        )}

        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
          placeholder="Nombre completo"
          placeholderTextColor="#9ca3af"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          autoCapitalize="words"
        />

        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-base"
          placeholder="Contraseña (mín. 6 caracteres)"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          className="bg-blue-500 rounded-xl py-4 items-center active:opacity-80 mt-2"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Crear cuenta</Text>
          )}
        </Pressable>

        <View className="flex-row justify-center gap-1">
          <Text className="text-gray-500">¿Ya tenés cuenta?</Text>
          <Link href="/(auth)/login">
            <Text className="text-blue-500 font-medium">Iniciá sesión</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
