// Live backend for the Imagine Market (feed, likes, comments, publishing).
// Backed by Supabase tables market_items / market_likes / market_comments —
// see supabase/migrations/20260712000000_market_schema.sql for the schema.
//
// There is no real user-auth system in this app yet, so every device gets a
// stable per-install UUID (persisted in AsyncStorage) which is used as a
// pseudo-author-id everywhere the backend needs to know "did this device
// like/comment/publish this."
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { MarketItem } from "../state";

const DEVICE_ID_KEY = "collider-device-id";

function uuidv4(): string {
  // RFC4122-ish v4 UUID without relying on crypto.randomUUID(), which isn't
  // guaranteed to exist in the Hermes/RN runtime without extra polyfills.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
    const created = uuidv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, created);
    cachedDeviceId = created;
    return created;
  } catch {
    // AsyncStorage unavailable for some reason — fall back to an in-memory
    // id for this session rather than crashing the caller.
    if (!cachedDeviceId) cachedDeviceId = uuidv4();
    return cachedDeviceId;
  }
}

export type MarketRow = {
  id: string;
  kind: MarketItem["kind"];
  prompt: string;
  model: string;
  author: string;
  author_device_id: string | null;
  likes: number;
  url: string | null;
  created_at: string;
};

export type MarketComment = {
  id: string;
  item_id: string;
  device_id: string;
  author_label: string;
  content: string;
  created_at: string;
};

function rowToMarketItem(row: MarketRow, likedItemIds: Set<string>): MarketItem {
  return {
    id: row.id,
    kind: row.kind,
    prompt: row.prompt,
    model: row.model,
    author: row.author,
    likes: row.likes,
    likedByUser: likedItemIds.has(row.id),
    url: row.url || undefined,
  };
}

export type FetchMarketItemsOpts = {
  offset: number;
  limit: number;
  kind?: MarketItem["kind"] | "all";
  search?: string;
  sortBy?: "trending" | "likes" | "remixes" | "newest";
  deviceId?: string;
  authorOnly?: string;
};

export async function fetchMarketItems(opts: FetchMarketItemsOpts): Promise<{ items: MarketItem[]; hasMore: boolean }> {
  const { offset, limit, kind, search, sortBy = "trending", authorOnly } = opts;

  let query = supabase.from("market_items").select("*", { count: "exact" });

  if (kind && kind !== "all") {
    query = query.eq("kind", kind);
  }
  if (authorOnly) {
    query = query.eq("author", authorOnly);
  }
  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`prompt.ilike.%${term}%,author.ilike.%${term}%`);
  }

  if (sortBy === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (sortBy === "likes" || sortBy === "trending" || sortBy === "remixes") {
    query = query.order("likes", { ascending: false }).order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data || []) as MarketRow[];
  const deviceId = opts.deviceId || (await getDeviceId());

  let likedItemIds = new Set<string>();
  if (rows.length > 0) {
    const { data: likeRows, error: likeErr } = await supabase
      .from("market_likes")
      .select("item_id")
      .eq("device_id", deviceId)
      .in("item_id", rows.map((r) => r.id));
    if (!likeErr && likeRows) {
      likedItemIds = new Set(likeRows.map((l: any) => l.item_id));
    }
  }

  const items = rows.map((r) => rowToMarketItem(r, likedItemIds));
  const hasMore = typeof count === "number" ? offset + rows.length < count : rows.length === limit;

  return { items, hasMore };
}

export async function publishMarketItem(item: {
  kind: MarketItem["kind"];
  prompt: string;
  model: string;
  author: string;
  url?: string;
}): Promise<MarketItem> {
  const deviceId = await getDeviceId();
  const { data, error } = await supabase
    .from("market_items")
    .insert({
      kind: item.kind,
      prompt: item.prompt,
      model: item.model,
      author: item.author,
      author_device_id: deviceId,
      url: item.url || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return rowToMarketItem(data as MarketRow, new Set());
}

export async function toggleLike(itemId: string, deviceId: string, currentlyLiked: boolean): Promise<{ liked: boolean }> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from("market_likes")
      .delete()
      .eq("item_id", itemId)
      .eq("device_id", deviceId);
    if (error) throw error;
    return { liked: false };
  } else {
    const { error } = await supabase
      .from("market_likes")
      .insert({ item_id: itemId, device_id: deviceId });
    // A unique-violation here means another tab/request already liked it —
    // treat that as success rather than surfacing an error.
    if (error && (error as any).code !== "23505") throw error;
    return { liked: true };
  }
}

export async function fetchComments(itemId: string): Promise<MarketComment[]> {
  const { data, error } = await supabase
    .from("market_comments")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as MarketComment[];
}

export async function addComment(itemId: string, deviceId: string, authorLabel: string, content: string): Promise<MarketComment> {
  const { data, error } = await supabase
    .from("market_comments")
    .insert({ item_id: itemId, device_id: deviceId, author_label: authorLabel, content })
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketComment;
}
