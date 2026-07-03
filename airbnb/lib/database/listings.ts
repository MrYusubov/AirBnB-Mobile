import * as SQLite from 'expo-sqlite';

export type ListingStatus = 'pending' | 'accepted' | 'rejected';

export type Listing = Record<string, any> & {
  id: string;
  name: string;
  status?: ListingStatus;
  category_id?: string | null;
  category_title?: string | null;
  owner_user_id?: string | null;
  owner_email?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  image_urls?: string[];
  cloudinary_public_ids?: string[];
};

export type AppUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

export type BookingStatus = 'pending' | 'paid' | 'cancelled';

export type Booking = {
  id: string;
  user_id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  total_price: number;
  status: BookingStatus;
  paid_at: string | null;
  created_at: string;
};

export type CreateBookingInput = {
  user_id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  total_price: number;
  status?: BookingStatus;
};

export type Review = {
  id: string;
  listing_id: string;
  user_id: string;
  booking_id: string;
  user_name: string | null;
  rating: number;
  comment: string;
  created_at: string;
};

export type ReviewStats = {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

type ListingRow = {
  data: string;
  status: ListingStatus;
  category_id: string | null;
  category_title?: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  latitude: number | null;
  longitude: number | null;
};

type BookingRow = Booking;
type ReviewRow = Review;

type TableColumn = {
  name: string;
};

export type Destination = {
  id: string;
  title: string;
};

export type Category = {
  id: string;
  title: string;
  icon: string;
  sort_order: number;
};

export type ListingsGeo = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: number[];
    };
    properties: Listing & {
      latitude: number;
      longitude: number;
    };
  }[];
};

const DATABASE_NAME = 'airbnb.db';
const USER_OWNED_RESET_KEY = 'user_owned_listings_reset_v1';

const defaultCategories: Category[] = [
  {
    id: 'tiny-homes',
    title: 'Tiny homes',
    icon: 'home',
    sort_order: 1,
  },
  {
    id: 'cabins',
    title: 'Cabins',
    icon: 'house-siding',
    sort_order: 2,
  },
  {
    id: 'trending',
    title: 'Trending',
    icon: 'local-fire-department',
    sort_order: 3,
  },
  {
    id: 'play',
    title: 'Play',
    icon: 'videogame-asset',
    sort_order: 4,
  },
  {
    id: 'city',
    title: 'City',
    icon: 'apartment',
    sort_order: 5,
  },
  {
    id: 'beachfront',
    title: 'Beachfront',
    icon: 'beach-access',
    sort_order: 6,
  },
  {
    id: 'countryside',
    title: 'Countryside',
    icon: 'nature-people',
    sort_order: 7,
  },
];

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializePromise: Promise<void> | null = null;

