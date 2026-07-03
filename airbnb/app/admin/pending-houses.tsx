import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import { getPendingListings, Listing, updateListingStatus } from '@/lib/database/listings';
import { useIsAdmin } from '@/lib/admin';

export default function PendingHousesPage() {
  const { isAdmin } = useIsAdmin();
  const [items, setItems] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPending = useCallback(async () => {
    setIsLoading(true);

    try {
      setItems(await getPendingListings());
    } catch (error) {
      Alert.alert('Could not load pending houses', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPending();
    }, [loadPending])
  );

  const onSetStatus = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await updateListingStatus(id, status);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      Alert.alert('Could not update house', error instanceof Error ? error.message : 'Try again');
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Admin access only</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={isLoading}
      onRefresh={loadPending}
      ListHeaderComponent={<Text style={styles.count}>{items.length} pending houses</Text>}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No pending houses</Text>
            <Text style={styles.emptyText}>New submissions will appear here.</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const imageUrl = item.image_urls?.[0] ?? item.medium_url;

        return (
          <View style={styles.card}>
            <Link href={`/listing/${item.id}`} asChild>
              <TouchableOpacity activeOpacity={0.88}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.emptyImage]}>
                    <Ionicons name="image-outline" size={34} color={Colors.grey} />
                  </View>
                )}
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </TouchableOpacity>
            </Link>

            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.name}
                </Text>
                <Text style={styles.price}>EUR {item.price ?? 0}</Text>
              </View>

              <Text style={styles.meta}>
                {item.room_type ?? 'Home'}
                {item.category_title ? ` - ${item.category_title}` : ''}
              </Text>
              <Text style={styles.meta}>{item.smart_location}</Text>
              <Text style={styles.meta}>Owner: {item.owner_email ?? 'Unknown'}</Text>
              <Text numberOfLines={3} style={styles.description}>
                {item.description}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => onSetStatus(item.id, 'accepted')}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.actionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => onSetStatus(item.id, 'rejected')}>
                  <Ionicons name="close" size={24} color="#fff" />
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  count: {
    textAlign: 'center',
    fontFamily: 'mon-sb',
    fontSize: 16,
    color: Colors.dark,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  image: {
    width: '100%',
    height: 300,
  },
  emptyImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
  },
  pendingBadge: {
    position: 'absolute',
    left: 14,
    top: 14,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pendingBadgeText: {
    fontFamily: 'mon-sb',
    color: '#fff',
    fontSize: 12,
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  meta: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  price: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  description: {
    fontFamily: 'mon',
    lineHeight: 20,
    color: Colors.dark,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#0a7f39',
  },
  rejectButton: {
    backgroundColor: '#b42318',
  },
  actionText: {
    fontFamily: 'mon-b',
    color: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    marginTop: 6,
  },
});
