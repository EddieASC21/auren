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

// 4. ✅ NEW: Define shape for Design Snapshots (LCP optimization)
export interface DesignSnapshot {
  productId: string;  // Unique ID for the design
  frontSnapshot?: string; // data URL of front snapshot
  backSnapshot?: string;  // data URL of back snapshot
  timestamp: number; // When it was cached
}

// 5. ✅ NEW: Define shape for Design Data (migrated from localStorage)
export interface Design {
  productId: string;           // Primary key
  designData: any;             // Full design state (frontUploadedImages, backUploadedImages, etc.)
  sessionId?: string;          // design_session mapping
  justEdited?: boolean;        // edit flag
  updatedAt: number;           // timestamp
}

// 6. ✅ NEW: Define shape for Order Data (migrated from localStorage)
export interface Order {
  productId: string;           // Primary key
  orderData?: any;             // Order quantities, sizes, etc.
  orderMeta?: any;             // Metadata (hasUserAddedLogo, etc.)
  chatHistory?: any[];         // Order chat history
  resetPayload?: any;          // Reset flag data
  aiApprovedNext?: boolean;    // AI approval flag
  updatedAt: number;           // timestamp
}

export class AiChatDatabase extends Dexie {
  images!: Table<AiChatImage>;
  cartAssets!: Table<CartAsset>;
  appState!: Table<AppState>;
  snapshots!: Table<DesignSnapshot>;
  designs!: Table<Design>;   // NEW: Design data (migrated from localStorage)
  orders!: Table<Order>;     // NEW: Order data (migrated from localStorage)

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
      appState: 'key'
    });

    // ⚠️ VERSION 4: Adds the 'snapshots' table for caching design previews
    this.version(4).stores({
      images: 'id, createdAt',
      cartAssets: 'id, productId',
      appState: 'key',
      snapshots: 'productId, timestamp'
    });

    // ⚠️ VERSION 5: Adds 'designs' and 'orders' tables (migrated from localStorage)
    this.version(5).stores({
      images: 'id, createdAt',
      cartAssets: 'id, productId',
      appState: 'key',
      snapshots: 'productId, timestamp',
      designs: 'productId, updatedAt',  // NEW
      orders: 'productId, updatedAt',   // NEW
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

// Lazy initialization - only create DB when actually needed
let dbInstance: AiChatDatabase | null = null;

export function getDb(): AiChatDatabase {
  if (!dbInstance) {
    dbInstance = new AiChatDatabase();
  }
  return dbInstance;
}

// For backwards compatibility, but using lazy getter
export const db = new Proxy({} as AiChatDatabase, {
  get(_target, prop) {
    return getDb()[prop as keyof AiChatDatabase];
  }
});

// Cleanup utility for expired data (helps with bfcache)
export async function clearExpiredData() {
  try {
    // Don't initialize if no instance exists - avoid creating DB just to clean it
    if (!dbInstance) {
      
      return;
    }

    // Check if database is still open before attempting operations
    if (!dbInstance.isOpen()) {
      
      return;
    }

    const now = Date.now();
    const expiry = 30 * 24 * 60 * 60 * 1000; // 30 days (increased from 7 to preserve user data longer)

    // Clear ONLY old chat images (temporary AI chat images)
    // Keep cartAssets and appState indefinitely as they are user data
    const deleted = await dbInstance.images
      .where('createdAt')
      .below(new Date(now - expiry))
      .delete();

    if (deleted > 0) {
      
    }
  } catch (error) {
    // Silently handle DatabaseClosedError - it's expected during cleanup
    // This can happen in Safari when the page unloads quickly
    if (error instanceof Error && error.name === 'DatabaseClosedError') {
      // Don't log anything - this is completely normal and expected
      return;
    }
    // Only log unexpected errors
    console.error('Unexpected error during cleanup:', error);
  }
}

// Proper cleanup for bfcache compatibility
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ✅ Snapshot Cache Helpers (for LCP optimization)
export async function cacheSnapshot(
  productId: string,
  frontSnapshot?: string,
  backSnapshot?: string
): Promise<void> {
  try {
    const db = getDb();
    await db.snapshots.put({
      productId,
      frontSnapshot,
      backSnapshot,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[db] Failed to cache snapshot:', error);
  }
}

export async function getCachedSnapshot(
  productId: string
): Promise<DesignSnapshot | undefined> {
  try {
    const db = getDb();
    return await db.snapshots.get(productId);
  } catch (error) {
    console.error('[db] Failed to get cached snapshot:', error);
    return undefined;
  }
}

export async function deleteCachedSnapshot(productId: string): Promise<void> {
  try {
    const db = getDb();
    await db.snapshots.delete(productId);
  } catch (error) {
    console.error('[db] Failed to delete cached snapshot:', error);
  }
}

export async function clearOldSnapshots(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    if (!dbInstance || !dbInstance.isOpen()) return;

    const cutoff = Date.now() - maxAgeMs;
    const deleted = await dbInstance.snapshots
      .where('timestamp')
      .below(cutoff)
      .delete();

    if (deleted > 0) {

    }
  } catch (error) {
    if (error instanceof Error && error.name === 'DatabaseClosedError') {
      return;
    }
    console.error('[db] Failed to clear old snapshots:', error);
  }
}

// ============================================
// Design CRUD Helpers (migrated from localStorage)
// ============================================

/**
 * Resolves sessionId from multiple sources in priority order:
 * 1. Explicitly passed sessionId
 * 2. Existing Dexie design record
 * 3. localStorage design_session_${productId}
 * 4. localStorage asset_session_${productId}
 * 5. localStorage aiChat_sessionId (global)
 */
async function resolveSessionId(
  productId: string,
  explicitSessionId?: string
): Promise<string | undefined> {
  // 1. Explicit takes priority
  if (explicitSessionId) return explicitSessionId;

  // 2. Check existing Dexie record
  try {
    const db = getDb();
    const existing = await db.designs.get(productId);
    if (existing?.sessionId) return existing.sessionId;
  } catch {
    // Continue to localStorage fallbacks
  }

  // 3-5. Check localStorage patterns (only in browser)
  if (typeof window !== 'undefined') {
    // design_session_${productId} (from chat-box)
    const designSession = window.localStorage.getItem(`design_session_${productId}`);
    if (designSession) return designSession;

    // asset_session_${productId} (from design page)
    const assetSession = window.localStorage.getItem(`asset_session_${productId}`);
    if (assetSession) return assetSession;

    // aiChat_sessionId (global fallback)
    const globalSession = window.localStorage.getItem('aiChat_sessionId');
    if (globalSession) return globalSession;
  }

  return undefined;
}

export async function saveDesign(
  productId: string,
  designData: any,
  options?: { sessionId?: string; justEdited?: boolean }
): Promise<void> {
  try {
    const db = getDb();

    // Auto-resolve sessionId if not explicitly provided
    const resolvedSessionId = await resolveSessionId(productId, options?.sessionId);

    await db.designs.put({
      productId,
      designData,
      sessionId: resolvedSessionId,
      justEdited: options?.justEdited,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[db] Failed to save design:', error);
  }
}

export async function getDesign(productId: string): Promise<Design | undefined> {
  try {
    const db = getDb();
    return await db.designs.get(productId);
  } catch (error) {
    console.error('[db] Failed to get design:', error);
    return undefined;
  }
}

/**
 * Gets the sessionId for a design, checking Dexie first then localStorage fallbacks.
 * This is the unified way to retrieve session IDs after migration.
 */
export async function getDesignSessionId(productId: string): Promise<string | undefined> {
  // 1. Check Dexie first
  try {
    const db = getDb();
    const design = await db.designs.get(productId);
    if (design?.sessionId) return design.sessionId;
  } catch {
    // Continue to localStorage fallbacks
  }

  // 2-4. Check localStorage patterns (only in browser)
  if (typeof window !== 'undefined') {
    // design_session_${productId} (from chat-box)
    const designSession = window.localStorage.getItem(`design_session_${productId}`);
    if (designSession) return designSession;

    // asset_session_${productId} (from design page)
    const assetSession = window.localStorage.getItem(`asset_session_${productId}`);
    if (assetSession) return assetSession;

    // aiChat_sessionId (global fallback)
    const globalSession = window.localStorage.getItem('aiChat_sessionId');
    if (globalSession) return globalSession;
  }

  return undefined;
}

export async function deleteDesign(productId: string): Promise<void> {
  try {
    const db = getDb();
    await db.designs.delete(productId);
  } catch (error) {
    console.error('[db] Failed to delete design:', error);
  }
}

export async function getAllDesigns(): Promise<Design[]> {
  try {
    const db = getDb();
    return await db.designs.toArray();
  } catch (error) {
    console.error('[db] Failed to get all designs:', error);
    return [];
  }
}

export async function markDesignEdited(productId: string, edited: boolean): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.designs.get(productId);
    if (existing) {
      await db.designs.update(productId, { justEdited: edited, updatedAt: Date.now() });
    }
  } catch (error) {
    console.error('[db] Failed to mark design edited:', error);
  }
}

// ============================================
// Order CRUD Helpers (migrated from localStorage)
// ============================================

export async function saveOrder(
  productId: string,
  data: {
    orderData?: any;
    orderMeta?: any;
    chatHistory?: any[];
    resetPayload?: any;
    aiApprovedNext?: boolean;
  }
): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.orders.get(productId);
    await db.orders.put({
      productId,
      orderData: data.orderData ?? existing?.orderData,
      orderMeta: data.orderMeta ?? existing?.orderMeta,
      chatHistory: data.chatHistory ?? existing?.chatHistory,
      resetPayload: data.resetPayload ?? existing?.resetPayload,
      aiApprovedNext: data.aiApprovedNext ?? existing?.aiApprovedNext,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[db] Failed to save order:', error);
  }
}

export async function getOrder(productId: string): Promise<Order | undefined> {
  try {
    const db = getDb();
    return await db.orders.get(productId);
  } catch (error) {
    console.error('[db] Failed to get order:', error);
    return undefined;
  }
}

export async function deleteOrder(productId: string): Promise<void> {
  try {
    const db = getDb();
    await db.orders.delete(productId);
  } catch (error) {
    console.error('[db] Failed to delete order:', error);
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const db = getDb();
    return await db.orders.toArray();
  } catch (error) {
    console.error('[db] Failed to get all orders:', error);
    return [];
  }
}

export async function clearOrderResetPayload(productId: string): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.orders.get(productId);
    if (existing) {
      await db.orders.update(productId, { resetPayload: undefined, updatedAt: Date.now() });
    }
  } catch (error) {
    console.error('[db] Failed to clear order reset payload:', error);
  }
}

export async function clearOrderChatHistory(productId: string): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.orders.get(productId);
    if (existing) {
      await db.orders.update(productId, { chatHistory: undefined, updatedAt: Date.now() });
    }
  } catch (error) {
    console.error('[db] Failed to clear order chat history:', error);
  }
}

