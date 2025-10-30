import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

function initApp() {
  if (getApps().length) return getApps()[0];
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile && fs.existsSync(keyFile)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.GOOGLE_PROJECT_ID,
    });
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_PROJECT_ID,
  });
}

const app = initApp();
export const db = getFirestore(app, "auren");


