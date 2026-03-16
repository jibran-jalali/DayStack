"use client";

import { getOneSignalEnv } from "@/lib/env";
import type { OneSignalSubscriptionState } from "@/types/daystack";

declare global {
  interface Window {
    OneSignal?: OneSignalClient;
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void>;
  }
}

interface OneSignalPushSubscription {
  id?: string | null;
  optedIn?: boolean;
  addEventListener?: (event: "change", listener: () => void) => void;
  removeEventListener?: (event: "change", listener: () => void) => void;
  optIn?: () => Promise<void>;
  optOut?: () => Promise<void>;
}

interface OneSignalNotifications {
  permission?: boolean;
  isPushSupported?: () => boolean;
  requestPermission?: () => Promise<void>;
}

interface OneSignalClient {
  init: (options: Record<string, unknown>) => Promise<void>;
  login?: (externalId: string) => Promise<void>;
  logout?: () => Promise<void>;
  Notifications?: OneSignalNotifications;
  User?: {
    PushSubscription?: OneSignalPushSubscription;
  };
}

let sdkScriptPromise: Promise<void> | null = null;
let readyPromise: Promise<OneSignalClient | null> | null = null;
let hasInitialized = false;

function createDefaultState(overrides?: Partial<OneSignalSubscriptionState>): OneSignalSubscriptionState {
  return {
    configured: Boolean(getOneSignalEnv()),
    permissionGranted: false,
    ready: false,
    supported: false,
    subscribed: false,
    subscriptionId: null,
    ...overrides,
  };
}

function ensureSdkScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.OneSignal) {
    return Promise.resolve();
  }

  if (sdkScriptPromise) {
    return sdkScriptPromise;
  }

  sdkScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-onesignal-sdk="true"]');

    if (existingScript) {
      if (window.OneSignal) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("The OneSignal SDK could not be loaded.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;
    script.defer = true;
    script.dataset.onesignalSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The OneSignal SDK could not be loaded."));
    document.head.appendChild(script);
  });

  return sdkScriptPromise;
}

function readState(oneSignal: OneSignalClient | null): OneSignalSubscriptionState {
  if (!oneSignal) {
    return createDefaultState();
  }

  const supported = oneSignal.Notifications?.isPushSupported?.() ?? false;
  const subscribed = oneSignal.User?.PushSubscription?.optedIn ?? false;

  return createDefaultState({
    permissionGranted: oneSignal.Notifications?.permission ?? false,
    ready: true,
    supported,
    subscribed,
    subscriptionId: oneSignal.User?.PushSubscription?.id ?? null,
  });
}

export async function ensureOneSignalReady() {
  if (typeof window === "undefined") {
    return null;
  }

  const oneSignalEnv = getOneSignalEnv();

  if (!oneSignalEnv) {
    return null;
  }

  if (readyPromise) {
    return readyPromise;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  readyPromise = new Promise<OneSignalClient | null>((resolve, reject) => {
    const initialize = async (oneSignal: OneSignalClient) => {
      try {
        if (!hasInitialized) {
          await oneSignal.init({
            appId: oneSignalEnv.appId,
            allowLocalhostAsSecureOrigin: process.env.NODE_ENV !== "production",
            autoResubscribe: true,
            notifyButton: {
              enable: false,
            },
            serviceWorkerPath: "/OneSignalSDKWorker.js",
            serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          });
          hasInitialized = true;
        }

        resolve(oneSignal);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("OneSignal could not be initialized."));
      }
    };

    if (window.OneSignal) {
      void initialize(window.OneSignal);
      return;
    }

    window.OneSignalDeferred?.push((oneSignal) => {
      void initialize(oneSignal);
    });
  });

  await ensureSdkScript();

  if (window.OneSignal && hasInitialized) {
    return window.OneSignal;
  }

  return readyPromise;
}

export async function getOneSignalState() {
  const oneSignal = await ensureOneSignalReady();
  return readState(oneSignal);
}

export async function loginOneSignalUser(externalId: string) {
  const oneSignal = await ensureOneSignalReady();

  if (!oneSignal?.login) {
    return readState(oneSignal);
  }

  await oneSignal.login(externalId);

  return readState(oneSignal);
}

export async function logoutOneSignalUser() {
  const oneSignal = await ensureOneSignalReady();

  if (!oneSignal?.logout) {
    return;
  }

  await oneSignal.logout();
}

export async function enableOneSignalPush() {
  const oneSignal = await ensureOneSignalReady();

  if (!oneSignal) {
    return createDefaultState();
  }

  if (oneSignal.Notifications?.isPushSupported?.() === false) {
    return readState(oneSignal);
  }

  if (!oneSignal.Notifications?.permission) {
    await oneSignal.Notifications?.requestPermission?.();
  }

  if (oneSignal.Notifications?.permission) {
    await oneSignal.User?.PushSubscription?.optIn?.();
  }

  return readState(oneSignal);
}

export async function disableOneSignalPush() {
  const oneSignal = await ensureOneSignalReady();

  if (!oneSignal) {
    return createDefaultState();
  }

  await oneSignal.User?.PushSubscription?.optOut?.();

  return readState(oneSignal);
}

export async function observeOneSignalState(onChange: (state: OneSignalSubscriptionState) => void) {
  const oneSignal = await ensureOneSignalReady();

  if (!oneSignal?.User?.PushSubscription?.addEventListener || !oneSignal.User.PushSubscription.removeEventListener) {
    return () => {};
  }

  const listener = () => {
    onChange(readState(oneSignal));
  };

  oneSignal.User.PushSubscription.addEventListener("change", listener);
  onChange(readState(oneSignal));

  return () => {
    oneSignal.User?.PushSubscription?.removeEventListener?.("change", listener);
  };
}
