export type SortOption = 'recommended' | 'price-low' | 'price-high' | 'rating-high' | 'reviews-high';

export type ExploreFilters = {
  sort: SortOption;
  minPrice: string;
  maxPrice: string;
  minRating: number;
  guests: number;
  bedrooms: number;
};

export const defaultExploreFilters: ExploreFilters = {
  sort: 'recommended',
  minPrice: '',
  maxPrice: '',
  minRating: 0,
  guests: 0,
  bedrooms: 0,
};

export const sortOptions: { label: string; value: SortOption; description: string }[] = [
  {
    label: 'Recommended',
    value: 'recommended',
    description: 'Newest accepted homes first',
  },
  {
    label: 'Lowest price',
    value: 'price-low',
    description: 'Cheapest nightly price',
  },
  {
    label: 'Highest price',
    value: 'price-high',
    description: 'Premium homes first',
  },
  {
    label: 'Top rated',
    value: 'rating-high',
    description: 'Best review scores first',
  },
  {
    label: 'Most reviewed',
    value: 'reviews-high',
    description: 'Homes with more reviews first',
  },
];

export const getActiveFilterCount = (filters: ExploreFilters) => {
  let count = filters.sort === 'recommended' ? 0 : 1;

  if (filters.minPrice.trim()) {
    count += 1;
  }

  if (filters.maxPrice.trim()) {
    count += 1;
  }

  if (filters.minRating > 0) {
    count += 1;
  }

  if (filters.guests > 0) {
    count += 1;
  }

  if (filters.bedrooms > 0) {
    count += 1;
  }

  return count;
};
