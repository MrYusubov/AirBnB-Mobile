import { useCallback, useState } from 'react';
import {
  FlatList,
  GestureResponderEvent,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { getWishlistListings, Listing, removeFromWishlist } from '@/lib/database/listings';

const WishlistPage = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [items, setItems] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWishlist = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextItems = await getWishlistListings(user.id);
    setItems(nextItems);
    setIsLoading(false);
  }, [isLoaded, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      loadWishlist().catch((error) => {
        if (isActive) {
          console.error('Failed to load wishlist listings', error);
          setIsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [loadWishlist])
  );

  const onRemove = async (event: GestureResponderEvent, listingId: string) => {
    event.stopPropagation();

    if (!user?.id) {
      return;
    }

    await removeFromWishlist(user.id, listingId);
    setItems((current) => current.filter((item) => item.id !== listingId));
  };

  const renderItem = ({ item }: { item: Listing }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => router.push(`/listing/${item.id}`)}>
      <Image source={{ uri: item.medium_url ?? item.xl_picture_url }} style={styles.image} />
      <TouchableOpacity style={styles.heartButton} onPress={(event) => onRemove(event, item.id)}>
        <Ionicons name="heart" size={24} color={Colors.primary} />
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.title}>
            {item.name}
          </Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={15} color={Colors.dark} />
            <Text style={styles.ratingText}>{Number(item.review_scores_rating ?? 0) / 20}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.location}>
          {item.room_type} in {item.smart_location}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>€ {item.price}</Text>
          <Text style={styles.night}>night</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Loading wishlists...</Text>
        </View>
      );
    }

    if (!isSignedIn) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Log in to save homes</Text>
          <Text style={styles.emptyText}>
            Tap the heart on any home and your favorite places will appear here.
          </Text>
          <TouchableOpacity style={[defaultStyles.btn, styles.loginButton]} onPress={() => router.push('/(modals)/login')}>
            <Text style={defaultStyles.btnText}>Log In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!isLoading && items.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>
            Homes you like will stay here so you can find them again quickly.
          </Text>
          <TouchableOpacity style={[defaultStyles.btn, styles.loginButton]} onPress={() => router.push('/')}>
            <Text style={defaultStyles.btnText}>Explore Homes</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.count}>{isLoading ? 'Loading wishlists...' : `${items.length} saved homes`}</Text>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Wishlists' }} />
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  count: {
    textAlign: 'center',
    fontFamily: 'mon-sb',
    fontSize: 16,
    color: Colors.dark,
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e5e5',
  },
  image: {
    width: '100%',
    height: 230,
    backgroundColor: '#eee',
  },
  heartButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontFamily: 'mon-sb',
    fontSize: 16,
    color: Colors.dark,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  location: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  night: {
    fontFamily: 'mon',
    color: Colors.dark,
  },
  empty: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: 'mon-b',
    fontSize: 22,
    color: Colors.dark,
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    width: '100%',
    marginTop: 10,
  },
});

export default WishlistPage;
