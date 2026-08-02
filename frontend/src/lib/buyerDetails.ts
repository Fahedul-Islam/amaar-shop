import { BD_DISTRICTS, BD_DIVISIONS, type Division } from './bdGeo';

/**
 * Remembers the buyer's delivery details on their own device so a returning
 * customer doesn't retype five fields on a phone keyboard every time.
 *
 * The cart is already persisted this way; the details that actually take
 * effort to enter were not. Repeat purchases are a large share of a social
 * seller's revenue, so turning checkout into "review and confirm" removes the
 * biggest remaining source of drop-off.
 *
 * Stored per browser, not per shop: the same person ordering from a second
 * shop on the platform still has their address to hand. Nothing leaves the
 * device — this is localStorage, not the server.
 */
const STORAGE_KEY = 'amaarshop:buyer-details';

export interface BuyerDetails {
  name: string;
  phone: string;
  division: Division | '';
  district: string;
  address: string;
}

export const EMPTY_BUYER_DETAILS: BuyerDetails = {
  name: '',
  phone: '',
  division: '',
  district: '',
  address: '',
};

function isDivision(v: unknown): v is Division {
  return typeof v === 'string' && (BD_DIVISIONS as readonly string[]).includes(v);
}

/**
 * loadBuyerDetails returns previously saved details, or empty values when
 * nothing is stored or the stored shape is unusable.
 *
 * Every field is validated rather than trusted: localStorage can be edited by
 * hand or left over from an older version of the app, and a bad division would
 * otherwise break the district dropdown.
 */
export function loadBuyerDetails(): BuyerDetails {
  if (typeof window === 'undefined') return EMPTY_BUYER_DETAILS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_BUYER_DETAILS;

    const parsed = JSON.parse(raw) as Partial<Record<keyof BuyerDetails, unknown>>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');

    const division = isDivision(parsed.division) ? parsed.division : '';
    const district = str(parsed.district);

    return {
      name: str(parsed.name),
      phone: str(parsed.phone),
      division,
      // Drop a district that doesn't belong to the division — the pair could
      // be stale if the geo list changed.
      district: division && BD_DISTRICTS[division].includes(district) ? district : '',
      address: str(parsed.address),
    };
  } catch {
    return EMPTY_BUYER_DETAILS;
  }
}

/** saveBuyerDetails stores the details after a successful order. */
export function saveBuyerDetails(details: BuyerDetails): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Private browsing or a full quota — remembering details is a
    // convenience, never a reason to fail an order.
  }
}

/** clearBuyerDetails forgets the buyer — used by the "Not you?" action. */
export function clearBuyerDetails(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** hasStoredDetails reports whether anything meaningful was remembered. */
export function hasStoredDetails(d: BuyerDetails): boolean {
  return !!(d.name && d.phone);
}
