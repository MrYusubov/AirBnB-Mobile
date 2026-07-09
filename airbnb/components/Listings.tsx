import { Alert, GestureResponderEvent, View, Text, StyleSheet, ListRenderItem, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [wishlistedIds, setWishlistedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  // Update the view to scroll the list back top
  useEffect(() => {
    if (refresh) {
      scrollListTop();
    }
  }, [refresh]);

  const scrollListTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  useEffect(() => {
    setVisibleCount(10);
    requestAnimationFrame(scrollListTop);
  }, [category, items]);

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
    <BottomSheetFlatList
      key={`${category}-${items.length}`}
      ref={listRef}
      data={visibleItems}
      renderItem={renderRow}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Text style={styles.info}>
          {items.length === 0 ? 'No homes found' : `Showing ${visibleItems.length} of ${items.length} homes`}
        </Text>
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.showMoreButton}
            onPress={() => setVisibleCount((current) => Math.min(current + 10, items.length))}>
            <Text style={styles.showMoreText}>Show more</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.dark} />
          </TouchableOpacity>
        ) : (
          <View style={styles.footerSpacer} />
        )
      }
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    backgroundColor: '#FDFFFF',
    paddingBottom: 120,
  },
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
  showMoreButton: {
    alignSelf: 'center',
    minWidth: 150,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  showMoreText: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
    fontSize: 15,
  },
  footerSpacer: {
    height: 24,
  },
});

export default Listings;
