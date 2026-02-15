importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCCAjAyB0OP2L_ecrcHwUwirCunj45C3JI",
  authDomain: "offline-f2c69.firebaseapp.com",
  projectId: "offline-f2c69",
  storageBucket: "offline-f2c69.firebasestorage.app",
  messagingSenderId: "113613687305",
  appId: "1:113613687305:web:3a91297ca852ddbc1006d8",
  measurementId: "G-W4FP77PZ6K"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});