const getDatabase = () => {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toNumberOrNull = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const parseJsonArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseListingRow = (row: ListingRow) => {
  const listing = JSON.parse(row.data) as Listing;

  return {
    ...listing,
    status: row.status,
    category_id: row.category_id ?? listing.category_id ?? null,
    category_title: row.category_title ?? listing.category_title ?? null,
    owner_user_id: row.owner_user_id,
    owner_email: row.owner_email,
    latitude: row.latitude ?? listing.latitude,
    longitude: row.longitude ?? listing.longitude,
    image_urls: parseJsonArray(listing.image_urls) as string[],
    cloudinary_public_ids: parseJsonArray(listing.cloudinary_public_ids) as string[],
  };
};

const emptyReviewStats = (): ReviewStats => ({
  average: 0,
  total: 0,
  distribution: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
});

const normalizeListing = (listing: Partial<Listing> & { name: string }): Listing => ({
  ...listing,
  id: listing.id ? String(listing.id) : createId(),
  status: listing.status ?? 'pending',
  image_urls: parseJsonArray(listing.image_urls) as string[],
  cloudinary_public_ids: parseJsonArray(listing.cloudinary_public_ids) as string[],
});

const ensureColumn = async (db: SQLite.SQLiteDatabase, table: string, column: string, definition: string) => {
  const columns = await db.getAllAsync<TableColumn>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
};

const writeListing = async (
  db: SQLite.SQLiteDatabase,
  listingInput: Partial<Listing> & { name: string }
) => {
  const listing = normalizeListing(listingInput);
  const imageUrls = listing.image_urls ?? [];
  const cloudinaryPublicIds = listing.cloudinary_public_ids ?? [];
  const data = JSON.stringify({
    ...listing,
    image_urls: imageUrls,
    cloudinary_public_ids: cloudinaryPublicIds,
  });

  await db.runAsync(
    `INSERT INTO listings (
      id,
      name,
      category_id,
      status,
      owner_user_id,
      owner_email,
      price,
      room_type,
      smart_location,
      latitude,
      longitude,
      medium_url,
      xl_picture_url,
      host_name,
      review_scores_rating,
      number_of_reviews,
      image_urls,
      cloudinary_public_ids,
      data,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category_id = excluded.category_id,
      status = excluded.status,
      owner_user_id = excluded.owner_user_id,
      owner_email = excluded.owner_email,
      price = excluded.price,
      room_type = excluded.room_type,
      smart_location = excluded.smart_location,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      medium_url = excluded.medium_url,
      xl_picture_url = excluded.xl_picture_url,
      host_name = excluded.host_name,
      review_scores_rating = excluded.review_scores_rating,
      number_of_reviews = excluded.number_of_reviews,
      image_urls = excluded.image_urls,
      cloudinary_public_ids = excluded.cloudinary_public_ids,
      data = excluded.data,
      updated_at = CURRENT_TIMESTAMP`,
    [
      listing.id,
      listing.name,
      listing.category_id ?? null,
      listing.status,
      listing.owner_user_id ?? null,
      listing.owner_email ?? null,
      toNumberOrNull(listing.price),
      listing.room_type ?? null,
      listing.smart_location ?? null,
      toNumberOrNull(listing.latitude),
      toNumberOrNull(listing.longitude),
      listing.medium_url ?? imageUrls[0] ?? null,
      listing.xl_picture_url ?? imageUrls[0] ?? null,
      listing.host_name ?? null,
      toNumberOrNull(listing.review_scores_rating),
      toNumberOrNull(listing.number_of_reviews),
      JSON.stringify(imageUrls),
      JSON.stringify(cloudinaryPublicIds),
      data,
    ]
  );

  return listing;
};

export const initializeListingsDatabase = async () => {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    const db = await getDatabase();

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        image_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        icon TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category_id TEXT,
        price REAL,
        room_type TEXT,
        smart_location TEXT,
        latitude REAL,
        longitude REAL,
        medium_url TEXT,
        xl_picture_url TEXT,
        host_name TEXT,
        review_scores_rating REAL,
        number_of_reviews INTEGER,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS categories_sort_idx ON categories(sort_order);
      CREATE INDEX IF NOT EXISTS listings_location_idx ON listings(latitude, longitude);
      CREATE INDEX IF NOT EXISTS listings_price_idx ON listings(price);

      CREATE TABLE IF NOT EXISTS wishlists (
        user_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, listing_id)
      );

      CREATE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists(user_id);
      CREATE INDEX IF NOT EXISTS wishlists_listing_idx ON wishlists(listing_id);

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        check_in TEXT NOT NULL,
        check_out TEXT NOT NULL,
        adults INTEGER NOT NULL DEFAULT 1,
        children INTEGER NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS bookings_listing_idx ON bookings(listing_id);
      CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY NOT NULL,
        listing_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        booking_id TEXT NOT NULL UNIQUE,
        user_name TEXT,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS reviews_listing_idx ON reviews(listing_id);
      CREATE INDEX IF NOT EXISTS reviews_user_idx ON reviews(user_id);

      CREATE TABLE IF NOT EXISTS destinations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS destinations_title_idx ON destinations(title);
    `);

    await ensureColumn(db, 'listings', 'status', "status TEXT NOT NULL DEFAULT 'accepted'");
    await ensureColumn(db, 'listings', 'category_id', 'category_id TEXT');
    await ensureColumn(db, 'listings', 'owner_user_id', 'owner_user_id TEXT');
    await ensureColumn(db, 'listings', 'owner_email', 'owner_email TEXT');
    await ensureColumn(db, 'listings', 'image_urls', 'image_urls TEXT');
    await ensureColumn(db, 'listings', 'cloudinary_public_ids', 'cloudinary_public_ids TEXT');

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);
      CREATE INDEX IF NOT EXISTS listings_category_idx ON listings(category_id);
      CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_user_id);
    `);

    for (const category of defaultCategories) {
      await db.runAsync(
        `INSERT INTO categories (id, title, icon, sort_order, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          icon = excluded.icon,
          sort_order = excluded.sort_order,
          updated_at = CURRENT_TIMESTAMP`,
        [category.id, category.title, category.icon, category.sort_order]
      );
    }

    const resetMeta = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ? LIMIT 1',
      [USER_OWNED_RESET_KEY]
    );

    if (!resetMeta) {
      await db.execAsync(`
        DELETE FROM reviews;
        DELETE FROM bookings;
        DELETE FROM wishlists;
        DELETE FROM listings;
      `);
      await db.runAsync(
        `INSERT INTO app_meta (key, value, updated_at)
        VALUES (?, 'done', CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = 'done', updated_at = CURRENT_TIMESTAMP`,
        [USER_OWNED_RESET_KEY]
      );
    }
  })().catch((error) => {
    initializePromise = null;
    throw error;
  });

  return initializePromise;
};