// ============================================
// AppState Helpers
// ============================================

export async function getAppState(key: string): Promise<AppState | undefined> {
  try {
    const db = getDb();
    return await db.appState.get(key);
  } catch (error) {
    console.error('[db] Failed to get app state:', error);
    return undefined;
  }
}

export async function setAppState(key: string, value: any): Promise<void> {
  try {
    const db = getDb();
    await db.appState.put({ key, value });
  } catch (error) {
    console.error('[db] Failed to set app state:', error);
  }
}

// ============================================
// Migration Helper (localStorage → Dexie)
// ============================================

export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = getDb();

    // Check if already migrated
    const migrationState = await db.appState.get('localStorage_migrated');
    if (migrationState?.value === true) {
      return;
    }

    console.log('[db] Starting localStorage → Dexie migration...');

    // Migrate designData_* keys
    const designKeys = Object.keys(localStorage).filter(k => k.startsWith('designData_'));
    for (const key of designKeys) {
      const productId = key.replace('designData_', '');
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const designData = JSON.parse(raw);
        // Check both session key patterns: design_session_* (chat-box) and asset_session_* (design page)
        const sessionId = localStorage.getItem(`design_session_${productId}`)
          || localStorage.getItem(`asset_session_${productId}`)
          || undefined;
        const justEdited = localStorage.getItem(`justEdited_${productId}`) === 'true';

        await db.designs.put({
          productId,
          designData,
          sessionId,
          justEdited,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn(`[db] Failed to migrate design ${productId}:`, e);
      }
    }

    // Backfill sessionIds for existing Dexie designs that don't have one
    const allDesigns = await db.designs.toArray();
    for (const design of allDesigns) {
      if (!design.sessionId) {
        const sessionId = localStorage.getItem(`design_session_${design.productId}`)
          || localStorage.getItem(`asset_session_${design.productId}`)
          || undefined;
        if (sessionId) {
          await db.designs.update(design.productId, { sessionId });
        }
      }
    }

    // Migrate orderData_* and orderMeta_* keys
    const orderKeys = Object.keys(localStorage).filter(k => k.startsWith('orderData_'));
    for (const key of orderKeys) {
      const productId = key.replace('orderData_', '');
      const orderRaw = localStorage.getItem(key);
      const metaRaw = localStorage.getItem(`orderMeta_${productId}`);
      const chatRaw = localStorage.getItem(`orderChatHistory_${productId}`);
      const resetRaw = localStorage.getItem(`orderChatReset_${productId}`);
      const aiApproved = localStorage.getItem(`aiApprovedNext_${productId}`) === 'true';

      try {
        await db.orders.put({
          productId,
          orderData: orderRaw ? JSON.parse(orderRaw) : undefined,
          orderMeta: metaRaw ? JSON.parse(metaRaw) : undefined,
          chatHistory: chatRaw ? JSON.parse(chatRaw) : undefined,
          resetPayload: resetRaw ? JSON.parse(resetRaw) : undefined,
          aiApprovedNext: aiApproved || undefined,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn(`[db] Failed to migrate order ${productId}:`, e);
      }
    }

    // Migrate snapshot_* keys to snapshots table (if not already there)
    const snapshotFrontKeys = Object.keys(localStorage).filter(k => k.startsWith('snapshot_front_'));
    for (const key of snapshotFrontKeys) {
      const productId = key.replace('snapshot_front_', '');
      const frontSnap = localStorage.getItem(key);
      const backSnap = localStorage.getItem(`snapshot_back_${productId}`);
      const previewFront = localStorage.getItem(`snapshot_preview_front_${productId}`);
      const previewBack = localStorage.getItem(`snapshot_preview_back_${productId}`);

      // Prefer preview (data URL) over pointer (dexie:)
      const frontValue = previewFront || frontSnap;
      const backValue = previewBack || backSnap;

      if (frontValue || backValue) {
        try {
          const existing = await db.snapshots.get(productId);
          if (!existing) {
            await db.snapshots.put({
              productId,
              frontSnapshot: frontValue || undefined,
              backSnapshot: backValue || undefined,
              timestamp: Date.now(),
            });
          }
        } catch (e) {
          console.warn(`[db] Failed to migrate snapshot ${productId}:`, e);
        }
      }
    }

    // Mark migration as complete
    await db.appState.put({ key: 'localStorage_migrated', value: true });
    console.log('[db] Migration complete!');

  } catch (error) {
    console.error('[db] Migration failed:', error);
  }
}