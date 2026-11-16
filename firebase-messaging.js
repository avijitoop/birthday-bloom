
importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyA7COer_ou-QZqfUFcqoj2RirkAjzGVd3g",
  authDomain: "birthday-wish-reminder.firebaseapp.com",
  projectId: "birthday-wish-reminder",
  storageBucket: "birthday-wish-reminder.firebasestorage.app",
  messagingSenderId: "796679341307",
  appId: "1:796679341307:web:8cb9fe1479e037e8e59c5e"
});

const messaging = firebase.messaging();

// Receive background notification
messaging.onBackgroundMessage((payload) => {
  console.log("Background notification received:", payload);

  const title =
    payload.data?.title || "🎂 Happy Birthday!";

  const body =
    payload.data?.body ||
    "A special birthday wish is waiting for you!";

  const url =
    payload.data?.url || "./";

  self.registration.showNotification(title, {
    body: body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "birthday-bloom-notification",
    renotify: true,
    data: {
      url: url
    }
  });
});

// Open birthday wish when notification is clicked
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
