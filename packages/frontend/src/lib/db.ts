// packages/frontend/src/lib/db.ts
import Dexie, { Table } from 'dexie';

// 1. Define shape for Cart Images
export interface CartAsset {
  id: string;       
  base64: string;   
  productId: string; 
}

// 2. Define shape for Chat Images
export interface AiChatImage {
  id: string;
  blob: Blob;
  createdAt: Date;
}

// 3. ✅ NEW: Define shape for App State (History)
export interface AppState {
  key: string; // e.g., 'backendHistory'
  value: any;  // The massive history object
}

export class AiChatDatabase extends Dexie {
  images!: Table<AiChatImage>; 
  cartAssets!: Table<CartAsset>; 
  appState!: Table<AppState>; // 👈 NEW TABLE

  constructor() {
    super('aurenAiChatDb'); 
    
    // Previous versions (kept for reference)
    this.version(2).stores({
      images: 'id, createdAt',
      cartAssets: 'id, productId' 
    });

    // ⚠️ VERSION 3: Adds the 'appState' table
    this.version(3).stores({
      images: 'id, createdAt',
      cartAssets: 'id, productId',
      appState: 'key' // 👈 Index by 'key'
    });
  }
}

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

export const db = new AiChatDatabase();