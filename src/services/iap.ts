import { Platform } from "react-native";

export const IAP_PRODUCTS = ["collider.pro.monthly", "collider.elite.monthly", "collider.wallpaper.pack"];

export async function purchaseProduct(productId: string) {
  if (Platform.OS === "web") throw new Error("IAP is available in native iOS/Android builds.");
  const iap = await import("react-native-iap");
  await iap.initConnection();
  try {
    await iap.requestPurchase({ request: { ios: { sku: productId }, android: { skus: [productId] } } } as any);
  } finally {
    await iap.endConnection();
  }
}
