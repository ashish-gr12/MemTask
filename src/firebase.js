import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBz3a4c9j2PczbeDfls7EaQ8OZ6YxsZyx4",
  authDomain: "memtask-bf8af.firebaseapp.com",
  projectId: "memtask-bf8af",
  storageBucket: "memtask-bf8af.firebasestorage.app",
  messagingSenderId: "204066846471",
  appId: "1:204066846471:web:7f8f40038bbed40b42f7a2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);