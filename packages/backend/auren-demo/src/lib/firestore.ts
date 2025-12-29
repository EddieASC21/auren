// src/lib/firestore.ts
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Initialize Firebase Admin app with proper authentication
function initApp() {
  // Return existing app if already initialized
  if (getApps().length) return getApps()[0];

  // Get the path to the service account key file
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // If service account key file exists, use it for authentication
  if (keyFile && fs.existsSync(keyFile)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.GOOGLE_PROJECT_ID, // optional
    });
  }

  // Fallback to ADC (works if you've run: gcloud auth application-default login)
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_PROJECT_ID,
  });
}

// Initialize the Firebase app and export the Firestore database instance
const app = initApp();
export const db = getFirestore(app);