export const upsertUser = async (user: AppUser) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO users (id, email, first_name, last_name, image_url, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      image_url = excluded.image_url,
      updated_at = CURRENT_TIMESTAMP`,
    [user.id, user.email, user.first_name, user.last_name, user.image_url]
  );
};

export const getCategories = async () => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  return db.getAllAsync<Category>(
    'SELECT id, title, icon, sort_order FROM categories ORDER BY sort_order ASC, title ASC'
  );
};

export const getListings = async (status: ListingStatus = 'accepted', categoryId?: string | null) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const params: (string | null)[] = [status];
  const categoryClause = categoryId ? 'AND listings.category_id = ?' : '';

  if (categoryId) {
    params.push(categoryId);
  }

  const rows = await db.getAllAsync<ListingRow>(
    `SELECT listings.data,
      listings.status,
      listings.category_id,
      categories.title as category_title,
      listings.owner_user_id,
      listings.owner_email,
      listings.latitude,
      listings.longitude
    FROM listings
    LEFT JOIN categories ON categories.id = listings.category_id
    WHERE listings.status = ? ${categoryClause}
    ORDER BY listings.updated_at DESC`,
    params
  );

  return rows.map(parseListingRow);
};

export const getPendingListings = () => getListings('pending');

export const getListingById = async (id: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const row = await db.getFirstAsync<ListingRow>(
    `SELECT listings.data,
      listings.status,
      listings.category_id,
      categories.title as category_title,
      listings.owner_user_id,
      listings.owner_email,
      listings.latitude,
      listings.longitude
    FROM listings
    LEFT JOIN categories ON categories.id = listings.category_id
    WHERE listings.id = ?
    LIMIT 1`,
    [id]
  );

  return row ? parseListingRow(row) : null;
};

export const addListing = async (listing: Partial<Listing> & { name: string }) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  return writeListing(db, { ...listing, status: listing.status ?? 'pending' });
};

export const updateListing = async (id: string, listing: Partial<Listing> & { name: string }) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  return writeListing(db, { ...listing, id });
};

export const updateListingStatus = async (id: string, status: ListingStatus) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const listing = await getListingById(id);
  if (!listing) {
    return null;
  }

  return writeListing(db, { ...listing, status });
};

export const deleteListing = async (id: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  await db.runAsync('DELETE FROM wishlists WHERE listing_id = ?', [id]);
  await db.runAsync('DELETE FROM reviews WHERE listing_id = ?', [id]);
  await db.runAsync('DELETE FROM bookings WHERE listing_id = ?', [id]);
  await db.runAsync('DELETE FROM listings WHERE id = ?', [id]);
};

export const getWishlistListingIds = async (userId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const rows = await db.getAllAsync<{ listing_id: string }>(
    'SELECT listing_id FROM wishlists WHERE user_id = ?',
    [userId]
  );

  return rows.map((item) => item.listing_id);
};

export const isListingWishlisted = async (userId: string, listingId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const row = await db.getFirstAsync<{ listing_id: string }>(
    'SELECT listing_id FROM wishlists WHERE user_id = ? AND listing_id = ? LIMIT 1',
    [userId, listingId]
  );

  return Boolean(row);
};

export const addToWishlist = async (userId: string, listingId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO wishlists (user_id, listing_id) VALUES (?, ?)',
    [userId, listingId]
  );
};

export const removeFromWishlist = async (userId: string, listingId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  await db.runAsync('DELETE FROM wishlists WHERE user_id = ? AND listing_id = ?', [userId, listingId]);
};

export const toggleWishlist = async (userId: string, listingId: string) => {
  const isWishlisted = await isListingWishlisted(userId, listingId);

  if (isWishlisted) {
    await removeFromWishlist(userId, listingId);
    return false;
  }

  await addToWishlist(userId, listingId);
  return true;
};

export const getWishlistListings = async (userId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const rows = await db.getAllAsync<ListingRow>(
    `SELECT listings.data,
      listings.status,
      listings.category_id,
      categories.title as category_title,
      listings.owner_user_id,
      listings.owner_email,
      listings.latitude,
      listings.longitude
    FROM wishlists
    INNER JOIN listings ON listings.id = wishlists.listing_id
    LEFT JOIN categories ON categories.id = listings.category_id
    WHERE wishlists.user_id = ? AND listings.status = 'accepted'
    ORDER BY wishlists.created_at DESC`,
    [userId]
  );

  return rows.map(parseListingRow);
};

export const createBooking = async (input: CreateBookingInput) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const booking: Booking = {
    id: createId(),
    user_id: input.user_id,
    listing_id: input.listing_id,
    check_in: input.check_in,
    check_out: input.check_out,
    adults: input.adults,
    children: input.children,
    total_price: input.total_price,
    status: input.status ?? 'paid',
    paid_at: (input.status ?? 'paid') === 'paid' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  };

  await db.runAsync(
    `INSERT INTO bookings (
      id,
      user_id,
      listing_id,
      check_in,
      check_out,
      adults,
      children,
      total_price,
      status,
      paid_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      booking.id,
      booking.user_id,
      booking.listing_id,
      booking.check_in,
      booking.check_out,
      booking.adults,
      booking.children,
      booking.total_price,
      booking.status,
      booking.paid_at,
      booking.created_at,
    ]
  );

  return booking;
};

