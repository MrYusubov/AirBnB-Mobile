import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { Conversation, getConversationsForUser } from '@/lib/database/listings';

const formatTime = (value: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const InboxPage = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [items, setItems] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setItems(await getConversationsForUser(user.id));
    setIsLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const load = async () => {
        if (!isActive) {
          return;
        }

        await loadConversations();
      };

      load().catch((error) => {
        console.error('Failed to load inbox conversations', error);
        setIsLoading(false);
      });

      const intervalId = setInterval(() => {
        load().catch((error) => {
          console.error('Failed to refresh inbox conversations', error);
        });
      }, 2000);

      return () => {
        isActive = false;
        clearInterval(intervalId);
      };
    }, [loadConversations])
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const isHost = user?.id === item.host_user_id;
    const otherName = isHost ? item.guest_name ?? 'Guest' : item.host_name ?? 'Host';
    const roleLabel = isHost ? 'Guest' : 'Host';

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/chat/[id]',
            params: {
              id: item.id,
            },
          })
        }>
        {item.listing_image_url ? (
          <Image source={{ uri: item.listing_image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.emptyImage]}>
            <Ionicons name="home-outline" size={28} color={Colors.grey} />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text numberOfLines={1} style={styles.name}>
              {otherName}
            </Text>
            <Text style={styles.time}>{formatTime(item.last_message_at ?? item.updated_at)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.listing}>
            {roleLabel} - {item.listing_name ?? 'Home'}
          </Text>
          <Text numberOfLines={1} style={styles.message}>
            {item.last_message ?? 'No messages yet. Start the conversation.'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubble-ellipses-outline" size={34} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {!isLoaded || isLoading ? 'Loading inbox...' : isSignedIn ? 'No messages yet' : 'Log in to message hosts'}
      </Text>
      <Text style={styles.emptyText}>
        Message a host from a home detail page and your conversations will appear here.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Inbox' }} />
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.content}
        refreshing={isLoading}
        onRefresh={loadConversations}
        ListHeaderComponent={
          items.length > 0 ? <Text style={styles.count}>{items.length} conversations</Text> : null
        }
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 18,
    gap: 12,
    paddingBottom: 110,
  },
  emptyContent: {
    flexGrow: 1,
  },
  count: {
    textAlign: 'center',
    fontFamily: 'mon-sb',
    color: Colors.dark,
    fontSize: 16,
    marginBottom: 4,
  },
  card: {
    minHeight: 96,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e2e2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#f1f1f1',
  },
  emptyImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontFamily: 'mon-b',
    fontSize: 16,
    color: Colors.dark,
  },
  time: {
    fontFamily: 'mon',
    color: Colors.grey,
    fontSize: 12,
  },
  listing: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
    fontSize: 13,
  },
  message: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  empty: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'mon-b',
    color: Colors.dark,
    fontSize: 22,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default InboxPage;
