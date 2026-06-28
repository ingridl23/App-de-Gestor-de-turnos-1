import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  business_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface ChatViewProps {
  businessId: string;
  myId: string;
  otherId: string;
  otherName: string;
  otherAvatarUrl?: string | null;
  onBack?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Burbuja de mensaje ─────────────────────────────────────────────────────

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const isRead = message.read_at !== null;
  return (
    <View className={`flex-row mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
          isMine
            ? 'bg-blue-500 rounded-tr-sm'
            : 'bg-white rounded-tl-sm'
        }`}
      >
        <Text
          className={`text-sm leading-relaxed ${
            isMine ? 'text-white' : 'text-gray-900'
          }`}
        >
          {message.content}
        </Text>
        <View className={`flex-row items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
          <Text className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
            {formatTime(message.created_at)}
          </Text>
          {isMine && (
            <Ionicons
              name={isRead ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={isRead ? '#93c5fd' : '#bfdbfe'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function ChatView({
  businessId,
  myId,
  otherId,
  otherName,
  otherAvatarUrl,
  onBack,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Carga inicial ─────────────────────────────────────────────────────

  useEffect(() => {
    loadMessages();
    markAsRead();
    const unsub = subscribeRealtime();
    return unsub;
  }, [businessId, myId, otherId]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('business_id', businessId)
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},receiver_id.eq.${myId})`
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setMessages(data as Message[]);
    setIsLoading(false);
  }

  // ── Realtime ──────────────────────────────────────────────────────────

  function subscribeRealtime() {
    const channel = supabase
      .channel(`chat:${businessId}:${[myId, otherId].sort().join(':')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          const isThisConversation =
            (msg.sender_id === myId && msg.receiver_id === otherId) ||
            (msg.sender_id === otherId && msg.receiver_id === myId);
          if (!isThisConversation) return;
          setMessages((prev) => [msg, ...prev]);
          if (msg.sender_id === otherId) markAsRead();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  // ── Marcar como leído ─────────────────────────────────────────────────

  async function markAsRead() {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('sender_id', otherId)
      .eq('receiver_id', myId)
      .is('read_at', null);
  }

  // ── Enviar ────────────────────────────────────────────────────────────

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setSending(true);
    await supabase.from('messages').insert({
      business_id: businessId,
      sender_id: myId,
      receiver_id: otherId,
      content,
    });
    setSending(false);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <SafeAreaView edges={['top']} className="bg-white border-b border-gray-100">
        <View className="flex-row items-center px-4 py-3 gap-3">
          <Pressable
            onPress={onBack ?? (() => router.back())}
            className="p-1 active:opacity-70"
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </Pressable>

          {otherAvatarUrl ? (
            <Image
              source={{ uri: otherAvatarUrl }}
              className="w-9 h-9 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center">
              <Ionicons name="person" size={18} color="#3b82f6" />
            </View>
          )}

          <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
            {otherName}
          </Text>
        </View>
      </SafeAreaView>

      {/* Mensajes */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isMine={item.sender_id === myId} />
          )}
          inverted
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 gap-3">
              <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 text-sm text-center leading-relaxed">
                Todavía no hay mensajes.{'\n'}¡Enviá el primero!
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-100">
        <View className="flex-row items-end px-3 py-2 gap-2">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Escribí un mensaje..."
            placeholderTextColor="#9ca3af"
            multiline
            className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-900"
            style={{ maxHeight: 96 }}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              text.trim() ? 'bg-blue-500 active:opacity-80' : 'bg-gray-100'
            }`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Ionicons
                name="send"
                size={17}
                color={text.trim() ? 'white' : '#9ca3af'}
              />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