export const getListingReviews = async (listingId: string, limit = 5, offset = 0) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  return db.getAllAsync<ReviewRow>(
    `SELECT id, listing_id, user_id, booking_id, user_name, rating, comment, created_at
    FROM reviews
    WHERE listing_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`,
    [listingId, limit, offset]
  );
};

export const getReviewStats = async (listingId: string): Promise<ReviewStats> => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const summary = await db.getFirstAsync<{ total: number; average: number | null }>(
    'SELECT COUNT(*) as total, AVG(rating) as average FROM reviews WHERE listing_id = ?',
    [listingId]
  );
  const distributionRows = await db.getAllAsync<{ rating: number; count: number }>(
    'SELECT rating, COUNT(*) as count FROM reviews WHERE listing_id = ? GROUP BY rating',
    [listingId]
  );
  const stats = emptyReviewStats();

  stats.total = summary?.total ?? 0;
  stats.average = summary?.average ?? 0;

  distributionRows.forEach((row) => {
    if (row.rating >= 1 && row.rating <= 5) {
      stats.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row.count;
    }
  });

  return stats;
};

const refreshListingReviewSummary = async (db: SQLite.SQLiteDatabase, listingId: string) => {
  const listing = await getListingById(listingId);

  if (!listing) {
    return;
  }

  const stats = await getReviewStats(listingId);
  await writeListing(db, {
    ...listing,
    review_scores_rating: Math.round(stats.average * 20),
    number_of_reviews: stats.total,
  });
};

