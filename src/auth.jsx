import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";

import { auth } from "./firebase";

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);

  async function handleSubmit() {
    try {
      let userCredential;

      if (signup) {
        userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
      } else {
        userCredential =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
      }

      onLogin(userCredential.user);

    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div style={{
      padding: 30,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      maxWidth: 400,
      margin: "50px auto"
    }}>

      <h2>
        {signup ? "Create Account" : "Login"}
      </h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button onClick={handleSubmit}>
        {signup ? "Signup" : "Login"}
      </button>

      <button
        onClick={() => setSignup(!signup)}
      >
        {signup
          ? "Already have account?"
          : "Create account"}
      </button>

    </div>
  );
}