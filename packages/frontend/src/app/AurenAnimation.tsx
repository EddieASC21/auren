'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CARDS = [
    { id: 1, src: '/images/lambda-cap.jpg', alt: 'Lambda Cap' },
    { id: 2, src: '/images/auren-pouch.jpg', alt: 'Woman with Pouch' },
    { id: 3, src: '/images/auren-merch.jpg', alt: 'OCS White Tee' },
    { id: 4, src: '/images/clark-merch.jpg', alt: 'Clark Merch' },
    { id: 5, src: '/images/sorority-shorts.jpg', alt: 'Exec Board' },
    { id: 6, src: '/images/brand-collection.jpg', alt: 'JP Morgan Set' },
];

// ✅ Desktop layout (original-ish positions; no extra drop)
const FINAL_POSITIONS_DESKTOP: Record<number, { x: number; y: number; rotate: number }> = {
    1: { x: 0, y: -300, rotate: 0 },  // top center
    2: { x: -480, y: -240, rotate: 14 },  // top left
    3: { x: 480, y: -240, rotate: -14 },  // top right

    4: { x: -480, y: 260, rotate: -10 },   // bottom left
    6: { x: 0, y: 320, rotate: 0 },   // bottom center
    5: { x: 480, y: 260, rotate: 10 },   // bottom right
};

// ✅ Mobile layout (bottom three dropped further so they clear the text)
const FINAL_POSITIONS_MOBILE: Record<number, { x: number; y: number; rotate: number }> = {
    1: { x: 0, y: -180, rotate: 0 },  // top center
    2: { x: -160, y: -140, rotate: 10 },  // top left
    3: { x: 160, y: -140, rotate: -10 },  // top right

    4: { x: -160, y: 210, rotate: -8 },   // bottom left (dropped)
    6: { x: 0, y: 260, rotate: 0 },   // bottom center (dropped)
    5: { x: 160, y: 210, rotate: 8 },   // bottom right (dropped)
};

// order they peel out from the stack
const SEQUENCE = [1, 2, 3, 4, 5, 6];

export default function AurenAnimation() {
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        const handleResize = () => {
            if (typeof window === 'undefined') return;
            setIsMobile(window.innerWidth < 768); // < md breakpoint
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isMounted) return <div className="w-full h-screen bg-black" />;

    const POSITIONS = isMobile ? FINAL_POSITIONS_MOBILE : FINAL_POSITIONS_DESKTOP;

    return (
        <div className="relative w-full min-h-screen bg-black overflow-hidden flex items-center justify-center perspective-container">
            {/* TEXT ON TOP */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="text-center">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
                        className="text-4xl md:text-8xl font-medium tracking-tighter text-white leading-tight"
                    >
                        Already <br />
                        <span className="text-gray-400">made with Auren</span>
                    </motion.h1>
                </div>
            </div>

            {/* CARDS BELOW TEXT */}
            <div className="absolute inset-0 w-full h-full z-10 preserve-3d pointer-events-none">
                {CARDS.map((card) => {
                    const pos = POSITIONS[card.id] ?? { x: 0, y: 0, rotate: 0 };
                    const seqIndex = SEQUENCE.indexOf(card.id);
                    const baseDelay = 0.8;  // wait for text to be nicely in
                    const stepDelay = 0.5;  // slower stagger between cards

                    return (
                        <motion.div
                            key={card.id}
                            className="absolute left-1/2 top-1/2 w-[260px] h-[340px] md:w-[300px] md:h-[400px]"
                            style={{ marginLeft: -150, marginTop: -200 }} // center pivot
                            initial={{
                                opacity: 0,
                                x: 0,
                                y: 0,
                                z: -200,
                                scale: 0.45,
                                rotate: 0,
                            }}
                            animate={{
                                opacity: 1,
                                x: pos.x,
                                y: pos.y,
                                z: 0,
                                scale: isMobile ? 0.7 : 0.78,
                                rotate: pos.rotate,
                            }}
                            transition={{
                                opacity: { duration: 1.0, delay: baseDelay + seqIndex * stepDelay },
                                x: {
                                    duration: 1.8,
                                    type: 'spring',
                                    damping: 18,
                                    stiffness: 80,
                                    delay: baseDelay + seqIndex * stepDelay,
                                },
                                y: {
                                    duration: 1.8,
                                    type: 'spring',
                                    damping: 18,
                                    stiffness: 80,
                                    delay: baseDelay + seqIndex * stepDelay,
                                },
                                scale: { duration: 1.2, delay: baseDelay + seqIndex * stepDelay },
                                rotate: { duration: 1.2, delay: baseDelay + seqIndex * stepDelay },
                            }}
                        >
                            {/* slow, gentle bobbing */}
                            <motion.div
                                className="w-full h-full"
                                animate={{ y: [0, -15, 0] }}
                                transition={{
                                    duration: 5 + Math.random() * 2,
                                    repeat: Infinity,
                                    repeatType: 'mirror',
                                    ease: 'easeInOut',
                                    delay: 2 + seqIndex * 0.2,
                                }}
                            >
                                <div className="relative w-full h-full bg-[#1a1a1a] rounded-[24px] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] border border-white/10">
                                    <div className="h-[75%] w-full relative bg-gray-900">
                                        <img
                                            src={card.src}
                                            alt={card.alt}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    </div>

                                    <div className="h-[25%] p-5 flex flex-col justify-between bg-black text-white relative z-10">
                                        <h2 className="text-2xl font-medium tracking-tight">Auren</h2>
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-gray-400">
                                            <span>Made with Auren</span>
                                            <div className="border border-white/20 px-3 py-1.5 rounded-full text-white bg-white/5 backdrop-blur-md">
                                                View
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>

            <style jsx>{`
        .perspective-container {
          perspective: 1500px;
          background: #050505;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
        </div>
    );
}