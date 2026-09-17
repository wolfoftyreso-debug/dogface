import { registerPlugin } from "@capacitor/core";
import { APPLE_PRODUCT_ID } from "./apple-iap-ids";

type IapPlugin = {
  purchase(options: { productId: string }): Promise<{ jws: string }>;
  restore(): Promise<{ jwsList: string[] }>;
};

const Iap = registerPlugin<IapPlugin>("Iap", {
  web: {
    purchase: async () => {
      throw new Error("web");
    },
    restore: async () => ({ jwsList: [] }),
  },
});

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export async function nativePurchasePack(): Promise<{ jws: string }> {
  return Iap.purchase({ productId: APPLE_PRODUCT_ID });
}

export async function nativeRestorePurchases(): Promise<string[]> {
  const result = await Iap.restore();
  return Array.isArray(result.jwsList) ? result.jwsList : [];
}
