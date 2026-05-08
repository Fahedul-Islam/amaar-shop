import { publicFetch } from "./api";

export type ReservationStatus =
  | "active"
  | "consumed"
  | "expired"
  | "cancelled";

export interface CartReservationItem {
  id: string;
  product_id: string;
  quantity: number;
}

export interface CartReservation {
  id: string;
  shop_id: string;
  status: ReservationStatus;
  expires_at: string; // RFC3339
  created_at: string;
  items: CartReservationItem[];
  customer_phone?: string;
}

export interface ReservationItemInput {
  product_id: string;
  quantity: number;
}

export const createReservation = (
  slug: string,
  items: ReservationItemInput[],
) =>
  publicFetch<CartReservation>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/cart-reservations`,
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
  );

export const getReservation = (slug: string, id: string) =>
  publicFetch<CartReservation>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/cart-reservations/${encodeURIComponent(id)}`,
  );

export const cancelReservation = (slug: string, id: string) =>
  publicFetch<CartReservation>(
    `/api/shops/by-slug/${encodeURIComponent(slug)}/cart-reservations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

/**
 * Persist the active reservation in localStorage so the timer survives a
 * page reload. Keyed by shop slug so multiple shops in the same browser
 * don't clobber each other.
 */
const STORAGE_PREFIX = "amaarshop:cart-reservation:";

export function storedReservation(slug: string): CartReservation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + slug);
    if (!raw) return null;
    return JSON.parse(raw) as CartReservation;
  } catch {
    return null;
  }
}

export function storeReservation(slug: string, r: CartReservation) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(r));
  } catch {
    /* private mode — ignore */
  }
}

export function clearStoredReservation(slug: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + slug);
  } catch {
    /* ignore */
  }
}

/**
 * Item-level deep equality so we can decide whether a stored reservation
 * still matches the current cart, or whether the user changed quantities
 * and we need a fresh hold.
 */
export function reservationItemsMatch(
  a: ReservationItemInput[],
  b: { product_id: string; quantity: number }[],
): boolean {
  if (a.length !== b.length) return false;
  const aMap = new Map(a.map((x) => [x.product_id, x.quantity]));
  for (const it of b) {
    if (aMap.get(it.product_id) !== it.quantity) return false;
  }
  return true;
}

/** Returns ms remaining until expiry, never negative. */
export function msUntilExpiry(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms > 0 ? ms : 0;
}

/**
 * Per-slug queue so concurrent ensure calls (React StrictMode double-mount,
 * a buyer spamming +/- on a quantity stepper, etc.) get serialized into a
 * single chain instead of all firing their own create-then-store cycle.
 *
 * Without this, two simultaneous ensure() calls each see stored=null,
 * each call POST /cart-reservations, the server happily creates *two*
 * holds, only the last write to localStorage is remembered, and the
 * other one leaks stock until the sweeper picks it up.
 */
const ensureQueues = new Map<string, Promise<unknown>>();

/**
 * Pick up an existing matching reservation without ever creating a new
 * one. Returns the live reservation if a stored hold matches the cart
 * and is still active server-side; otherwise cancels the stale hold
 * (releasing its stock) and returns null. Used at checkout-page mount
 * so we resume the buyer's payment phase if they're returning, but
 * never silently debit stock just because someone opened the page.
 */
export async function pickUpReservation(
  slug: string,
  items: ReservationItemInput[],
): Promise<CartReservation | null> {
  const prev = ensureQueues.get(slug);
  const next = (async () => {
    if (prev) {
      try {
        await prev;
      } catch {
        /* ignore */
      }
    }
    const stored = storedReservation(slug);
    if (!stored) return null;

    // Dead client-side or doesn't match the cart → drop it. Cancel on
    // the server too so the held stock is freed for other buyers
    // immediately, not just at the next sweep tick.
    if (
      stored.status !== "active" ||
      msUntilExpiry(stored.expires_at) <= 0 ||
      !reservationItemsMatch(items, stored.items)
    ) {
      try {
        await cancelReservation(slug, stored.id);
      } catch {
        /* already non-active or vanished — fine */
      }
      clearStoredReservation(slug);
      return null;
    }

    // Verify with the server before showing a countdown — the sweeper
    // may have expired it past our local clock's view.
    try {
      const fresh = await getReservation(slug, stored.id);
      if (
        fresh.status === "active" &&
        msUntilExpiry(fresh.expires_at) > 0
      ) {
        storeReservation(slug, fresh);
        return fresh;
      }
    } catch {
      /* unrecoverable — fall through */
    }
    clearStoredReservation(slug);
    return null;
  })();
  ensureQueues.set(slug, next);
  next.finally(() => {
    if (ensureQueues.get(slug) === next) {
      ensureQueues.delete(slug);
    }
  });
  return next;
}

/**
 * Make sure there is exactly one active reservation for `slug` whose
 * items match the given cart. If a stored reservation already matches
 * and is still alive on the server, reuse it. Otherwise cancel the
 * stored one (awaited, so the stock restore lands before we debit
 * again) and create a fresh hold.
 */
export async function ensureReservation(
  slug: string,
  items: ReservationItemInput[],
): Promise<CartReservation> {
  const prev = ensureQueues.get(slug);
  const next = (async () => {
    if (prev) {
      // Wait for the previous ensure on this slug to settle so we observe
      // its localStorage write. Swallow its error — failures are surfaced
      // to whichever caller initiated that work, not to us.
      try {
        await prev;
      } catch {
        /* ignore */
      }
    }

    const stored = storedReservation(slug);

    // Reuse a still-alive matching hold instead of churning new ones.
    if (
      stored &&
      stored.status === "active" &&
      msUntilExpiry(stored.expires_at) > 0 &&
      reservationItemsMatch(items, stored.items)
    ) {
      try {
        const fresh = await getReservation(slug, stored.id);
        if (
          fresh.status === "active" &&
          msUntilExpiry(fresh.expires_at) > 0
        ) {
          storeReservation(slug, fresh);
          return fresh;
        }
      } catch {
        /* fall through to create */
      }
    }

    // Cancel old before creating new — awaited, so its stock restore is
    // visible to the create call that follows. Concurrency between cancel
    // and create was the bug that produced phantom holds.
    if (stored?.id) {
      try {
        await cancelReservation(slug, stored.id);
      } catch {
        /* gone or already non-active — fine */
      }
    }
    clearStoredReservation(slug);

    const fresh = await createReservation(slug, items);
    storeReservation(slug, fresh);
    return fresh;
  })();

  ensureQueues.set(slug, next);
  // Drop the entry once settled so the queue doesn't keep a stale
  // (possibly errored) tail forever.
  next.finally(() => {
    if (ensureQueues.get(slug) === next) {
      ensureQueues.delete(slug);
    }
  });
  return next;
}
