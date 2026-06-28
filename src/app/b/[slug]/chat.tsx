import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatView } from '@/components/ChatView';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

interface BusinessInfo {
  id: string;
  name: string;
  owner_id: string;
  avatar_url: string | null;
  owner: { full_name: string; avatar_url: string | null } | null;
}

export default function ClientChatScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuthStore();

  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('businesses')
      .select('id, name, owner_id, avatar_url, owner:users!owner_id(full_name, avatar_url)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        setBusiness(data as BusinessInfo | null);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (!business || !session) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-500 text-center">
          No se pudo cargar el chat.
        </Text>
      </SafeAreaView>
    );
  }

  const ownerName =
    (business.owner as { full_name: string } | null)?.full_name ?? business.name;
  const ownerAvatar =
    (business.owner as { avatar_url: string | null } | null)?.avatar_url ??
    business.avatar_url;

  return (
    <View className="flex-1">
      <ChatView
        businessId={business.id}
        myId={session.user.id}
        otherId={business.owner_id}
        otherName={ownerName}
        otherAvatarUrl={ownerAvatar}
        onBack={() => router.back()}
      />
    </View>
  );
}
