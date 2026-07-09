import { View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ListingsBottomSheet from '@/components/ListingsBottomSheet';
import ListingsMap from '@/components/ListingsMap';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import ExploreHeader from '@/components/ExploreHeader';
import { getListings, Listing, ListingsGeo, seedDemoListingsForExistingUsers, upsertUser } from '@/lib/database/listings';
import { defaultExploreFilters, ExploreFilters } from '@/lib/exploreFilters';
import { useUser } from '@clerk/clerk-expo';

const emptyListingsGeo: ListingsGeo = {
  type: 'FeatureCollection' as const,
  features: [],
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getListingRating = (listing: Listing) => toNumber(listing.review_scores_rating) / 20;
const asString = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? '');
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const matchesSearchQuery = (listing: Listing, searchQuery: string) => {
  const query = normalize(searchQuery);

  if (!query) {
    return true;
  }

  const searchableText = [
    listing.name,
    listing.smart_location,
    listing.address,
    listing.street,
    listing.city,
    listing.market,
    listing.state,
    listing.country,
    listing.neighbourhood,
    listing.neighborhood,
    listing.neighborhood_overview,
  ].map(normalize).join(' ');

  return query.split(/\s+/).every((token) => searchableText.includes(token));
};

const applyExploreFilters = (listings: Listing[], filters: ExploreFilters, searchQuery: string) => {
  const minPrice = toNumber(filters.minPrice);
  const maxPrice = toNumber(filters.maxPrice);

  const filtered = listings.filter((listing) => {
    const price = toNumber(listing.price);
    const rating = getListingRating(listing);
    const guests = toNumber(listing.guests_included);
    const bedrooms = toNumber(listing.bedrooms);

    if (!matchesSearchQuery(listing, searchQuery)) {
      return false;
    }

    if (filters.minPrice.trim() && price < minPrice) {
      return false;
    }

    if (filters.maxPrice.trim() && price > maxPrice) {
      return false;
    }

    if (filters.minRating > 0 && rating < filters.minRating) {
      return false;
    }

    if (filters.guests > 0 && guests < filters.guests) {
      return false;
    }

    if (filters.bedrooms > 0 && bedrooms < filters.bedrooms) {
      return false;
    }

    return true;
  });

  switch (filters.sort) {
    case 'price-low':
      return [...filtered].sort((a, b) => toNumber(a.price) - toNumber(b.price));
    case 'price-high':
      return [...filtered].sort((a, b) => toNumber(b.price) - toNumber(a.price));
    case 'rating-high':
      return [...filtered].sort((a, b) => getListingRating(b) - getListingRating(a));
    case 'reviews-high':
      return [...filtered].sort((a, b) => toNumber(b.number_of_reviews) - toNumber(a.number_of_reviews));
    case 'recommended':
    default:
      return filtered;
  }
};

const createListingsGeo = (listings: Listing[]): ListingsGeo => ({
  type: 'FeatureCollection',
  features: listings.flatMap((listing) => {
    const latitude = toNumber(listing.latitude);
    const longitude = toNumber(listing.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
      return [];
    }

    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude],
        },
        properties: {
          ...listing,
          latitude,
          longitude,
        },
      },
    ];
  }),
});

const Page = () => {
  const router = useRouter();
  const { user } = useUser();
  const params = useLocalSearchParams<{ search?: string; guests?: string }>();
  const routeSearch = asString(params.search).trim();
  const routeGuests = asString(params.guests);
  const [items, setItems] = useState<Listing[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(defaultExploreFilters);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery(routeSearch);
  }, [routeSearch]);

  useEffect(() => {
    if (routeGuests === '') {
      return;
    }

    const nextGuests = Math.max(0, Number(routeGuests) || 0);
    setFilters((current) => ({ ...current, guests: nextGuests }));
  }, [routeGuests]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadListings = async () => {
        if (user) {
          await upsertUser({
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
            first_name: user.firstName,
            last_name: user.lastName,
            image_url: user.imageUrl,
          });
        }

        await seedDemoListingsForExistingUsers();
        const listings = await getListings('accepted', searchQuery ? null : categoryId);

        if (!isActive) {
          return;
        }

        setItems(listings);
      };

      loadListings().catch((error) => {
        console.error('Failed to load listings from SQLite', error);
      });

      return () => {
        isActive = false;
      };
    }, [categoryId, searchQuery, user])
  );

  const filteredItems = useMemo(
    () => applyExploreFilters(items, filters, searchQuery),
    [filters, items, searchQuery]
  );
  const geoItems = useMemo(
    () => (filteredItems.length > 0 ? createListingsGeo(filteredItems) : emptyListingsGeo),
    [filteredItems]
  );

  const onDataChanged = (nextCategoryId: string | null) => {
    setSearchQuery('');
    router.setParams({ search: undefined, guests: undefined });
    setCategoryId(nextCategoryId);
  };

  const onListingDeleted = (listingId: string) => {
    setItems((current) => current.filter((listing) => listing.id !== listingId));
  };

  return (
    <View style={{ flex: 1, marginTop: 80 }}>
      {/* Define pour custom header */}
      <Stack.Screen
        options={{
          header: () => (
            <ExploreHeader
              activeCategoryId={categoryId}
              filters={filters}
              onCategoryChanged={onDataChanged}
              onFiltersChanged={setFilters}
              searchGuests={filters.guests}
              searchQuery={searchQuery}
            />
          ),
        }}
      />
      <ListingsMap listings={geoItems} />
      <ListingsBottomSheet
        listings={filteredItems}
        category={categoryId ?? 'all'}
        onListingDeleted={onListingDeleted}
      />
    </View>
  );
};

export default Page;
