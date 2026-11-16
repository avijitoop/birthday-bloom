
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7COer_ou-QZqfUFcqoj2RirkAjzGVd3g",
  authDomain: "birthday-wish-reminder.firebaseapp.com",
  projectId: "birthday-wish-reminder",
  storageBucket: "birthday-wish-reminder.firebasestorage.app",
  messagingSenderId: "796679341307",
  appId: "1:796679341307:web:8cb9fe1479e037e8e59c5e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
