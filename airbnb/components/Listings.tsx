import { Alert, GestureResponderEvent, View, Text, StyleSheet, ListRenderItem, TouchableOpacity } from 'react-native';
import { defaultStyles } from '@/constants/Styles';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheetFlatList, BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { deleteListing, getWishlistListingIds, Listing, toggleWishlist } from '@/lib/database/listings';
import { useIsAdmin } from '@/lib/admin';

interface Props {
  listings: Listing[];
  refresh: number;
  category: string;
  onListingDeleted?: (listingId: string) => void;
}

const Listings = ({ listings: items, refresh, category, onListingDeleted }: Props) => {
  const listRef = useRef<BottomSheetFlatListMethods>(null);
  const { user } = useUser();
  const { isAdmin } = useIsAdmin();
  const [loading, setLoading] = useState<boolean>(false);
  const [wishlistedIds, setWishlistedIds] = useState<string[]>([]);

  // Update the view to scroll the list back top
  useEffect(() => {
    if (refresh) {
      scrollListTop();
    }
  }, [refresh]);

  const scrollListTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Use for "updating" the views data after category changed
  useEffect(() => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    }, 200);
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadWishlist = async () => {
        if (!user?.id) {
          setWishlistedIds([]);
          return;
        }

        const nextIds = await getWishlistListingIds(user.id);

        if (isActive) {
          setWishlistedIds(nextIds);
        }
      };

      loadWishlist().catch((error) => {
        console.error('Failed to load wishlist ids', error);
      });

      return () => {
        isActive = false;
      };
    }, [user?.id])
  );

  const onToggleWishlist = async (event: GestureResponderEvent, listingId: string) => {
    event.stopPropagation();

    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before adding homes to your wishlist.');
      return;
    }

    const nextValue = await toggleWishlist(user.id, listingId);

    setWishlistedIds((current) =>
      nextValue ? [...new Set([...current, listingId])] : current.filter((id) => id !== listingId)
    );
  };

  const onDeleteListing = (event: GestureResponderEvent, listing: Listing) => {
    event.stopPropagation();

    Alert.alert('Delete house', `Delete "${listing.name}" from the app?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteListing(listing.id);
            onListingDeleted?.(listing.id);
          } catch (error) {
            Alert.alert('Could not delete house', error instanceof Error ? error.message : 'Try again');
          }
        },
      },
    ]);
  };

  // Render one listing row for the FlatList
  const renderRow: ListRenderItem<Listing> = ({ item }) => {
    const isWishlisted = wishlistedIds.includes(item.id);

    return (
    <Link href={`/listing/${item.id}`} asChild>
      <TouchableOpacity>
        <Animated.View style={styles.listing} entering={FadeInRight} exiting={FadeOutLeft}>
          <Animated.Image source={{ uri: item.medium_url }} style={styles.image} />
          <TouchableOpacity
            style={styles.heartButton}
            onPress={(event) => onToggleWishlist(event, item.id)}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={24}
              color={isWishlisted ? Colors.primary : '#000'}
            />
          </TouchableOpacity>
          {isAdmin ? (
            <TouchableOpacity
              style={styles.adminDeleteButton}
              onPress={(event) => onDeleteListing(event, item)}>
              <Ionicons name="trash-outline" size={22} color="#b42318" />
            </TouchableOpacity>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontFamily: 'mon-sb' }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Ionicons name="star" size={16} />
              <Text style={{ fontFamily: 'mon-sb' }}>{item.review_scores_rating / 20}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'mon' }}>{item.room_type}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Text style={{ fontFamily: 'mon-sb' }}>{`$${item.price}`}</Text>
            <Text style={{ fontFamily: 'mon' }}>night</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Link>
    );
  };

  return (
    <View style={defaultStyles.container}>
      <BottomSheetFlatList
        renderItem={renderRow}
        data={loading ? [] : items}
        ref={listRef}
        ListHeaderComponent={<Text style={styles.info}>{items.length} homes</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listing: {
    padding: 16,
    gap: 10,
    marginVertical: 16,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },
  heartButton: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDeleteButton: {
    position: 'absolute',
    left: 30,
    top: 30,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    textAlign: 'center',
    fontFamily: 'mon-sb',
    fontSize: 16,
    marginTop: 4,
  },
});

export default Listings;
