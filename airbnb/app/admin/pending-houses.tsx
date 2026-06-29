import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const onSetStatus = async (id: string, status: 'accepted' | 'rejected') => {
    await updateListingStatus(id, status);
    setItems((current) => current.filter((item) => item.id !== id));
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
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={isLoading}
      onRefresh={loadPending}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No pending houses</Text>
          <Text style={styles.emptyText}>New submissions will appear here.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const imageUrl = item.image_urls?.[0] ?? item.medium_url;

        return (
          <View style={styles.card}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.emptyImage]}>
                <Ionicons name="image-outline" size={34} color={Colors.grey} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>{item.smart_location}</Text>
              <Text style={styles.meta}>Owner: {item.owner_email ?? 'Unknown'}</Text>
              <Text style={styles.price}>€ {item.price ?? 0} night</Text>
              <Text numberOfLines={3} style={styles.description}>
                {item.description}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.iconButton, styles.acceptButton]}
                  onPress={() => onSetStatus(item.id, 'accepted')}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, styles.rejectButton]}
                  onPress={() => onSetStatus(item.id, 'rejected')}>
                  <Ionicons name="close" size={24} color="#fff" />
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
    height: 190,
  },
  emptyImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  meta: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  price: {
    fontFamily: 'mon-sb',
  },
  description: {
    fontFamily: 'mon',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#0a7f39',
  },
  rejectButton: {
    backgroundColor: '#b42318',
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
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    marginTop: 6,
  },
});
