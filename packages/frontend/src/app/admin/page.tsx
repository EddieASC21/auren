'use client'

import { useEffect, useState, useRef } from 'react'
import { toPng } from 'html-to-image'

// --- Types ---
type DesignData = {
    productImage: string | null
    frontUploadedImages: any[]
    backUploadedImages: any[]
    frontTextElements: any[]
    backTextElements: any[]
    isViewingBack: boolean
    canvasWidth: number
    canvasHeight: number
    selectedProductId?: string
    selectedProductName?: string
    productColor: string
    frontMask: string | null
    backMask: string | null
}

const SECTION_IDS = {
    ORDERS: 'section-orders',
    CONTACT: 'section-contact',
    NEWSLETTER: 'section-newsletter',
    PAYMENTS: 'section-payments',
    USERS: 'section-users',
}

export default function AdminDashboard() {
    const [orders, setOrders] = useState<any[]>([])
    const [payments, setPayments] = useState<any[]>([])
    const [contactMessages, setContactMessages] = useState<any[]>([])
    const [newsletterSubscribers, setNewsletterSubscribers] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Hidden manufacturing canvas state
    const [renderData, setRenderData] = useState<DesignData | null>(null)
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/orders`, {
            credentials: 'include',
        })
            .then((res) => res.json())
            .then((data) => {
                console.log('Admin data from API:', data)
                setOrders(data.orders || [])
                setPayments(data.payments || [])
                setContactMessages(data.contactMessages || [])
                setNewsletterSubscribers(data.newsletterSubscribers || [])
                setUsers(data.users || [])
                setLoading(false)
            })
            .catch((err) => {
                console.error(err)
                setLoading(false)
            })
    }, [])

    // --- smooth scroll helper ---
    const scrollToSection = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    // --- 🖨️ MANUFACTURE LOGIC ---
    const handleDownload = async (item: any, orderId: string) => {
        const design: DesignData | undefined = item.designData
        if (!design) {
            alert('No design data found for this item.')
            return
        }

        setRenderData(design)

        // wait a tick for React to render hidden canvas
        setTimeout(async () => {
            if (!printRef.current) return
            try {
                const dataUrl = await toPng(printRef.current, {
                    cacheBust: true,
                    pixelRatio: 3,
                    backgroundColor: '#ffffff',
                })

                const link = document.createElement('a')
                link.download = `ORDER-${orderId.slice(0, 6)}-${design.selectedProductName || 'Product'
                    }.png`
                link.href = dataUrl
                link.click()
            } catch (err) {
                console.error('Failed to generate image', err)
                alert('Failed to generate image.')
            } finally {
                setRenderData(null)
            }
        }, 1000)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-lg">Loading admin data...</p>
            </div>
        )
    }

    // Separate orders by status (fallback: treat missing status as pending)
    const paidOrders = orders.filter((o) => o.status === 'paid')
    const pendingOrders = orders.filter(
        (o) => o.status !== 'paid' || o.status === 'pending_payment'
    )

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* HEADER + NAVBAR */}
            <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">
                            Auren Admin Dashboard
                        </h1>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">
                            Firestore overview: orders, payments, users, and site messages.
                        </p>
                    </div>

                    <nav className="flex flex-wrap gap-2 text-xs md:text-sm">
                        <button
                            onClick={() => scrollToSection(SECTION_IDS.ORDERS)}
                            className="px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Orders
                        </button>
                        <button
                            onClick={() => scrollToSection(SECTION_IDS.CONTACT)}
                            className="px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Contact Messages
                        </button>
                        <button
                            onClick={() => scrollToSection(SECTION_IDS.NEWSLETTER)}
                            className="px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Newsletter
                        </button>
                        <button
                            onClick={() => scrollToSection(SECTION_IDS.PAYMENTS)}
                            className="px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Payments
                        </button>
                        <button
                            onClick={() => scrollToSection(SECTION_IDS.USERS)}
                            className="px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Users
                        </button>
                    </nav>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
                {/* --- SECTION 1: ORDERS --- */}
                <section id={SECTION_IDS.ORDERS} className="space-y-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-2 text-green-400">
                            Confirmed Orders (Ready to Print)
                        </h2>
                        <div className="grid gap-6 mb-6">
                            {paidOrders.length === 0 && (
                                <p className="text-gray-500">No confirmed orders yet.</p>
                            )}
                            {paidOrders.map((order) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onDownload={handleDownload}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-400">
                            Drafts / Pending Payment
                        </h2>
                        <div className="grid gap-6 opacity-80">
                            {pendingOrders.length === 0 && (
                                <p className="text-gray-600">No pending drafts.</p>
                            )}
                            {pendingOrders.map((order) => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onDownload={handleDownload}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- SECTION 3: CONTACT MESSAGES --- */}
                <section id={SECTION_IDS.CONTACT}>
                    <h2 className="text-2xl font-bold mb-3 text-sky-400">
                        Contact Messages ({contactMessages.length})
                    </h2>
                    <div className="space-y-3">
                        {contactMessages.length === 0 && (
                            <p className="text-gray-500">No contact messages yet.</p>
                        )}
                        {contactMessages.map((msg: any) => {
                            const created =
                                msg.createdAt?.toDate?.() instanceof Date
                                    ? msg.createdAt.toDate().toLocaleString()
                                    : typeof msg.createdAt === 'string'
                                        ? new Date(msg.createdAt).toLocaleString()
                                        : ''

                            return (
                                <div
                                    key={msg.id}
                                    className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 flex justify-between gap-4"
                                >
                                    <div>
                                        <p className="font-semibold">
                                            {msg.name || 'Unknown sender'}{' '}
                                            <span className="text-xs text-gray-400">
                                                ({msg.email || 'No email'})
                                            </span>
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {msg.topic && <span className="mr-1">[{msg.topic}]</span>}
                                            {msg.source && (
                                                <span className="mr-1 text-gray-400">{msg.source}</span>
                                            )}
                                        </p>
                                        <p className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">
                                            {msg.message}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 whitespace-nowrap">
                                        {created}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* --- SECTION 4: NEWSLETTER --- */}
                <section id={SECTION_IDS.NEWSLETTER}>
                    <h2 className="text-2xl font-bold mb-3 text-amber-300">
                        Newsletter Subscribers ({newsletterSubscribers.length})
                    </h2>
                    <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                        {newsletterSubscribers.length === 0 ? (
                            <p className="text-gray-500">No subscribers yet.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-800">
                                        <th className="py-2 pr-4">Email</th>
                                        <th className="py-2 pr-4">Source</th>
                                        <th className="py-2 pr-4">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newsletterSubscribers.map((sub: any) => {
                                        const created =
                                            sub.createdAt?.toDate?.() instanceof Date
                                                ? sub.createdAt.toDate().toLocaleString()
                                                : typeof sub.createdAt === 'string'
                                                    ? new Date(sub.createdAt).toLocaleString()
                                                    : ''

                                        return (
                                            <tr key={sub.id} className="border-b border-gray-900">
                                                <td className="py-2 pr-4">{sub.email}</td>
                                                <td className="py-2 pr-4 text-gray-400">
                                                    {sub.source || '-'}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-500">{created}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* --- SECTION 5: PAYMENTS --- */}
                <section id={SECTION_IDS.PAYMENTS}>
                    <h2 className="text-2xl font-bold mb-3 text-purple-300">
                        Payments ({payments.length})
                    </h2>
                    <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                        {payments.length === 0 ? (
                            <p className="text-gray-500">No payments recorded.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-800">
                                        <th className="py-2 pr-4">ID</th>
                                        <th className="py-2 pr-4">Order</th>
                                        <th className="py-2 pr-4">Email</th>
                                        <th className="py-2 pr-4">Amount</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p: any) => {
                                        const created =
                                            p.createdAt?.toDate?.() instanceof Date
                                                ? p.createdAt.toDate().toLocaleString()
                                                : typeof p.createdAt === 'string'
                                                    ? new Date(p.createdAt).toLocaleString()
                                                    : ''

                                        return (
                                            <tr key={p.id} className="border-b border-gray-900">
                                                <td className="py-2 pr-4 text-xs text-gray-400">
                                                    {p.id.slice(0, 10)}…
                                                </td>
                                                <td className="py-2 pr-4 text-xs text-gray-400">
                                                    {p.orderId || p.confirmedId || '-'}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    {p.customerEmail || p.email || '-'}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    {typeof p.amount === 'number'
                                                        ? `$${p.amount.toFixed(2)}`
                                                        : p.amount || '-'}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-300">
                                                    {p.status || '-'}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-500">{created}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* --- SECTION 6: USERS --- */}
                <section id={SECTION_IDS.USERS}>
                    <h2 className="text-2xl font-bold mb-3 text-teal-300">
                        Users ({users.length})
                    </h2>
                    <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-4 overflow-x-auto">
                        {users.length === 0 ? (
                            <p className="text-gray-500">No users yet.</p>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-800">
                                        <th className="py-2 pr-4">Email</th>
                                        <th className="py-2 pr-4">Name</th>
                                        <th className="py-2 pr-4">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u: any) => {
                                        const created =
                                            u.createdAt?.toDate?.() instanceof Date
                                                ? u.createdAt.toDate().toLocaleString()
                                                : typeof u.createdAt === 'string'
                                                    ? new Date(u.createdAt).toLocaleString()
                                                    : ''

                                        return (
                                            <tr key={u.id} className="border-b border-gray-900">
                                                <td className="py-2 pr-4">{u.email}</td>
                                                <td className="py-2 pr-4 text-gray-300">
                                                    {u.name || '-'}
                                                </td>
                                                <td className="py-2 pr-4 text-gray-500">{created}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {/* --- 🖨️ HIDDEN RENDERER --- */}
            {renderData && (
                <div
                    ref={printRef}
                    style={{
                        position: 'fixed',
                        top: '-9999px',
                        left: '-9999px',
                        width: '1000px',
                        height: '1000px',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: -1,
                    }}
                >
                    <div className="relative w-full h-full">
                        {(renderData.productImage ||
                            renderData.frontUploadedImages[0]?.src) && (
                                <img
                                    src={
                                        renderData.productImage ||
                                        renderData.frontUploadedImages[0]?.src
                                    }
                                    alt="Base"
                                    crossOrigin="anonymous"
                                    className="absolute inset-0 w-full h-full object-contain"
                                    style={{ mixBlendMode: 'multiply', zIndex: 2 }}
                                />
                            )}

                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: renderData.productColor || '#fff',
                                maskImage: `url("${renderData.isViewingBack
                                        ? renderData.backMask
                                        : renderData.frontMask
                                    }")`,
                                WebkitMaskImage: `url("${renderData.isViewingBack
                                        ? renderData.backMask
                                        : renderData.frontMask
                                    }")`,
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                mixBlendMode: 'multiply',
                                zIndex: 1,
                            }}
                        />

                        {(renderData.isViewingBack
                            ? renderData.backUploadedImages
                            : renderData.frontUploadedImages
                        ).map((img: any, idx: number) => {
                            const scale = 1000 / renderData.canvasWidth
                            return (
                                <img
                                    key={idx}
                                    src={img.src}
                                    crossOrigin="anonymous"
                                    className="absolute"
                                    style={{
                                        left: img.x * scale,
                                        top: img.y * scale,
                                        width: img.width * scale,
                                        height: img.height * scale,
                                        zIndex: 3,
                                    }}
                                />
                            )
                        })}

                        {(renderData.isViewingBack
                            ? renderData.backTextElements
                            : renderData.frontTextElements
                        ).map((t: any, idx: number) => {
                            const scale = 1000 / renderData.canvasWidth
                            return (
                                <span
                                    key={idx}
                                    className="absolute whitespace-nowrap"
                                    style={{
                                        left: t.x * scale,
                                        top: t.y * scale,
                                        fontSize: (t.fontSize * (t.scale || 1)) * scale,
                                        fontFamily: t.fontFamily,
                                        fontWeight: t.fontWeight,
                                        fontStyle: t.fontStyle,
                                        color: t.color,
                                        zIndex: 4,
                                    }}
                                >
                                    {t.text}
                                </span>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// --- Helper: Single Order Card ---
function OrderCard({ order, onDownload }: { order: any; onDownload: any }) {
    const created =
        order.createdAt?.toDate?.() instanceof Date
            ? order.createdAt.toDate().toLocaleString()
            : typeof order.createdAt === 'string'
                ? new Date(order.createdAt).toLocaleString()
                : ''

    // 🔹 NEW: shipping info from Firestore (orders_confirmed.shippingDetails)
    const shipping = order.shippingDetails
    const shippingAddressLines =
        shipping?.address
            ? [
                shipping.address.line1,
                shipping.address.line2,
                [
                    shipping.address.city,
                    shipping.address.state,
                    shipping.address.postal_code,
                ]
                    .filter(Boolean)
                    .join(' '),
                shipping.address.country,
            ].filter(Boolean)
            : []
    return (
        <div className="bg-gray-900/80 p-6 rounded-xl border border-gray-800">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-semibold">
                        Order #{order.id.slice(0, 8)}
                    </h3>
                    <p className="text-gray-400 text-sm">{created}</p>
                    <p className="text-blue-400 text-sm mt-1">
                        {order.payment?.email ||
                            order.customerEmail ||
                            order.userEmail ||
                            'No Email'}
                    </p>

                    {shipping && (
                        <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                            <p className="font-semibold text-gray-300">Ship To:</p>
                            {shipping.name && <p>{shipping.name}</p>}
                            {shippingAddressLines.map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                            {shipping.phone && <p>Phone: {shipping.phone}</p>}
                        </div>
                    )}
                </div>
                <span
                    className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${order.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                >
                    {order.status === 'paid' ? 'CONFIRMED' : 'DRAFT'}
                </span>
            </div>

            <div className="space-y-4">
                {order.items && order.items.length > 0 ? (
                    order.items.map((item: any, i: number) => {
                        const design = item.designData || {}

                        // product name from Firestore, with fallbacks
                        const productName =
                            item.productName ||
                            design.selectedProductName ||
                            'Custom Product'

                        // quantity from Firestore, with fallbacks
                        const quantity =
                            item.quantity ?? item.orderData?.quantity ?? '-'

                        // comments / notes
                        const comments =
                            item.comments ?? item.orderData?.comments ?? ''

                        // thumbnail from bucket URL first, then designData if present
                        const thumbUrl =
                            item.imageUrl ||
                            item.backImageUrl ||
                            design.productImage ||
                            design.frontUploadedImages?.[0]?.src ||
                            design.backUploadedImages?.[0]?.src ||
                            ''

                        return (
                            <div
                                key={i}
                                className="bg-gray-950/70 p-4 rounded-lg flex gap-4 items-center border border-gray-800/70"
                            >
                                {thumbUrl && (
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/40 border border-gray-700 flex-shrink-0">
                                        <img
                                            src={thumbUrl}
                                            alt="Design preview"
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                )}

                                <div className="flex-1">
                                    <p className="font-bold text-lg">{productName}</p>
                                    <p className="text-sm text-gray-400">
                                        Quantity:{' '}
                                        <span className="text-white">{quantity}</span>
                                    </p>
                                    <div className="text-sm text-gray-400 mt-1 bg-black/40 p-2 rounded">
                                        <span className="text-xs uppercase tracking-wide opacity-50">
                                            Notes:
                                        </span>
                                        <br />
                                        &quot;{comments}&quot;
                                    </div>

                                    {order.payment && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            Paid:{' '}
                                            <span className="text-green-400 font-semibold">
                                                {typeof order.payment.amount === 'number'
                                                    ? `$${order.payment.amount.toFixed(2)}`
                                                    : order.payment.amount}
                                            </span>{' '}
                                            via {order.payment.currency || 'usd'}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <button
                                        onClick={() => onDownload(item, order.id)}
                                        disabled={!item.designData}
                                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${item.designData
                                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download Print File
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-gray-500">No items in this order.</p>
                )}
            </div>
        </div>
    )
}