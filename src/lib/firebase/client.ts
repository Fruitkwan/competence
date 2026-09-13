"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyB6qaw0DxR3ErCSOFgFmnleq3EnUA8IYyI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "dhofar-global.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "dhofar-global",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "dhofar-global.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1028840396505",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:1028840396505:web:ff6a1ec9e9f07eb684d0c8",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-271E8C61RN",
};

let messagingPromise: Promise<Messaging | null> | null = null;

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseMessaging() {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => (supported ? getMessaging(getFirebaseApp()) : null))
      .catch(() => null);
  }

  return messagingPromise;
}

export async function requestFirebaseMessagingToken() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { error: "Push notifications are not supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { error: "Notification permission was not granted." };

  const messaging = await getFirebaseMessaging();
  if (!messaging) return { error: "Firebase messaging is not supported in this browser." };

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) return { error: "Firebase did not return a messaging token." };
  return { token };
}

export async function subscribeToForegroundMessages(
  handler: (payload: { title: string; body?: string; link?: string }) => void
) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;

  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title ?? "New notification",
      body: payload.notification?.body,
      link: payload.data?.link,
    });
  });
}
