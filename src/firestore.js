import {
  doc,
  setDoc,
  getDoc,
  onSnapshot
} from "firebase/firestore";

import { db } from "./firebase";

export async function saveShared(
  groupId,
  key,
  value
) {

  await setDoc(
    doc(db, "groups", groupId),
    {
      [key]: value
    },
    { merge: true }
  );
}

export async function loadShared(
  groupId
) {

  const snap =
    await getDoc(
      doc(db, "groups", groupId)
    );

  return snap.data();
}

export function subscribeShared(
  groupId,
  callback
) {

  return onSnapshot(
    doc(db, "groups", groupId),
    (snapshot) => {

      callback(snapshot.data());

    }
  );
}

export async function ensureGroupExists(
  groupId
) {

  const ref =
    doc(db, "groups", groupId);

  const snap =
    await getDoc(ref);

  if (!snap.exists()) {

    await setDoc(ref, {
      expenses: [],
      plans: [],
      water: [],
      members: []
    });

  }

}