export const getReviewEligibility = async (userId: string, listingId: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const booking = await db.getFirstAsync<{ id: string }>(
    `SELECT bookings.id
    FROM bookings
    LEFT JOIN reviews ON reviews.booking_id = bookings.id
    WHERE bookings.user_id = ?
      AND bookings.listing_id = ?
      AND bookings.status = 'paid'
      AND date(bookings.check_out) <= date(?)
      AND reviews.id IS NULL
    ORDER BY bookings.check_out DESC
    LIMIT 1`,
    [userId, listingId, today]
  );

  if (booking) {
    return {
      canReview: true,
      bookingId: booking.id,
      message: null,
    };
  }

  return {
    canReview: false,
    bookingId: null,
    message: 'Only guests who completed a paid stay can write a review.',
  };
};

export const addReview = async (input: {
  listingId: string;
  userId: string;
  bookingId: string;
  userName: string | null;
  rating: number;
  comment: string;
}) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const today = new Date().toISOString().slice(0, 10);
  const eligibleBooking = await db.getFirstAsync<{ id: string }>(
    `SELECT id
    FROM bookings
    WHERE id = ?
      AND user_id = ?
      AND listing_id = ?
      AND status = 'paid'
      AND date(check_out) <= date(?)
    LIMIT 1`,
    [input.bookingId, input.userId, input.listingId, today]
  );

  if (!eligibleBooking) {
    throw new Error('You can review this home after your stay is completed.');
  }

  const review: Review = {
    id: createId(),
    listing_id: input.listingId,
    user_id: input.userId,
    booking_id: input.bookingId,
    user_name: input.userName,
    rating,
    comment: input.comment.trim(),
    created_at: new Date().toISOString(),
  };

  await db.runAsync(
    `INSERT INTO reviews (
      id,
      listing_id,
      user_id,
      booking_id,
      user_name,
      rating,
      comment,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      review.id,
      review.listing_id,
      review.user_id,
      review.booking_id,
      review.user_name,
      review.rating,
      review.comment,
      review.created_at,
    ]
  );

  await refreshListingReviewSummary(db, input.listingId);
  return review;
};

export const getDestinations = async () => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  return db.getAllAsync<Destination>('SELECT id, title FROM destinations ORDER BY title ASC');
};

export const addDestination = async (title: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const destination = {
    id: createId(),
    title,
  };

  await db.runAsync(
    'INSERT INTO destinations (id, title, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [destination.id, destination.title]
  );

  return destination;
};

export const deleteDestination = async (id: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  await db.runAsync('DELETE FROM destinations WHERE id = ?', [id]);
};

export const getListingsGeo = async (categoryId?: string | null): Promise<ListingsGeo> => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const params: string[] = [];
  const categoryClause = categoryId ? 'AND listings.category_id = ?' : '';

  if (categoryId) {
    params.push(categoryId);
  }

  const rows = await db.getAllAsync<ListingRow>(
    `SELECT listings.data,
      listings.status,
      listings.category_id,
      categories.title as category_title,
      listings.owner_user_id,
      listings.owner_email,
      listings.latitude,
      listings.longitude
    FROM listings
    LEFT JOIN categories ON categories.id = listings.category_id
    WHERE listings.status = 'accepted'
      AND listings.latitude IS NOT NULL
      AND listings.longitude IS NOT NULL
      ${categoryClause}`,
    params
  );

  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => {
      const listing = parseListingRow(row);
      const latitude = row.latitude ?? toNumberOrNull(listing.latitude) ?? 0;
      const longitude = row.longitude ?? toNumberOrNull(listing.longitude) ?? 0;

      return {
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
      };
    }),
  };
};
