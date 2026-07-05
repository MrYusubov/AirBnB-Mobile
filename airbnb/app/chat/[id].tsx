import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import {
  Conversation,
  getConversationById,
  getMessagesForConversation,
  Message,
  sendMessage,
} from '@/lib/database/listings';

const formatMessageTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ChatPage = () => {
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const otherName = user?.id === conversation?.host_user_id
    ? conversation?.guest_name ?? 'Guest'
    : conversation?.host_name ?? 'Host';

  const loadChat = useCallback(async () => {
    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    const [nextConversation, nextMessages] = await Promise.all([
      getConversationById(conversationId),
      getMessagesForConversation(conversationId),
    ]);

    setConversation(nextConversation);
    setMessages(nextMessages);
    setIsLoading(false);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const load = async () => {
        if (!isActive) {
          return;
        }

        await loadChat();
      };

      load().catch((error) => {
        console.error('Failed to load chat', error);
        setIsLoading(false);
      });

      const intervalId = setInterval(() => {
        load().catch((error) => {
          console.error('Failed to refresh chat', error);
        });
      }, 1000);

      return () => {
        isActive = false;
        clearInterval(intervalId);
      };
    }, [loadChat])
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages.length]);

  const onSend = async () => {
    if (!user?.id || !conversationId || isSending) {
      return;
    }

    if (!text.trim()) {
      return;
    }

    setIsSending(true);

    try {
      await sendMessage({
        conversationId,
        senderUserId: user.id,
        body: text,
      });
      setText('');
      await loadChat();
    } catch (error) {
      Alert.alert('Could not send message', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_user_id === user?.id;

    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMine && styles.myMessageText]}>{item.body}</Text>
          <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const canAccess = Boolean(
    user?.id &&
      conversation &&
      (conversation.guest_user_id === user.id || conversation.host_user_id === user.id)
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centerTitle}>Loading chat...</Text>
      </View>
    );
  }

  if (!conversation || !canAccess) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Chat' }} />
        <Text style={styles.centerTitle}>Conversation not found</Text>
        <Text style={styles.centerText}>This chat is not available for your account.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <Stack.Screen options={{ title: otherName }} />
      <View style={styles.headerCard}>
        <View style={styles.hostAvatar}>
          <Text style={styles.hostAvatarText}>{otherName.charAt(0)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherName}</Text>
          <Text numberOfLines={1} style={styles.headerListing}>
            {conversation.listing_name}
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={messages.length === 0 ? styles.emptyMessages : styles.messagesContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={34} color={Colors.primary} />
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyText}>Ask about availability, rules or anything you need before booking.</Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a message..."
          placeholderTextColor={Colors.grey}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || isSending) && styles.sendButtonDisabled]}
          disabled={!text.trim() || isSending}
          onPress={onSend}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  centerTitle: {
    fontFamily: 'mon-b',
    fontSize: 20,
    color: Colors.dark,
  },
  centerText: {
    fontFamily: 'mon',
    color: Colors.grey,
    textAlign: 'center',
  },
  headerCard: {
    margin: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e4e4e4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    fontFamily: 'mon-b',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontFamily: 'mon-b',
    color: Colors.dark,
    fontSize: 16,
  },
  headerListing: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  messagesContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 20,
  },
  emptyMessages: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'mon-b',
    color: Colors.dark,
    fontSize: 18,
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageRow: {
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: '#f1f1f1',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontFamily: 'mon',
    color: Colors.dark,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontFamily: 'mon',
    fontSize: 11,
    color: Colors.grey,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontFamily: 'mon',
    color: Colors.dark,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

export default ChatPage;
