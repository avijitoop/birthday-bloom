
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

// Firebase Configuration
firebase.initializeApp({
  apiKey: "AIzaSyA7COer_ou-QZqfUFcqoj2RirkAjzGVd3g",
  authDomain: "birthday-wish-reminder.firebaseapp.com",
  projectId: "birthday-wish-reminder",
  storageBucket: "birthday-wish-reminder.firebasestorage.app",
  messagingSenderId: "796679341307",
  appId: "1:796679341307:web:8cb9fe1479e037e8e59c5e"
});

const messaging = firebase.messaging();

// Background Notification
messaging.onBackgroundMessage((payload) => {
  const title =
    payload.data?.title ||
    payload.notification?.title ||
    "🎂 Birthday Bloom";

  const body =
    payload.data?.body ||
    payload.notification?.body ||
    "আপনার জন্য একটি বিশেষ Birthday Wish অপেক্ষা করছে! ❤️";

  const url = payload.data?.url || "./";

  return self.registration.showNotification(title, {
    body: body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "birthday-bloom",
    data: { url: url },
    vibrate: [200, 100, 200]
  });
});

// Notification Click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "./",
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});

// Service Worker Lifecycle
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
