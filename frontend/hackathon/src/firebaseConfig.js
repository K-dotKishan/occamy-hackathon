// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Initialize Firebase
let app;
let auth;
let googleProvider;
let isFirebaseConfigured = false;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        isFirebaseConfigured = true;
    } else {
        console.warn("Firebase config missing. Using simulation mode.");
    }
} catch (error) {
    console.error("Firebase init failed:", error);
}

export { auth, googleProvider, isFirebaseConfigured };
export default app;
