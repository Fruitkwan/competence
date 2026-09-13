importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyB6qaw0DxR3ErCSOFgFmnleq3EnUA8IYyI",
  authDomain: "dhofar-global.firebaseapp.com",
  projectId: "dhofar-global",
  storageBucket: "dhofar-global.firebasestorage.app",
  messagingSenderId: "1028840396505",
  appId: "1:1028840396505:web:ff6a1ec9e9f07eb684d0c8",
  measurementId: "G-271E8C61RN",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Dhofar Global";
  const options = {
    body: payload.notification?.body || payload.data?.body,
    icon: "/logo.jpg",
    data: {
      link: payload.data?.link || "/notifications",
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/notifications";
  event.waitUntil(clients.openWindow(link));
});
