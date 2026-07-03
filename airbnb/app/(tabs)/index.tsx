import { View } from 'react-native';
import React, { useCallback, useState } from 'react';
import ListingsBottomSheet from '@/components/ListingsBottomSheet';
import ListingsMap from '@/components/ListingsMap';
import { Stack, useFocusEffect } from 'expo-router';
import ExploreHeader from '@/components/ExploreHeader';
import { getListings, getListingsGeo, Listing, ListingsGeo } from '@/lib/database/listings';

const emptyListingsGeo: ListingsGeo = {
  type: 'FeatureCollection' as const,
  features: [],
};

const Page = () => {
  const [items, setItems] = useState<Listing[]>([]);
  const [geoItems, setGeoItems] = useState(emptyListingsGeo);
  const [categoryId, setCategoryId] = useState<string>('tiny-homes');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadListings = async () => {
        const [listings, listingsGeo] = await Promise.all([
          getListings('accepted', categoryId),
          getListingsGeo(categoryId),
        ]);

        if (!isActive) {
          return;
        }

        setItems(listings);
        setGeoItems(listingsGeo);
      };

      loadListings().catch((error) => {
        console.error('Failed to load listings from SQLite', error);
      });

      return () => {
        isActive = false;
      };
    }, [categoryId])
  );

  const onDataChanged = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
  };

  return (
    <View style={{ flex: 1, marginTop: 80 }}>
      {/* Define pour custom header */}
      <Stack.Screen
        options={{
          header: () => <ExploreHeader onCategoryChanged={onDataChanged} />,
        }}
      />
      <ListingsMap listings={geoItems} />
      <ListingsBottomSheet listings={items} category={categoryId} />
    </View>
  );
};

export default Page;
