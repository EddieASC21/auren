// packages/frontend/src/lib/db.ts
import Dexie, { Table } from 'dexie';

// Define the shape of the data we'll store
export interface AiChatImage {
  id: string;     // A unique ID we create (from nanoid)
  blob: Blob;     // The raw image data (the "file")
  createdAt: Date;
}

export class AiChatDatabase extends Dexie {
  // 'images' is the name of our "table" or "filing cabinet"
  images!: Table<AiChatImage>; 

  constructor() {
    super('aurenAiChatDb'); // The name of the whole database
    this.version(1).stores({
      // This defines the structure. 'id' is the unique primary key.
      images: 'id, createdAt'
    });
  }
}

// Create a single, reusable instance of the database
export const db = new AiChatDatabase();

// --- Helper function to convert a Blob to Base64 ---
// We need this to send data to the OpenAI API
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
}