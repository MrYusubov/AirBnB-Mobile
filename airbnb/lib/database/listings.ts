import * as SQLite from 'expo-sqlite';

export type ListingStatus = 'pending' | 'accepted' | 'rejected';

export type Listing = Record<string, any> & {
  id: string;
  name: string;
  status?: ListingStatus;
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

type ListingRow = {
  data: string;
  status: ListingStatus;
  owner_user_id: string | null;
  owner_email: string | null;
  latitude: number | null;
  longitude: number | null;
};

type TableColumn = {
  name: string;
};

export type Destination = {
  id: string;
  title: string;
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
    owner_user_id: row.owner_user_id,
    owner_email: row.owner_email,
    latitude: row.latitude ?? listing.latitude,
    longitude: row.longitude ?? listing.longitude,
    image_urls: parseJsonArray(listing.image_urls) as string[],
    cloudinary_public_ids: parseJsonArray(listing.cloudinary_public_ids) as string[],
  };
};

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
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

      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS destinations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS destinations_title_idx ON destinations(title);
    `);

    await ensureColumn(db, 'listings', 'status', "status TEXT NOT NULL DEFAULT 'accepted'");
    await ensureColumn(db, 'listings', 'owner_user_id', 'owner_user_id TEXT');
    await ensureColumn(db, 'listings', 'owner_email', 'owner_email TEXT');
    await ensureColumn(db, 'listings', 'image_urls', 'image_urls TEXT');
    await ensureColumn(db, 'listings', 'cloudinary_public_ids', 'cloudinary_public_ids TEXT');

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);
      CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_user_id);
    `);
  })();

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

export const getListings = async (status: ListingStatus = 'accepted') => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const rows = await db.getAllAsync<ListingRow>(
    `SELECT data, status, owner_user_id, owner_email, latitude, longitude
    FROM listings
    WHERE status = ?
    ORDER BY updated_at DESC`,
    [status]
  );

  return rows.map(parseListingRow);
};

export const getPendingListings = () => getListings('pending');

export const getListingById = async (id: string) => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const row = await db.getFirstAsync<ListingRow>(
    `SELECT data, status, owner_user_id, owner_email, latitude, longitude
    FROM listings
    WHERE id = ?
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
    `SELECT listings.data, listings.status, listings.owner_user_id, listings.owner_email, listings.latitude, listings.longitude
    FROM wishlists
    INNER JOIN listings ON listings.id = wishlists.listing_id
    WHERE wishlists.user_id = ? AND listings.status = 'accepted'
    ORDER BY wishlists.created_at DESC`,
    [userId]
  );

  return rows.map(parseListingRow);
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

export const getListingsGeo = async (): Promise<ListingsGeo> => {
  await initializeListingsDatabase();

  const db = await getDatabase();
  const rows = await db.getAllAsync<ListingRow>(
    `SELECT data, status, owner_user_id, owner_email, latitude, longitude
    FROM listings
    WHERE status = 'accepted' AND latitude IS NOT NULL AND longitude IS NOT NULL`
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
