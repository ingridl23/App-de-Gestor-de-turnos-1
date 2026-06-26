import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import { signInWithGoogle } from '@/lib/googleAuth';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signInWithEmail } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Completá todos los campos.');
      return;
    }
    setLoading(true);
    setError(null);
    const err = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const err = await signInWithGoogle();
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6 gap-4">
        <View className="mb-4">
          <Text className="text-3xl font-bold text-gray-900">TurnosApp</Text>
          <Text className="text-gray-500 mt-1">Iniciá sesión para continuar</Text>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-600 text-sm">{error}</Text>
          </View>
        )}

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
          placeholder="Contraseña"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="bg-blue-500 rounded-xl py-4 items-center active:opacity-80"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Iniciar sesión</Text>
          )}
        </Pressable>

        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="text-gray-400 text-sm">o</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        <Pressable
          onPress={handleGoogle}
          disabled={loading}
          className="border border-gray-200 rounded-xl py-4 items-center active:opacity-80"
        >
          <Text className="text-gray-700 font-medium text-base">
            Continuar con Google
          </Text>
        </Pressable>

        <View className="flex-row justify-center gap-1 mt-2">
          <Text className="text-gray-500">¿No tenés cuenta?</Text>
          <Link href="/(auth)/register">
            <Text className="text-blue-500 font-medium">Registrate</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
