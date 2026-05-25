import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6bTz26oGAguqwS07vVVb55doXz3wiQeo",
  authDomain: "lead-capture-ads.firebaseapp.com",
  projectId: "lead-capture-ads",
  storageBucket: "lead-capture-ads.firebasestorage.app",
  messagingSenderId: "710258670800",
  appId: "1:710258670800:web:3d81ccbe409af518e272d5",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.includes("ISI_")
);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const getTanggalServer = serverTimestamp;
export const leadsCollectionName = "leads";
