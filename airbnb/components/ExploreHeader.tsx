import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type View as ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { Category, getCategories } from '@/lib/database/listings';
import {
  defaultExploreFilters,
  ExploreFilters,
  getActiveFilterCount,
  sortOptions,
} from '@/lib/exploreFilters';

interface Props {
  onCategoryChanged: (categoryId: string) => void;
  filters: ExploreFilters;
  onFiltersChanged: (filters: ExploreFilters) => void;
  searchGuests: number;
  searchQuery: string;
}

const ratingOptions = [
  { label: 'Any', value: 0 },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
];
const guestOptions = [0, 1, 2, 4, 6];
const bedroomOptions = [0, 1, 2, 3, 4];
const onlyDigits = (value: string) => value.replace(/\D/g, '');

const ExploreHeader = ({
  onCategoryChanged,
  filters,
  onFiltersChanged,
  searchGuests,
  searchQuery,
}: Props) => {
  const scrollRef = useRef<ScrollView>(null);
  const itemsRef = useRef<Array<ViewInstance | null>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ExploreFilters>(filters);
  const activeFilterCount = getActiveFilterCount(filters);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const searchSubtitle = hasSearchQuery
    ? searchGuests > 0
      ? `${searchGuests}+ guests`
      : 'Search results'
    : 'Anywhere - Homes and places';

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      const nextCategories = await getCategories();

      if (isMounted) {
        setCategories(nextCategories);
      }
    };

    loadCategories().catch((error) => {
      console.error('Failed to load categories from SQLite', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectCategory = (index: number) => {
    const category = categories[index];

    if (!category) {
      return;
    }

    const selected = itemsRef.current[index];
    setActiveIndex(index);
    selected?.measure((x) => {
      scrollRef.current?.scrollTo({ x: x - 16, y: 0, animated: true });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChanged(category.id);
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setIsFilterVisible(true);
  };

  const closeFilters = () => {
    setIsFilterVisible(false);
  };

  const applyFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFiltersChanged(draftFilters);
    closeFilters();
  };

  const updateDraftFilters = (nextFilters: Partial<ExploreFilters>) => {
    setDraftFilters((current) => ({ ...current, ...nextFilters }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        <View style={styles.actionRow}>
          <Link
            href={{
              pathname: '/(modals)/booking',
              params: {
                guests: String(searchGuests),
                search: searchQuery,
              },
            }}
            asChild>
            <TouchableOpacity>
              <View style={styles.searchBtn}>
                <Ionicons name="search" size={24} />
                <View style={styles.searchTextWrap}>
                  <Text numberOfLines={1} style={styles.searchTitle}>
                    {hasSearchQuery ? searchQuery : 'Where to?'}
                  </Text>
                  <Text numberOfLines={1} style={styles.searchSubtitle}>
                    {searchSubtitle}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
          <TouchableOpacity
            accessibilityLabel="Open filters and sort"
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={openFilters}>
            <Ionicons name="options-outline" size={24} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: 'center',
            gap: 20,
            paddingHorizontal: 16,
          }}>
          {categories.map((item, index) => (
            <TouchableOpacity
              ref={(el) => {
                itemsRef.current[index] = el;
              }}
              key={item.id}
              style={activeIndex === index ? styles.categoriesBtnActive : styles.categoriesBtn}
              onPress={() => selectCategory(index)}>
              <MaterialIcons
                name={item.icon as any}
                size={24}
                color={activeIndex === index ? '#000' : Colors.grey}
              />
              <Text style={activeIndex === index ? styles.categoryTextActive : styles.categoryText}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Modal visible={isFilterVisible} animationType="slide" transparent onRequestClose={closeFilters}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={styles.backdropTouch} onPress={closeFilters} />

          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <View>
                <Text style={styles.filterTitle}>Filters & sort</Text>
                <Text style={styles.filterSubtitle}>Find the homes that match this trip.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeFilters}>
                <Ionicons name="close" size={22} color={Colors.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.filterContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>Sort by</Text>
                {sortOptions.map((option) => {
                  const isSelected = draftFilters.sort === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.sortOption, isSelected && styles.sortOptionSelected]}
                      onPress={() => updateDraftFilters({ sort: option.value })}>
                      <View style={styles.sortTextWrap}>
                        <Text style={[styles.sortTitle, isSelected && styles.selectedText]}>{option.label}</Text>
                        <Text style={styles.sortDescription}>{option.description}</Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>Price range</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceField}>
                    <Text style={styles.inputLabel}>Min</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) => updateDraftFilters({ minPrice: onlyDigits(value) })}
                      placeholder="Any"
                      placeholderTextColor={Colors.grey}
                      style={styles.priceInput}
                      value={draftFilters.minPrice}
                    />
                  </View>
                  <View style={styles.priceField}>
                    <Text style={styles.inputLabel}>Max</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={(value) => updateDraftFilters({ maxPrice: onlyDigits(value) })}
                      placeholder="Any"
                      placeholderTextColor={Colors.grey}
                      style={styles.priceInput}
                      value={draftFilters.maxPrice}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>Minimum rating</Text>
                <View style={styles.chipRow}>
                  {ratingOptions.map((option) => {
                    const isSelected = draftFilters.minRating === option.value;

                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => updateDraftFilters({ minRating: option.value })}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>Guests</Text>
                <View style={styles.chipRow}>
                  {guestOptions.map((value) => {
                    const isSelected = draftFilters.guests === value;

                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => updateDraftFilters({ guests: value })}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {value === 0 ? 'Any' : `${value}+`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterBlock}>
                <Text style={styles.filterBlockTitle}>Bedrooms</Text>
                <View style={styles.chipRow}>
                  {bedroomOptions.map((value) => {
                    const isSelected = draftFilters.bedrooms === value;

                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => updateDraftFilters({ bedrooms: value })}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {value === 0 ? 'Any' : `${value}+`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setDraftFilters(defaultExploreFilters)}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyText}>Show homes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    height: 130,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {
      width: 1,
      height: 10,
    },
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  searchBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    alignItems: 'center',
    width: 280,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c2c2c2',
    borderRadius: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 1,
      height: 1,
    },
  },
  searchTextWrap: {
    flex: 1,
  },
  searchTitle: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
  },
  searchSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
  },
  filterBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#A2A0A2',
    borderRadius: 24,
  },
  filterBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: '#fff5f7',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 11,
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'mon-sb',
    color: Colors.grey,
  },
  categoryTextActive: {
    fontSize: 14,
    fontFamily: 'mon-sb',
    color: '#000',
  },
  categoriesBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  categoriesBtnActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomColor: '#000',
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
  },
  backdropTouch: {
    flex: 1,
  },
  filterSheet: {
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e7e7e7',
  },
  filterTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 22,
  },
  filterSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContent: {
    gap: 20,
    padding: 20,
  },
  filterBlock: {
    gap: 12,
  },
  filterBlockTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dddddd',
    borderRadius: 16,
    padding: 14,
  },
  sortOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#fff5f7',
  },
  sortTextWrap: {
    flex: 1,
    gap: 3,
  },
  sortTitle: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 15,
  },
  selectedText: {
    color: Colors.primary,
  },
  sortDescription: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceField: {
    flex: 1,
    gap: 7,
  },
  inputLabel: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    fontSize: 12,
  },
  priceInput: {
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8d8d8',
    paddingHorizontal: 14,
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    minWidth: 64,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7d7d7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  chipSelected: {
    borderColor: Colors.dark,
    backgroundColor: Colors.dark,
  },
  chipText: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
  },
  chipTextSelected: {
    color: '#fff',
  },
  filterFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e7e7e7',
  },
  resetButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 15,
  },
  applyButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 16,
  },
});

export default ExploreHeader;
