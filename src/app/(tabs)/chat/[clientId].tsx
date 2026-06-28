import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatView } from '@/components/ChatView';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';

interface ClientProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function EntrepreneurChatScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { user } = useAuthStore();
  const { business } = useBusinessStore();

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        setClient(data as ClientProfile | null);
        setLoading(false);
      });
  }, [clientId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (!business || !user || !client) return null;

  return (
    <View className="flex-1">
      <ChatView
        businessId={business.id}
        myId={user.id}
        otherId={client.id}
        otherName={client.full_name}
        otherAvatarUrl={client.avatar_url}
        onBack={() => router.back()}
      />
    </View>
  );
}
