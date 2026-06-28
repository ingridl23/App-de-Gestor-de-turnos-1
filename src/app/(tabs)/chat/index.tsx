import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface UserRef {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface RawMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  sender: UserRef | null;
  receiver: UserRef | null;
}

interface ConversationPreview {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function groupConversations(
  messages: RawMessage[],
  myId: string
): ConversationPreview[] {
  const map = new Map<string, ConversationPreview>();

  for (const m of messages) {
    const isFromMe = m.sender_id === myId;
    const otherId = isFromMe ? m.receiver_id : m.sender_id;
    const other = isFromMe ? m.receiver : m.sender;

    if (!map.has(otherId)) {
      map.set(otherId, {
        userId: otherId,
        name: other?.full_name ?? 'Cliente',
        avatarUrl: other?.avatar_url ?? null,
        lastMessage: m.content,
        lastAt: m.created_at,
        unreadCount: !isFromMe && !m.read_at ? 1 : 0,
      });
    } else if (!isFromMe && !m.read_at) {
      map.get(otherId)!.unreadCount++;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.lastAt.localeCompare(a.lastAt)
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export default function ChatListScreen() {
  const { user } = useAuthStore();
  const { business } = useBusinessStore();

  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!business || !user) return;

    const { data } = await supabase
      .from('messages')
      .select(
        `id, sender_id, receiver_id, content, created_at, read_at,
         sender:users!sender_id(id, full_name, avatar_url),
         receiver:users!receiver_id(id, full_name, avatar_url)`
      )
      .eq('business_id', business.id)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) {
      setConversations(groupConversations(data as unknown as RawMessage[], user.id));
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [business?.id, user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime: nueva actividad en cualquier chat del negocio
  useEffect(() => {
    if (!business) return;
    const channel = supabase
      .channel(`chat-list:${business.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `business_id=eq.${business.id}`,
        },
        () => { fetchConversations(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [business?.id, fetchConversations]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5 pb-3">
        <Text className="text-xl font-bold text-gray-900">Mensajes</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchConversations(); }}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
      >
        {conversations.length === 0 ? (
          <View className="items-center justify-center pt-20 gap-4 px-8">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center">
              <Ionicons name="chatbubbles-outline" size={28} color="#d1d5db" />
            </View>
            <Text className="text-gray-400 text-sm text-center leading-relaxed">
              Todavía no tenés mensajes de clientes.{'\n'}
              Aparecerán acá cuando alguien te escriba desde tu perfil.
            </Text>
          </View>
        ) : (
          conversations.map((conv, i) => (
            <View key={conv.userId}>
              {i > 0 && <View className="h-px bg-gray-100 mx-4" />}
              <Pressable
                onPress={() =>
                  router.push(`/(tabs)/chat/${conv.userId}` as never)
                }
                className="flex-row items-center px-4 py-3.5 gap-3 active:opacity-80 bg-white"
              >
                {conv.avatarUrl ? (
                  <Image
                    source={{ uri: conv.avatarUrl }}
                    className="w-11 h-11 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center">
                    <Ionicons name="person" size={20} color="#3b82f6" />
                  </View>
                )}

                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-gray-900">
                    {conv.name}
                  </Text>
                  <Text className="text-xs text-gray-400" numberOfLines={1}>
                    {conv.lastMessage}
                  </Text>
                </View>

                <View className="items-end gap-1">
                  <Text className="text-xs text-gray-400">
                    {formatRelative(conv.lastAt)}
                  </Text>
                  {conv.unreadCount > 0 && (
                    <View className="bg-blue-500 rounded-full min-w-5 h-5 items-center justify-center px-1.5">
                      <Text className="text-white text-xs font-bold">
                        {conv.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
