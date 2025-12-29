'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/db';

const MANUAL_ORDER_API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type DesignData = {
    frontUploadedImages?: { src: string }[];
    backUploadedImages?: { src: string }[];
};

type ClothingCategory = 'mens' | 'womens' | 'other';

// Allowed sizes
const MEN_SIZES = ['S', 'M', 'L', 'XL', '2XL'] as const;
const WOMEN_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;

// 🆕 helper: map words -> size letters
function normalizeSizeWords(input: string): string {
    return input
        .replace(/\bsmall\b/gi, 'S')
        .replace(/\bmedium\b/gi, 'M')
        .replace(/\bmed\b/gi, 'M')
        .replace(/\blarge\b/gi, 'L');
}

// --- HELPER: Parse + validate size breakdown for clothing ---
function parseAndValidateSizeBreakdown(
    text: string,
    category: Exclude<ClothingCategory, 'other'>
): { total: number | null; error: string | null } {
    if (!text || !text.trim()) {
        return {
            total: null,
            error:
                'Please include numeric quantities and sizes, e.g. "20 S, 15 M, 10 L".',
        };
    }

    // 🆕 normalize "small"/"Small" → "S", etc.
    const normalizedText = normalizeSizeWords(text);

    // Expect patterns like "20 S", "15 M", etc.
    const regex = /(\d+)\s*(XS|S|M|L|XL|2XL)\b/gi;
    let match: RegExpExecArray | null;
    let sum = 0;
    let found = false;
    const invalidSizes = new Set<string>();
    const allowed = category === 'womens' ? WOMEN_SIZES : MEN_SIZES;

    while ((match = regex.exec(normalizedText)) !== null) {
        found = true;
        const qty = parseInt(match[1], 10);
        const sizeToken = match[2].toUpperCase();

        if (!Number.isNaN(qty)) {
            sum += qty;
        }

        if (!allowed.includes(sizeToken as any)) {
            invalidSizes.add(sizeToken);
        }
    }

    if (!found) {
        return {
            total: null,
            error:
                'Please include sizes and quantities like "20 S, 15 M, 10 L".',
        };
    }

    if (invalidSizes.size > 0) {
        if (category === 'mens') {
            return {
                total: sum,
                error:
                    `The following sizes are not available for men’s products: ${Array.from(
                        invalidSizes
                    ).join(', ')}. ` + 'Allowed sizes: S, M, L, XL, 2XL.',
            };
        } else {
            return {
                total: sum,
                error:
                    `The following sizes are not valid for women’s products: ${Array.from(
                        invalidSizes
                    ).join(', ')}. ` + 'Allowed sizes: XS, S, M, L, XL, 2XL.',
            };
        }
    }

    return { total: sum, error: null };
}

// --- HELPER 2: Convert Blob URL to Base64 ---
// Prevent sending "blob:..." URLs to the backend
async function convertUrlToBase64(url: string | null): Promise<string | null> {
    if (!url) return null;

    // If it's already a data URL (base64) or a remote URL (http), return as is
    if (url.startsWith('data:') || url.startsWith('http')) {
        // blob: never hits this branch, so this is safe
        return url;
    }

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to convert blob to base64:', error);
        return null;
    }
}

function ManualOrderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [frontImage, setFrontImage] = useState<string | null>(null);
    const [backImage, setBackImage] = useState<string | null>(null);
    const [isViewingBack, setIsViewingBack] = useState(false);
    const [hasOtherItems, setHasOtherItems] = useState(false);

    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const productId = searchParams.get('productId') ?? '';
    const isCustom = searchParams.get('isCustom') === 'true';

    // form draft storage key
    const formStorageKey = productId
        ? `manualOrderForm_${productId}`
        : 'manualOrderForm_default';

    // --- controlled form fields (so we can persist to localStorage) ---
    const [fullName, setFullName] = useState('');
    const [organization, setOrganization] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [estimatedQuantityInput, setEstimatedQuantityInput] = useState('');
    const [sizeBreakdownInput, setSizeBreakdownInput] = useState('');
    const [notes, setNotes] = useState('');

    // 🆕 track the AI design session id (for deletion on submit)
    const sessionFromQuery = searchParams.get('designSessionId');
    const [designSessionId, setDesignSessionId] = useState<string | null>(
        sessionFromQuery ?? null
    );

    // 🆕 clothing category selection (mens / womens / other)
    const [selectedCategory, setSelectedCategory] =
        useState<ClothingCategory>(() => {
            const productCategoryParam = searchParams.get('productCategory') ?? '';
            const normalized = productCategoryParam.toLowerCase();

            if (normalized.includes('other')) return 'other';
            if (normalized.includes('women')) return 'womens';
            return 'mens'; // default
        });

    // helper to save partial form to localStorage
    const saveFormDraft = (patch: Partial<Record<string, string>>) => {
        if (typeof window === 'undefined') return;
        try {
            const existingRaw = window.localStorage.getItem(formStorageKey);
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            const next = { ...existing, ...patch };
            window.localStorage.setItem(formStorageKey, JSON.stringify(next));
        } catch (e) {
            console.warn('Failed to save manual-order draft', e);
        }
    };

    // --- Load images + "hasOtherItems" + designSessionId once on mount ---
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Load any stored designSessionId if not provided via query param
        if (!sessionFromQuery) {
            try {
                const stored = localStorage.getItem('designSessionId');
                if (stored) {
                    setDesignSessionId(stored);
                }
            } catch (e) {
                console.warn('Failed to read designSessionId from localStorage', e);
            }
        }

        // 2. Check if other complete items exist in cart
        let otherItemsExist = false;

        if (productId) {
            const keys = Object.keys(localStorage).filter((k) =>
                k.startsWith('designData_')
            );

            for (const key of keys) {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;

                    const parsed: any = JSON.parse(raw);
                    const derivedId =
                        parsed.selectedProductId || key.replace('designData_', '');

                    if (String(derivedId) === String(productId)) continue;

                    const orderRaw = localStorage.getItem(`orderData_${derivedId}`);
                    if (!orderRaw) continue;

                    let isComplete = false;
                    try {
                        const orderParsed = JSON.parse(orderRaw);
                        isComplete = !!orderParsed.isComplete;
                    } catch {
                        // ignore parse errors
                    }

                    if (isComplete) {
                        otherItemsExist = true;
                        break;
                    }
                } catch (e) {
                    console.warn('Failed to inspect cart item for hasOtherItems', e);
                }
            }
        }

        setHasOtherItems(otherItemsExist);

        // 3. Load current design images
        if (!productId) return;

        if (productId === 'ai-generated') {
            const fImg = localStorage.getItem('aiChat_selectedImage');
            const bImg = localStorage.getItem('aiChat_selectedBackImage');

            if (fImg) setFrontImage(fImg);
            if (bImg) setBackImage(bImg);
        } else {
            const key = `designData_${productId}`;
            const raw = localStorage.getItem(key);
            if (!raw) return;

            try {
                const data: DesignData = JSON.parse(raw);
                if (data.frontUploadedImages?.[0]?.src) {
                    setFrontImage(data.frontUploadedImages[0].src);
                }
                if (data.backUploadedImages?.[0]?.src) {
                    setBackImage(data.backUploadedImages[0].src);
                }
            } catch (e) {
                console.error('Failed to load design data for manual-order', e);
            }
        }
    }, [productId, sessionFromQuery]);

    // 🆕 Load saved form draft on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(formStorageKey);
            if (!raw) return;
            const saved = JSON.parse(raw);

            if (typeof saved.fullName === 'string') setFullName(saved.fullName);
            if (typeof saved.organization === 'string')
                setOrganization(saved.organization);
            if (typeof saved.email === 'string') setEmail(saved.email);
            if (typeof saved.phone === 'string') setPhone(saved.phone);
            if (typeof saved.estimatedQuantity === 'string')
                setEstimatedQuantityInput(saved.estimatedQuantity);
            if (typeof saved.sizeBreakdown === 'string')
                setSizeBreakdownInput(saved.sizeBreakdown);
            if (typeof saved.notes === 'string') setNotes(saved.notes);
        } catch (e) {
            console.warn('Failed to restore manual-order draft', e);
        }
    }, [formStorageKey]);

    const displayImage = isViewingBack && backImage ? backImage : frontImage;

    // 🆕 Build Edit href that carries session + product + flags
    const editHref =
        designSessionId || productId
            ? {
                pathname: '/chat-box',
                query: {
                    ...(designSessionId ? { designSessionId } : {}),
                    ...(productId ? { productId } : {}),
                    ...(isCustom ? { isCustom: 'true' } : {}),
                    fromManualOrder: 'true',
                },
            }
            : '/chat-box';

    // 🆕 Build size-chart href that remembers we came from manual-order
    const currentParams = searchParams.toString();
    const sizeChartHref = (() => {
        const params = new URLSearchParams(currentParams);
        params.set('from', 'manual-order');
        const qs = params.toString();
        return qs ? `/size-chart?${qs}` : '/size-chart?from=manual-order';
    })();

    // --- Clear design + navigate (used on thank-you buttons) ---
    const clearDesignAndGo = async (path: string) => {
        try {
            if (productId && typeof window !== 'undefined') {
                const keysToRemove = [
                    `designData_${productId}`,
                    `orderData_${productId}`,
                    `snapshot_${productId}`,
                    `snapshot_front_${productId}`,
                    `snapshot_back_${productId}`,
                    `orderChatHistory_${productId}`,
                    `justEdited_${productId}`,
                ];

                if (productId === 'ai-generated') {
                    keysToRemove.push(
                        'aiChat_selectedImage',
                        'aiChat_selectedBackImage'
                    );
                }

                keysToRemove.forEach((k) => localStorage.removeItem(k));

                try {
                    await db.cartAssets
                        .where('productId')
                        .equals(String(productId))
                        .delete();
                } catch (e) {
                    console.error('Failed to clear cartAssets for product', e);
                }
            }
        } catch (err) {
            console.error(err);
        }

        router.push(path);
    };

    // --- Form submit handler ---
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const fullNameTrimmed = fullName.trim();
        const orgTrimmed = organization.trim();
        const emailTrimmed = email.trim();
        const phoneTrimmed = phone.trim();
        const qtyRaw = estimatedQuantityInput.trim();
        const sizeRaw = sizeBreakdownInput.trim();
        const notesTrimmed = notes.trim();
        const timeline = ''; // currently unused field

        const numericQty = parseInt(qtyRaw, 10);
        if (Number.isNaN(numericQty)) {
            setError('Estimated quantity must be a number (minimum 35 units).');
            return;
        }
        if (numericQty < 35) {
            setError('Our minimum order quantity is 35 units.');
            return;
        }

        // Required fields: sizeBreakdown is only required for mens / womens
        if (
            !fullNameTrimmed ||
            !emailTrimmed ||
            !phoneTrimmed ||
            (!sizeRaw && selectedCategory !== 'other') ||
            !notesTrimmed
        ) {
            setError('Please fill in all required fields.');
            return;
        }

        // Make sure size breakdown is valid and matches quantity
        let finalSizeBreakdown = sizeRaw;

        if (selectedCategory === 'other') {
            // One-size products: no size breakdown entry, we auto-fill
            finalSizeBreakdown = `ONE_SIZE (${numericQty} units)`;
        } else {
            const { total, error: sizeError } = parseAndValidateSizeBreakdown(
                sizeRaw,
                selectedCategory === 'womens' ? 'womens' : 'mens'
            );

            if (sizeError) {
                setError(sizeError);
                return;
            }
            if (total === null) {
                setError(
                    'Please include numeric quantities in the size breakdown, e.g. "20 S, 20 M, 10 L".'
                );
                return;
            }
            if (total !== numericQty) {
                setError(
                    `Size breakdown quantities must add up to the estimated quantity. You entered ${numericQty} but the breakdown totals ${total}.`
                );
                return;
            }
        }

        try {
            setLoading(true);

            // Convert images to Base64 before sending (handles blob URLs)
            const frontImageBase64 = await convertUrlToBase64(frontImage);
            const backImageBase64 = await convertUrlToBase64(backImage);

            const res = await fetch(`${MANUAL_ORDER_API_BASE}/api/manual-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({
                    fullName: fullNameTrimmed,
                    organization: orgTrimmed,
                    email: emailTrimmed,
                    phone: phoneTrimmed,
                    estimatedQuantity: qtyRaw,
                    sizeBreakdown: finalSizeBreakdown,
                    timeline,
                    notes: notesTrimmed,
                    productId,
                    isCustom,
                    productCategory: selectedCategory,
                    frontImage: frontImageBase64,
                    backImage: backImageBase64,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    data.error || 'Something went wrong while sending your request.'
                );
            }

            // ✅ Successful form submission
            setSubmitted(true);

            // clear saved draft
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(formStorageKey);
            }

            // also clear form state (for sanity, even though we hide it)
            setFullName('');
            setOrganization('');
            setEmail('');
            setPhone('');
            setEstimatedQuantityInput('');
            setSizeBreakdownInput('');
            setNotes('');

            // ✅ Nuke design + asset sessions (best effort, non-blocking)
            (async () => {
                try {
                    let sessionIdToDelete: string | null = designSessionId || null;

                    if (
                        (!sessionIdToDelete || !sessionIdToDelete.trim()) &&
                        typeof window !== 'undefined'
                    ) {
                        const fromStorage =
                            window.localStorage.getItem('designSessionId') ||
                            window.localStorage.getItem('aiChat_sessionId');
                        if (fromStorage && fromStorage.trim()) {
                            sessionIdToDelete = fromStorage.trim();
                        }
                    }

                    if (sessionIdToDelete) {
                        const urls = [
                            `${MANUAL_ORDER_API_BASE}/api/design-session/delete`,
                            `${MANUAL_ORDER_API_BASE}/api/asset-session`,
                        ];

                        await Promise.all(
                            urls.map(async (url) => {
                                try {
                                    const resp = await fetch(url, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sessionId: sessionIdToDelete }),
                                        keepalive: true,
                                    });

                                    if (!resp.ok) {
                                        const txt = await resp.text().catch(() => '');
                                        console.warn(
                                            '⚠️ [Manual-Order] Failed to delete session via',
                                            url,
                                            'sessionId=',
                                            sessionIdToDelete,
                                            'status=',
                                            resp.status,
                                            txt
                                        );
                                    } else {
                                        console.log(
                                            '✅ [Manual-Order] Session deleted via',
                                            url,
                                            'sessionId=',
                                            sessionIdToDelete
                                        );
                                    }
                                } catch (err) {
                                    console.warn(
                                        '⚠️ [Manual-Order] Network error calling',
                                        url,
                                        'for',
                                        sessionIdToDelete,
                                        err
                                    );
                                }
                            })
                        );
                    } else {
                        console.log(
                            '🧹 [Manual-Order] No designSessionId/aiChat_sessionId found to delete remotely'
                        );
                    }
                } finally {
                    // Always clear session id keys locally
                    if (typeof window !== 'undefined') {
                        try {
                            window.localStorage.removeItem('designSessionId');
                            window.localStorage.removeItem('aiChat_sessionId');
                        } catch (e) {
                            console.warn(
                                'Failed to clear session id keys from localStorage',
                                e
                            );
                        }
                    }
                }
            })();

            // Also nuke local AI chat history so the conversation is gone on the frontend
            if (typeof window !== 'undefined') {
                try {
                    const aiKeys = [
                        'aiChat_backendHistory',
                        'aiChat_chatHistory',
                        'aiChat_selectedImage',
                        'aiChat_selectedBackImage',
                        'aiChat_sessionId',
                        'aiChat_sessionCreatedAt',
                        'designData_ai-generated',
                    ];

                    aiKeys.forEach((k) => window.localStorage.removeItem(k));

                    console.log(
                        '🧹 [Manual-Order] Cleared AI chat-related localStorage keys:',
                        aiKeys
                    );
                } catch (e) {
                    console.warn('Failed to clear AI chat local storage keys', e);
                }
            }
        } catch (err: any) {
            console.error('Manual order form error:', err);
            setError(err.message || 'Failed to submit. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // --- UI ---

    return (
        <main
            className="relative min-h-screen text-white overflow-hidden"
            style={{
                backgroundImage: "url('/background.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
            }}
        >
            <div className="absolute inset-0 bg-black/40" />

            {/* Header (similar to /contact) */}
            <header className="relative z-20 px-8 py-6 flex items-center justify-between">
                <Link href="/catalog" className="flex items-center gap-3">
                    <div className="w-8 h-8 relative">
                        <Image
                            src="/auren_white_logo.png"
                            alt="Auren Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-white text-xl font-light">auren</span>
                </Link>
            </header>

            <section className="relative z-20 flex items-center justify-center px-4 py-6 sm:py-10">
                <div className="w-full max-w-xl rounded-3xl bg-black/35 border border-white/15 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] px-6 py-7 sm:px-8 sm:py-9">
                    {!submitted ? (
                        <>
                            <h1 className="text-3xl sm:text-4xl font-light text-center mb-3">
                                Tell us about your design.
                            </h1>
                            <p className="text-center text-white/75 text-sm sm:text-base mb-5">
                                We&apos;ll review your design and send a tailored quote.
                                <br />
                                <span className="text-white/85">
                                    Expect a response in under 12 hours.
                                </span>
                            </p>

                            {/* FORM – one field per row, preview inside */}
                            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        required
                                        value={fullName}
                                        onChange={(e) => {
                                            setFullName(e.target.value);
                                            saveFormDraft({ fullName: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {/* Organization */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Organization{' '}
                                        <span className="text-white/60 text-xs sm:text-sm">
                                            (optional)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        name="organization"
                                        value={organization}
                                        onChange={(e) => {
                                            setOrganization(e.target.value);
                                            saveFormDraft({ organization: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Email <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            saveFormDraft({ email: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Phone Number <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        required
                                        value={phone}
                                        onChange={(e) => {
                                            setPhone(e.target.value);
                                            saveFormDraft({ phone: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {/* Design preview INSIDE the form */}
                                <div className="pt-2 flex flex-col items-center">
                                    {/* Label box ABOVE the image */}
                                    <div className="mb-3 px-4 py-1.5 rounded-full bg-white/10 border border-white/25 text-[11px] sm:text-xs uppercase tracking-[0.18em] text-white/75">
                                        Custom mockup upload
                                    </div>

                                    {/* Bigger image box */}
                                    <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-3xl bg-white/5 border border-white/15 overflow-hidden mb-3">
                                        {displayImage ? (
                                            <Image
                                                src={displayImage}
                                                alt="Custom design preview"
                                                fill
                                                className="object-contain p-4"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">
                                                No preview
                                            </div>
                                        )}

                                        {backImage && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIsViewingBack((prev) => !prev)
                                                }
                                                className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full bg-black/60 border border-white/30 text-white/90 hover:bg-black/80 transition"
                                            >
                                                {isViewingBack ? 'View front' : 'View back'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Edit link under the image */}
                                    <Link
                                        href={editHref}
                                        className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/10 border border-white/30 text-sm font-medium text-white/90 hover:bg-white/20 transition"
                                    >
                                        Edit design
                                    </Link>
                                </div>

                                {/* 🆕 Category selection */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Product type / sizing{' '}
                                        <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        name="productCategory"
                                        value={selectedCategory}
                                        onChange={(e) =>
                                            setSelectedCategory(
                                                e.target.value as ClothingCategory
                                            )
                                        }
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    >
                                        <option value="mens">
                                            Mens
                                        </option>
                                        <option value="womens">
                                            Womens
                                        </option>
                                        <option value="other">
                                            Accessories / Other (one size)
                                        </option>
                                    </select>
                                </div>

                                {/* Estimated Quantity */}
                                <div>
                                    <label className="block text-base sm:text-lg font-medium mb-1.5">
                                        Estimated Quantity{' '}
                                        <span className="text-red-400">*</span>
                                        <span className="ml-2 text-white/90 text-sm sm:text-base">
                                            (minimum 35 units)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        name="estimatedQuantity"
                                        placeholder="e.g. 50"
                                        required
                                        value={estimatedQuantityInput}
                                        onChange={(e) => {
                                            setEstimatedQuantityInput(e.target.value);
                                            saveFormDraft({ estimatedQuantity: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {/* Size Breakdown (only for mens / womens) */}
                                {selectedCategory !== 'other' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-sm sm:text-base font-medium">
                                                Size Breakdown <span className="text-red-400">*</span>
                                            </label>
                                            <Link
                                                href={sizeChartHref}
                                                className="text-[11px] sm:text-xs text-white/70 underline hover:text-white"
                                            >
                                                View size chart
                                            </Link>
                                        </div>

                                        <input
                                            type="text"
                                            name="sizeBreakdown"
                                            placeholder="e.g. 20 S, 20 M, 10 L"
                                            required
                                            value={sizeBreakdownInput}
                                            onChange={(e) => {
                                                setSizeBreakdownInput(e.target.value);
                                                saveFormDraft({ sizeBreakdown: e.target.value });
                                            }}
                                            className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-white/50"
                                        />
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm sm:text-base font-medium mb-1.5">
                                        Anything else we should know?{' '}
                                        <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        name="notes"
                                        required
                                        rows={4}
                                        value={notes}
                                        onChange={(e) => {
                                            setNotes(e.target.value);
                                            saveFormDraft({ notes: e.target.value });
                                        }}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-3 py-3 text-sm sm:text-base resize-none focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-400 mt-1">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-2 px-6 py-3 rounded-full bg-white/95 text-black text-base sm:text-lg font-medium tracking-wide hover:bg-white transition shadow-[0_10px_40px_rgba(0,0,0,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending…' : 'Submit custom order request'}
                                </button>
                            </form>
                        </>
                    ) : (
                        // --- THANK-YOU STATE ---
                        <div className="text-center space-y-6 py-4">
                            <h2 className="text-2xl sm:text-3xl font-light">
                                Thank you for your request.
                            </h2>
                            <p className="text-white/75 text-sm sm:text-base">
                                We&apos;ve received your custom order details. You can expect a
                                tailored quote in{' '}
                                <span className="font-semibold">less than 12 hours</span>.
                            </p>

                            <div className="flex flex-col gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => clearDesignAndGo('/catalog')}
                                    className="w-full px-6 py-2.5 rounded-full border border-white/40 text-sm sm:text-base text-white/90 hover:bg-white/10 transition"
                                >
                                    Back to catalog
                                </button>

                                {hasOtherItems && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            clearDesignAndGo('/product-showcase')
                                        }
                                        className="w-full px-6 py-2.5 rounded-full border border-white/40 text-sm sm:text-base text-white/90 hover:bg-white/10 transition"
                                    >
                                        Return to product showcase
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}

export default function ManualOrderPage() {
    return (
        <Suspense
            fallback={
                <div className="text-white text-center pt-20">Loading…</div>
            }
        >
            <ManualOrderContent />
        </Suspense>
    );
}