import { Platform } from "react-native";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase";

// Native in-app purchase (spec: "Code Native Purchase integration for
// purchases").
//
// Why this is listener-based rather than a single awaited call: react-native-
// iap's `requestPurchase` resolves when the store sheet is *presented*, not
// when payment settles. The real result arrives asynchronously on
// `purchaseUpdatedListener` / `purchaseErrorListener`. The previous version
// awaited `requestPurchase` and then ran `endConnection()` in a `finally`,
// which tore down the connection before the transaction event could land — so
// no purchase was ever finished. Both App Store and Play **automatically
// refund transactions that are never finished**, meaning even a successful
// payment reversed itself. Hence: one long-lived connection, listeners that
// resolve a pending promise, and an explicit `finishTransaction` before we
// report success.
export const IAP_PRODUCTS = ["collider.pro.monthly", "collider.elite.monthly", "collider.wallpaper.pack"];

export type PurchaseResult = {
  productId: string;
  transactionId?: string;
  // Opaque store receipt/token. Send this to a trusted server to verify before
  // granting entitlements in production — a client-side "it succeeded" is
  // spoofable on a rooted/jailbroken device. See verifyPurchase() below.
  receipt?: string;
};

let iapModule: any = null;
let connected = false;
let listenersAttached = false;

// Resolvers for the purchase currently in flight. Only one purchase can be in
// flight at a time — the store UI is modal, so this is a real constraint, not
// a simplification.
let pending: {
  productId: string;
  resolve: (r: PurchaseResult) => void;
  reject: (e: Error) => void;
} | null = null;

function isSupported() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function ensureConnection() {
  if (!isSupported()) throw new Error("IAP is available in native iOS/Android builds.");
  if (!iapModule) iapModule = await import("react-native-iap");
  if (!connected) {
    await iapModule.initConnection();
    connected = true;
  }
  if (!listenersAttached) {
    iapModule.purchaseUpdatedListener(async (purchase: any) => {
      const receipt = purchase?.transactionReceipt || purchase?.purchaseToken;
      if (!receipt) return;
      try {
        // Finishing is what tells the store the goods were delivered. Skipping
        // it is what caused the auto-refund behaviour described above.
        await iapModule.finishTransaction({ purchase, isConsumable: false });
      } catch {
        // A finish failure still leaves the transaction queued; the store will
        // replay it on next connection. Don't fail the purchase over it.
      }
      if (pending) {
        const p = pending;
        pending = null;
        p.resolve({
          productId: purchase?.productId || p.productId,
          transactionId: purchase?.transactionId,
          receipt,
        });
      }
    });
    iapModule.purchaseErrorListener((err: any) => {
      if (pending) {
        const p = pending;
        pending = null;
        // User cancellation is a normal outcome, not an exception to swallow —
        // the caller needs to distinguish it so it can decline to grant.
        p.reject(new Error(err?.code === "E_USER_CANCELLED" ? "cancelled" : err?.message || "Purchase failed."));
      }
    });
    listenersAttached = true;
  }
}

/**
 * Runs a purchase to completion. Resolves ONLY after the store confirmed
 * payment and the transaction was finished. Rejects on cancellation, failure,
 * or timeout. Callers must not grant entitlements unless this resolves.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  await ensureConnection();
  if (pending) throw new Error("Another purchase is already in progress.");

  return new Promise<PurchaseResult>((resolve, reject) => {
    pending = { productId, resolve, reject };

    // Guard against a store sheet that never reports back (backgrounded app,
    // dropped network mid-flow). Without this the promise would hang forever
    // and the UI would sit disabled.
    const timeout = setTimeout(() => {
      if (pending?.productId === productId) {
        pending = null;
        reject(new Error("Purchase timed out. If you were charged, restore purchases from Settings."));
      }
    }, 120000);

    const settle = <T,>(fn: (v: T) => void) => (v: T) => { clearTimeout(timeout); fn(v); };
    pending.resolve = settle(resolve);
    pending.reject = settle(reject);

    iapModule
      .requestPurchase({ request: { ios: { sku: productId }, android: { skus: [productId] } } } as any)
      .catch((e: any) => {
        if (pending?.productId === productId) {
          pending = null;
          clearTimeout(timeout);
          reject(new Error(e?.message || "Could not start purchase."));
        }
      });
  });
}

/**
/**
 * Verifies a purchase server-side. Returns false on any doubt.
 */
export async function verifyPurchase(result: PurchaseResult): Promise<boolean> {
  if (!result?.receipt) return false;

  // Server-side validation. The client cannot be trusted to say "I paid" —
  // on a rooted/jailbroken device that call is trivially spoofed, and it is
  // the only thing standing between a free tap and a paid tier. The edge
  // function forwards to Apple /verifyReceipt and Google
  // purchases.subscriptions.get with credentials that must never ship in the
  // bundle.
  const endpoint = `${SUPABASE_URL}/functions/v1/verify-purchase`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({
        platform: Platform.OS,
        productId: result.productId,
        transactionId: result.transactionId,
        receipt: result.receipt,
      }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json?.valid === true;
  } catch {
    // Network failure is NOT proof of payment. Failing closed means a user
    // with a real receipt and no signal has to retry or hit Restore; failing
    // open means anyone offline gets Elite. The first is an inconvenience,
    // the second is the bug this whole path exists to prevent.
    return false;
  }
}

/**
 * Restores previously-purchased non-consumables (tiers, wallpaper packs).
 * Required by App Store review — an app that sells non-consumables without a
 * restore path is rejected.
 */
export async function restorePurchases(): Promise<string[]> {
  await ensureConnection();
  const purchases = await iapModule.getAvailablePurchases();
  return (purchases || []).map((p: any) => p.productId).filter(Boolean);
}
