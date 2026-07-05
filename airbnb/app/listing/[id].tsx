import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import Colors from '@/constants/Colors';
import Animated, {
  SlideInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import { defaultStyles } from '@/constants/Styles';
import {
  getListingById,
  getOrCreateConversationForListing,
  isListingWishlisted,
  Listing,
  toggleWishlist,
} from '@/lib/database/listings';
import { useUser } from '@clerk/clerk-expo';
import ListingReviews from '@/components/ListingReviews';

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 300;

const DetailsPage = () => {
  const { id } = useLocalSearchParams();
  const listingId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useUser();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const navigation = useNavigation();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const shareListing = useCallback(async () => {
    if (!listing) {
      return;
    }

    try {
      await Share.share({
        title: listing.name,
        url: listing.listing_url,
      });
    } catch (err) {
      console.log(err);
    }
  }, [listing]);

  const onToggleWishlist = useCallback(async () => {
    if (!listingId) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before adding homes to your wishlist.');
      return;
    }

    const nextValue = await toggleWishlist(user.id, listingId);
    setIsWishlisted(nextValue);
  }, [listingId, user?.id]);

  const onReserve = useCallback(() => {
    if (!listingId) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before reserving this home.');
      return;
    }

    router.push({
      pathname: '/(modals)/reserve',
      params: {
        listingId,
      },
    });
  }, [listingId, router, user?.id]);

  const onMessageHost = useCallback(async () => {
    if (!listing) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before messaging this host.');
      return;
    }

    try {
      const conversation = await getOrCreateConversationForListing({
        listing,
        guestUserId: user.id,
        guestName: user.fullName ?? user.firstName ?? 'Guest',
      });

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conversation.id,
        },
      });
    } catch (error) {
      Alert.alert('Could not open chat', error instanceof Error ? error.message : 'Try again');
    }
  }, [listing, router, user]);

  useEffect(() => {
    let isMounted = true;

    const loadListing = async () => {
      if (!listingId) {
        setIsLoading(false);
        return;
      }

      const nextListing = await getListingById(listingId);

      if (!isMounted) {
        return;
      }

      setListing(nextListing);
      setIsLoading(false);
    };

    loadListing().catch((error) => {
      console.error('Failed to load listing from SQLite', error);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  useEffect(() => {
    let isMounted = true;

    const loadWishlistState = async () => {
      if (!user?.id || !listingId) {
        setIsWishlisted(false);
        return;
      }

      const nextValue = await isListingWishlisted(user.id, listingId);

      if (isMounted) {
        setIsWishlisted(nextValue);
      }
    };

    loadWishlistState().catch((error) => {
      console.error('Failed to load listing wishlist state', error);
    });

    return () => {
      isMounted = false;
    };
  }, [listingId, user?.id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerTransparent: true,

      headerBackground: () => (
        <Animated.View style={[headerAnimatedStyle, styles.header]}></Animated.View>
      ),
      headerRight: () => (
        <View style={styles.bar}>
          <TouchableOpacity style={styles.roundButton} onPress={shareListing}>
            <Ionicons name="share-outline" size={22} color={'#000'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundButton} onPress={onToggleWishlist}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={22}
              color={isWishlisted ? Colors.primary : '#000'}
            />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => (
        <TouchableOpacity
          style={[styles.roundButton, styles.backButton]}
          onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={'#000'} />
        </TouchableOpacity>
      ),
    });
  }, [isWishlisted, navigation, onToggleWishlist, shareListing]);

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-IMG_HEIGHT, 0, IMG_HEIGHT, IMG_HEIGHT],
            [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollOffset.value, [0, IMG_HEIGHT / 1.5], [0, 1]),
    };
  }, []);

  const galleryImages = useMemo(() => {
    if (!listing) {
      return [];
    }

    const candidates = [
      ...(listing.image_urls ?? []),
      listing.xl_picture_url,
      listing.medium_url,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);

    return [...new Set(candidates)];
  }, [listing]);

  const mainImage = galleryImages[0];
  const latitude = Number(listing?.latitude);
  const longitude = Number(listing?.longitude);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const locationRegion = {
    latitude: hasLocation ? latitude : 0,
    longitude: hasLocation ? longitude : 0,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ fontFamily: 'mon-sb' }}>Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ fontFamily: 'mon-sb' }}>Listing not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        ref={scrollRef}
        scrollEventThrottle={16}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            if (galleryImages.length > 0) {
              setGalleryIndex(0);
              setIsGalleryOpen(true);
            }
          }}>
          {mainImage ? (
            <Animated.Image
              source={{ uri: mainImage }}
              style={[styles.image, imageAnimatedStyle]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={42} color={Colors.grey} />
            </View>
          )}
          {galleryImages.length > 0 && (
            <View style={styles.photoBadge}>
              <Ionicons name="images-outline" size={16} color="#fff" />
              <Text style={styles.photoBadgeText}>
                {galleryImages.length > 1 ? `${galleryImages.length} photos` : 'View photo'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.name}>{listing.name}</Text>
          <Text style={styles.location}>
            {listing.room_type} in {listing.smart_location}
          </Text>
          <Text style={styles.rooms}>
            {listing.guests_included} guests · {listing.bedrooms} bedrooms · {listing.beds} bed ·{' '}
            {listing.bathrooms} bathrooms
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Ionicons name="star" size={16} />
            <Text style={styles.ratings}>
              {listing.review_scores_rating / 20} · {listing.number_of_reviews} reviews
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.hostView}>
            {listing.host_picture_url ? (
              <Image source={{ uri: listing.host_picture_url }} style={styles.host} />
            ) : (
              <View style={[styles.host, styles.hostPlaceholder]}>
                <Ionicons name="person-outline" size={24} color={Colors.grey} />
              </View>
            )}

            <View style={styles.hostInfo}>
              <Text style={{ fontWeight: '500', fontSize: 16 }}>
                Hosted by {listing.host_name ?? listing.owner_email ?? 'Host'}
              </Text>
              <Text>{listing.host_since ? `Host since ${listing.host_since}` : 'New host'}</Text>
            </View>
            <TouchableOpacity style={styles.messageHostButton} onPress={onMessageHost}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />
              <Text style={styles.messageHostText}>Message host</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Where you'll be</Text>
          {hasLocation ? (
            <>
              <View style={styles.mapCard}>
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={locationRegion}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}>
                  <Marker coordinate={{ latitude, longitude }} />
                </MapView>
              </View>
              <Text style={styles.mapAddress}>{listing.smart_location}</Text>
            </>
          ) : (
            <Text style={styles.mapAddress}>Location is not available for this home yet.</Text>
          )}

          <View style={styles.divider} />
          <ListingReviews listingId={listing.id} />
        </View>
      </Animated.ScrollView>

      <Modal
        visible={isGalleryOpen}
        animationType="fade"
        onRequestClose={() => setIsGalleryOpen(false)}>
        <View style={styles.galleryContainer}>
          <TouchableOpacity style={styles.galleryClose} onPress={() => setIsGalleryOpen(false)}>
            <Ionicons name="close-outline" size={30} color="#fff" />
          </TouchableOpacity>
          <FlatList
            data={galleryImages}
            keyExtractor={(item, index) => `${item}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
            renderItem={({ item }) => (
              <View style={[styles.gallerySlide, { width }]}>
                <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="contain" />
              </View>
            )}
          />
          <Text style={styles.galleryCounter}>
            {galleryImages.length > 0 ? `${galleryIndex + 1} / ${galleryImages.length}` : ''}
          </Text>
        </View>
      </Modal>

      <Animated.View style={defaultStyles.footer} entering={SlideInDown.delay(200)}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity style={styles.footerText}>
            <Text style={styles.footerPrice}>€{listing.price}</Text>
            <Text>night</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[defaultStyles.btn, { paddingRight: 20, paddingLeft: 20 }]}
            onPress={onReserve}>
            <Text style={defaultStyles.btnText}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    height: IMG_HEIGHT,
    width: width,
  },
  imagePlaceholder: {
    backgroundColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoBadgeText: {
    fontFamily: 'mon-sb',
    color: '#fff',
    fontSize: 12,
  },
  infoContainer: {
    padding: 24,
    backgroundColor: '#fff',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'mon-sb',
  },
  location: {
    fontSize: 18,
    marginTop: 10,
    fontFamily: 'mon-sb',
  },
  rooms: {
    fontSize: 16,
    color: Colors.grey,
    marginVertical: 4,
    fontFamily: 'mon',
  },
  ratings: {
    fontSize: 16,
    fontFamily: 'mon-sb',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.grey,
    marginVertical: 16,
  },
  host: {
    width: 50,
    height: 50,
    borderRadius: 50,
    backgroundColor: Colors.grey,
  },
  hostPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
  },
  hostView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostInfo: {
    flex: 1,
  },
  messageHostButton: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageHostText: {
    fontFamily: 'mon-sb',
    color: '#fff',
    fontSize: 12,
  },
  footerText: {
    height: '100%',
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerPrice: {
    fontSize: 18,
    fontFamily: 'mon-sb',
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    color: Colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  backButton: {
    marginLeft: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingRight: 8,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  header: {
    backgroundColor: '#fff',
    height: 100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.grey,
  },

  description: {
    fontSize: 16,
    marginTop: 10,
    fontFamily: 'mon',
    lineHeight: 24,
  },
  sectionTitle: {
    fontFamily: 'mon-b',
    fontSize: 22,
    color: Colors.dark,
  },
  mapCard: {
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#eeeeee',
    marginTop: 14,
  },
  mapAddress: {
    fontFamily: 'mon',
    color: Colors.grey,
    marginTop: 10,
    lineHeight: 20,
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  galleryClose: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: '100%',
    height: '82%',
  },
  galleryCounter: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    fontFamily: 'mon-sb',
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
});

export default DetailsPage;
