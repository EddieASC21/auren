# Auren

**AI-powered custom apparel platform.** Users design products through conversational AI or a manual canvas editor, then order through a full e-commerce checkout flow with Stripe.

Live at [auren.co](https://auren.co)

---

## High-Level Architecture

```
                         ┌──────────────────────┐
                         │     auren.co          │
                         │   (Next.js Frontend)  │
                         │     Cloud Run         │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
              ┌─────▼─────┐  ┌─────▼──────┐  ┌──────▼──────┐
              │  Backend   │  │   Stripe   │  │   GCS CDN   │
              │  API       │  │  Checkout  │  │   (Images)  │
              │  Cloud Run │  │  Webhooks  │  │             │
              └─────┬──────┘  └────────────┘  └─────────────┘
                    │
        ┌───────────┼──────────────┐
        │           │              │
  ┌─────▼────┐ ┌───▼────┐  ┌──────▼──────┐
  │ Firestore│ │  GCS   │  │  AI APIs    │
  │ (9 coll.)│ │ Bucket │  │ Gemini +    │
  │          │ │        │  │ OpenAI      │
  └──────────┘ └────────┘  └─────────────┘
```

### Why This Shape

**Monorepo, two Next.js apps.** Frontend and backend are separate packages deployed to separate Cloud Run services. The split exists because:
- The frontend is a static-heavy marketing + e-commerce site (Next.js 14, React 18). It needs fast page loads, aggressive caching, and small bundles.
- The backend runs heavy AI workloads (image generation, Sharp processing) that would blow up cold start times if bundled with the frontend. It's Next.js 16 / React 19 with Node.js runtime for `sharp` and `openai` SDK compatibility.
- Independent scaling: AI generation can spike CPU/memory independently from the storefront.

**GCP-native.** Firestore, Cloud Storage, and Cloud Run were chosen because the AI pipeline already requires GCP for Vertex AI / Gemini access. Keeping everything on one cloud avoids cross-provider latency and simplifies credentials.

---

## Project Structure

```
auren/
├── README.md                          ← you are here
├── docs/
│   ├── database_explained.md          ← full database schema reference
│   └── plans/                         ← design docs for features
├── packages/
│   ├── frontend/                      ← Next.js 14 storefront
│   │   ├── src/
│   │   │   ├── app/                   ← pages (App Router)
│   │   │   ├── components/            ← shared UI components
│   │   │   ├── hooks/                 ← custom React hooks
│   │   │   ├── lib/                   ← utilities, DB, CDN helpers
│   │   │   └── utils/                 ← session management
│   │   ├── middleware.ts              ← bot/vuln-scan blocking
│   │   └── tailwind.config.ts
│   └── backend/
│       └── auren-demo/               ← Next.js 16 API server
│           ├── src/
│           │   ├── app/api/           ← all API routes
│           │   └── lib/               ← shared backend libraries
│           └── middleware.ts          ← bot blocking (same pattern)
```

---

## User Flow

```
Landing Page  →  Catalog (pick product)  →  Design Page (canvas editor)
                                              ↕
                                         Chat Box (AI design)
                                              ↓
                                      Order Quantity (sizes, qty)
                                              ↓
                                      Product Showcase (cart review)
                                              ↓
                                      Checkout (Stripe)
                                              ↓
                                      Success / Thank You
```

There are two parallel design paths. The user can switch between them freely:

1. **AI Chat Path** (`/chat-box`): Conversational AI generates product mockups. The user describes what they want, the AI generates images, and they iterate through chat. Goes through the product-chat API.
2. **Manual Design Path** (`/design`): A canvas editor where users upload logos, add text, position elements, pick colors. No AI involved in the rendering — the user drags and drops.

Both paths converge at `/order-quantity` where the user picks sizes and quantities, then proceed to cart and checkout.

---

## Frontend Deep Dive

### Tech Stack
- **Next.js 14** with App Router
- **React 18** (not 19 — needed for stable Dexie.js and framer-motion compatibility)
- **Tailwind CSS** with custom Auren color palette (`auren-black`, `auren-tan`, `auren-cream`)
- **Framer Motion** for page transitions and micro-interactions
- **Dexie.js** (IndexedDB wrapper) for client-side persistence
- **reCAPTCHA v3** on all forms

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page — hero video, how-it-works, FAQ, newsletter signup |
| `/catalog` | Entry point — two cards: "Start Making" (catalog) or "Start from Scratch" (AI) |
| `/picking` | Product grid — filter by mens/womens/other, shows live pricing |
| `/design` | Canvas editor — drag/drop logos, text, color picker, front/back sides |
| `/chat-box` | AI design chat — conversational mockup generation with Gemini |
| `/order-quantity` | Size breakdown, quantity input, AI order assistant |
| `/product-showcase` | Cart review — all designed products with snapshots |
| `/checkout` | Stripe Checkout redirect (server-side session creation) |
| `/success` | Post-payment confirmation |
| `/thankyou` | Thank you page |
| `/contact` | Contact form with multi-layer spam protection |
| `/manual-order` | Custom/bulk order request form for non-standard orders |
| `/admin` | Protected admin dashboard (JWT auth) — orders, payments, contacts, newsletter |
| `/admin/conversations` | Admin conversation history viewer — replay AI chat sessions |

### Performance Decisions

**Lazy loading everything below the fold.** The landing page uses a custom `LazyOnView` component (IntersectionObserver) to defer loading of `GetStartedSection`, `HowItWorksSection`, `FinalCtaSection`, and `FooterWithFaq`. Each is `dynamic()` imported with `ssr: false`. This keeps the initial JS bundle minimal — the hero section loads instantly.

**Video background with progressive enhancement.** The `VideoBackground` component:
1. Renders a responsive `<picture>` element immediately (mobile/tablet/desktop poster variants in WebP)
2. Defers video loading until after the page is idle (`requestIdleCallback`)
3. Only reveals the video after user interaction (scroll/click/touch) to avoid wasting bandwidth
4. Respects `prefers-reduced-motion` — shows static image only
5. Disables all animations on mobile (`max-width: 767px`) to avoid jank

**IndexedDB over localStorage.** Originally the app stored design state, order data, and snapshots in localStorage. This hit the 5MB limit fast with base64 images. Migrated to Dexie.js (IndexedDB) which has effectively unlimited storage. The `StorageMigration` component runs on app load to migrate any remaining localStorage data. The Dexie schema is versioned (currently v5) so migrations are additive and non-destructive.

**Snapshot caching for LCP.** When a design is saved, a compressed snapshot is cached in IndexedDB. On the next page load, the snapshot renders immediately while the full-resolution image loads from GCS. This dramatically improves Largest Contentful Paint on the order-quantity and product-showcase pages.

**CDN asset management.** All static assets (product images, logos, posters) go through a centralized `cdn-assets.ts` module. In production, a Cloud Run image-cdn service resizes/optimizes images on the fly. The CDN base URL is injected at build time via `NEXT_PUBLIC_IMAGE_CDN_URL` and set as a global `window.__AUREN_CDN_BASE__` for runtime access.

**WebP images.** All apparel product images are served as WebP (50-70% smaller than PNG). The product catalog (`products-data.ts`) defines 38 products across mens, womens, and other items categories.

**Clean URL navigation.** Instead of passing state through query params (which look messy and break on refresh), the `useCleanNavigation` hook stores navigation params in sessionStorage, then the destination page reads them via `useNavigationParams`. The URL is immediately cleaned after params are read. Deep links still work because the hook falls back to URL params.

### Design Page Architecture

The design page (`/design`) is the most complex frontend component. It's dynamically imported with a loading skeleton and structured as:

```
DesignPageClient
├── Canvas (HTML5 canvas-like div with absolute positioning)
│   ├── Product base image (with front/back mask overlays)
│   ├── Uploaded images (draggable, resizable, rotatable)
│   └── Text elements (draggable, resizable, rotatable, editable)
├── Toolbar (color picker, text tools, upload, undo)
├── AI Asset Chat sidebar (generate logos via conversation)
└── Side selector (front/back toggle)
```

Design data uses **normalized coordinates** (0-1 range relative to canvas) so designs are resolution-independent. This was important because the canvas renders at different sizes on different screens but the final export needs consistent positioning.

### Client-Side Database (Dexie / IndexedDB)

Database name: `aurenAiChatDb`, schema version 5.

| Table | Key | Purpose |
|-------|-----|---------|
| `images` | `id` | Temporary AI-generated image cache (30-day TTL) |
| `cartAssets` | `id` | Cart item images persisted across sessions |
| `appState` | `key` | Global flags (migration status, etc.) |
| `snapshots` | `productId` | LCP-optimized design preview thumbnails |
| `designs` | `productId` | Full design state per product (migrated from localStorage) |
| `orders` | `productId` | Client-side order state (quantities, sizes, AI approval) |

The `db.ts` module uses lazy initialization via a Proxy so the database isn't created until first access, and includes `closeDb()` for bfcache compatibility in Safari.

---

## Backend Deep Dive

### Tech Stack
- **Next.js 16** with App Router API routes
- **Google Gemini** (`@google/genai`) for product mockup generation
- **OpenAI** (`gpt-image-1.5`) for logo/asset generation with native transparency
- **Sharp** for image processing (matting, cropping, compositing)
- **Firestore** for all persistent data
- **Google Cloud Storage** for generated images
- **Stripe** for payment processing
- **Nodemailer** (Gmail SMTP) for transactional emails
- **Upstash Redis** for production rate limiting (in-memory fallback for dev)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/product-chat` | POST | AI product mockup generation (Gemini) |
| `/api/asset-chat` | POST | AI logo/asset generation (OpenAI or Gemini) |
| `/api/design-session` | GET/POST/DELETE | CRUD for design session state in Firestore |
| `/api/pricing/quote` | POST | Server-side price calculation |
| `/api/pricing/batch` | POST | Batch pricing for multiple products |
| `/api/checkout` | POST | Create Stripe checkout session |
| `/api/send-design` | POST | Email design to customer |
| `/api/contact` | POST | Contact form submission |
| `/api/newsletter` | POST | Newsletter signup |
| `/api/manual-order` | POST | Custom/bulk order request |
| `/api/admin/orders` | GET | Admin dashboard data (all collections) |
| `/api/admin/conversations` | GET | Admin conversation history |
| `/api/admin/login` | POST | Admin JWT authentication |
| `/api/admin/logout` | POST | Clear admin session |
| `/api/client-error` | POST | Frontend error logging |
| `/api/test-email` | POST | Email delivery testing |

### AI Image Generation Pipeline

This is the most technically complex part of the system. There are two distinct pipelines:

#### Product Mockups (Gemini)

The product-chat route generates full product mockups (e.g., a t-shirt with a logo on it). Gemini is used because it handles multi-turn conversations well and can generate images that incorporate reference images (uploaded logos, previous designs).

The conversational AI:
- Maintains session state in Firestore (up to 60 stored turns, 12 sent to AI)
- Tracks active side (front/back) independently
- Auto-reattaches the last uploaded logo when the user sends follow-up messages
- Has guardrails for back-view intent (generates blank back unless user explicitly requests design carry-over)
- Uses "edit-like" prompting when anchoring to a previous image

#### Logo/Asset Generation (OpenAI + Gemini Fallback)

The asset-chat route generates standalone logos and graphics on transparent backgrounds. This uses a **dual-provider strategy**:

**Primary: OpenAI gpt-image-1.5** — Has native transparency support. Generates transparent PNGs directly. Simpler, faster, better quality for logos.

**Fallback: Gemini 2-Pass Matting** — A custom transparency pipeline when OpenAI is unavailable:

```
Pass 1: Generate asset on pure WHITE background (#FFFFFF)
Pass 2: Generate SAME asset on pure BLACK background (#000000)
                    ↓
    Linear-space difference matting
                    ↓
    Edge background snapping + drift scoring
                    ↓
    Quality validation (black mask sanity check)
                    ↓
    Crop to alpha + balanced padding
                    ↓
    Clean transparent PNG
```

The matting pipeline (`logoMatting.ts`) works in linear color space (sRGB → linear conversion) and uses:
- Multi-scale edge detection for sharp alpha boundaries
- Background color snapping from image edges
- Drift scoring to detect when the AI changed the subject between passes
- Morphological cleanup for noise removal
- A quality gate that falls back to edge-matte-from-white if the two-pass matte fails

This was built because neither Gemini nor most image models output true transparency. The two-pass approach (white bg → black bg → difference) is a classical matting technique adapted for AI-generated images.

### Pricing System

Server-side pricing in `lib/pricing/pricing.ts`. Prices are stored in cents to avoid floating-point issues.

- **Catalog pricing**: Fixed base price per product category/name (e.g., mens t-shirt = $14.00)
- **Volume discounts**: Threshold-based discounts at 50, 75, 100, 150, 500 units (stored as `discountsCents` maps)
- **Custom product markup**: Products designed through AI chat get a 10% "catalog_markup" applied at checkout
- **Tax**: Flat 8% applied via Stripe tax rates (labeled "Tax, Shipping, and Handling")

The pricing API has both single-quote and batch endpoints so the catalog page can fetch prices for all visible products in one request.

### Stripe Integration

Full checkout flow:
1. Frontend sends cart items to `/api/checkout`
2. Backend re-prices everything server-side (never trusts client prices)
3. Uploads design snapshots to GCS for permanent storage
4. Creates a Firestore `orders` document with status `pending_payment`
5. Creates a Stripe Checkout Session with line items, tax rates, and promo code support
6. On successful payment, Stripe webhook (`/api/webhook/stripe`) moves the order to `orders_confirmed` and creates a `payments` record
7. Confirmation emails sent to customer and admin

### Spam Protection (Defense in Depth)

The contact form has 6 layers of protection. This was necessary because the form was getting hammered by bots within days of launch:

1. **reCAPTCHA v3** — Score-based bot detection (threshold: 0.5)
2. **Honeypot field** — Hidden `faxNumber` field that bots auto-fill
3. **Timing check** — Rejects submissions faster than 3 seconds (bots submit instantly)
4. **Gibberish detection** — Checks for consecutive consonants, low vowel ratio, and random strings
5. **Email verification** — ZeroBounce API for validation, falls back to MX record check when quota exhausted
6. **Rate limiting** — 3 requests/minute per IP

All bot rejections return fake `{ ok: true }` responses so bots don't know they were caught.

### Rate Limiting

Configurable per-route rate limiting with two backends:
- **Upstash Redis** in production (free tier: 10K requests/day)
- **In-memory Map** for development and as automatic fallback

Preset tiers:
| Tier | Limit | Use Case |
|------|-------|----------|
| `AI_STRICT` | 5/min | Image generation (expensive) |
| `AI_MODERATE` | 10/min | AI text operations |
| `CHECKOUT` | 5/min | Payment operations |
| `EMAIL` | 3/min | Email sending |
| `SESSION_READ` | 60/min | Session data reads |
| `SESSION_WRITE` | 20/min | Session data writes |
| `CONTACT` | 3/min | Contact form |

### Email System

Centralized in `lib/email.ts` with:
- **Retry logic** — 3 attempts with exponential backoff (1s, 2s, 4s)
- **Failure logging** — Failed emails logged to Firestore `emailFailures` collection for review
- **Non-retryable detection** — Stops retrying on auth errors or invalid recipients
- **Admin notifications** — Standardized Auren-branded email template for all admin alerts
- **Gmail SMTP** via Nodemailer (App Password)

### Security

**Middleware bot blocking** — Both frontend and backend have identical middleware that blocks common vulnerability scans (WordPress probes, path traversal, PHP/ASP file requests, etc.) at the edge before hitting any route handler.

**CORS** — Strict origin allowlisting (`localhost:3000`, `auren.co`, `www.auren.co`). No wildcard origins. Credentials mode enabled.

**Admin auth** — JWT tokens stored in HTTP-only cookies. Login endpoint validates against admin credentials, issues a signed JWT. All admin routes verify the JWT before returning data.

**Server-side pricing** — Prices are never computed on the client. The checkout endpoint re-calculates everything from the server-side pricing table to prevent price manipulation.

---

## Database Architecture

See [`docs/database_explained.md`](docs/database_explained.md) for the complete schema reference.

### Summary

| Storage | Type | Location | Collections/Tables |
|---------|------|----------|--------------------|
| **Firestore** | Document DB | GCP | 9 collections (designSessions, assetSessions, orders, orders_confirmed, orders_draft, payments, contactMessages, newsletterSubscribers, manualOrderRequests) |
| **IndexedDB** | Key-Value | Browser | 6 tables via Dexie.js (images, cartAssets, appState, snapshots, designs, orders) |
| **GCS** | Object Storage | GCP | 1 bucket (`auren-user-designs`) with sessions/, asset-sessions/, manual-orders/ |

### Image Lifecycle

```
User requests design in chat
        ↓
AI generates PNG (OpenAI or Gemini)
        ↓
Backend processes (matting, cropping, compositing via Sharp)
        ↓
Upload to GCS → get public URL (1-year cache-control)
        ↓
Store URL in Firestore session
        ↓
Return URL to frontend
        ↓
Frontend caches in IndexedDB (optional, for offline/LCP)
        ↓
Image served from GCS CDN on subsequent loads
```

---

## Key Design Decisions and Why

### Why two Next.js apps instead of one?
The AI image generation pipeline uses `sharp` (native C++ bindings), `openai` SDK, and streams large image buffers in memory. Bundling this with the customer-facing storefront would mean 10-15s cold starts and a massive Docker image. Splitting them lets the frontend stay lean (~200ms cold start) while the backend can have beefier instances.

### Why Firestore over Postgres?
Design sessions are document-shaped — each session has a nested chat history array, image URLs, and metadata that varies by session type. Firestore's document model maps naturally to this. There are no joins needed (the admin dashboard reads each collection independently). Firestore also has a generous free tier and zero connection pooling to manage.

### Why IndexedDB (Dexie) over just using the backend?
The design editor needs to store large image blobs (base64 snapshots, uploaded logos) and restore state instantly on page load without a network round-trip. localStorage has a 5MB limit. IndexedDB can store hundreds of MB. Dexie provides a clean Promise-based API over the raw IndexedDB API. The migration from localStorage was done incrementally — the `migrateFromLocalStorage()` function runs once and marks completion in the `appState` table.

### Why the custom 2-pass matting pipeline?
Neither Gemini nor most image generation models output true alpha transparency. The industry-standard approach for background removal (like remove.bg) uses ML segmentation, but that requires a separate model and API call per image. The 2-pass difference matting approach is:
- Zero additional API cost (uses the same Gemini credits)
- Works entirely server-side with Sharp (no external service)
- Produces clean edges suitable for print
- Has a quality gate that falls back gracefully

OpenAI's gpt-image-1.5 later added native transparency, so the system now uses that as the primary path for logos, with the matting pipeline as fallback.

### Why server-side pricing?
Never trust the client with prices. The frontend displays prices for UX purposes, but checkout re-calculates everything from the backend pricing table. This prevents price manipulation via browser devtools.

### Why the clean URL navigation pattern?
Passing complex state (product ID, category, design session ID, image URLs) through query params creates ugly URLs that:
- Expose internal IDs to users
- Break when users share/bookmark mid-flow URLs
- Cause hydration mismatches on refresh
The sessionStorage approach keeps URLs clean while maintaining state across navigations. Deep link support is preserved as a fallback.

### Why 6 layers of spam protection?
The contact form got targeted by bots immediately. Each layer catches a different class:
- reCAPTCHA catches automated browsers
- Honeypot catches dumb form-filling bots
- Timing catches fast API-based bots
- Gibberish detection catches bots that generate random strings
- Email verification catches fake email addresses
- Rate limiting is the last resort for persistent attackers
The fake success responses prevent bots from learning which defense caught them.

---

## Development

```bash
# Frontend (port 3000)
cd packages/frontend
npm install
npm run dev

# Backend (port 3001)
cd packages/backend/auren-demo
npm install
npm run dev
```

### Required Environment Variables

**Frontend** (`packages/frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_IMAGE_CDN_URL=https://storage.googleapis.com/auren-public-asset
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
```

**Backend** (`packages/backend/auren-demo/.env.local`):
```
# AI
GOOGLE_API_KEY=...
GOOGLE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=./path-to-service-account.json
OPENAI_API_KEY=...
USE_OPENAI_IMAGE_GEN=true

# Storage
GCP_BUCKET_NAME=auren-user-designs

# Payments
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_TAX_RATE_ID=...

# Email
EMAIL_USER=...
EMAIL_PASS=...
ADMIN_NOTIFICATION_EMAIL=...

# Rate Limiting
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Spam Protection
RECAPTCHA_SECRET_KEY=...
ZEROBOUNCE_API_KEY=...

# Admin Auth
ADMIN_JWT_SECRET=...

# Frontend URL (for Stripe redirects)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```
