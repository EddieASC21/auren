// packages/frontend/src/components/VideoBackground.tsx

'use client'

import { useEffect, useRef, useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { POSTER_HERO, POSTER_HERO_MOBILE, POSTER_HERO_TABLET, VIDEO_3D_ROTATION } from '@/lib/cdn-assets'

// Lazy load spinner - only needed if video stalls
const BrandedSpinner = dynamic(() => import('@/components/ui/BrandedSpinner'), {
  ssr: false,
})

const VideoBackground = () => {
  const [isStalled, setIsStalled] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const onWait = () => {
    // Threshold of 2.5s for the hero section (only show loader if it's truly slow)
    clearTimer()
    timerRef.current = setTimeout(() => setIsStalled(true), 2500)
  }

  const onPlay = () => {
    clearTimer()
    setIsStalled(false)
    setVideoLoaded(true)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const isMobile = window.matchMedia('(max-width: 767px)').matches

    const updateMotionPreference = () => {
      const reduced = mediaQuery.matches
      setPrefersReducedMotion(reduced)
      if (reduced) {
        setShouldLoadVideo(false)
        setVideoLoaded(true)
      }
    }

    updateMotionPreference()
    mediaQuery.addEventListener('change', updateMotionPreference)

    // Let the poster render first, then schedule the video load during idle time.
    const delay = isMobile ? 2000 : 1500

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const scheduleVideoLoad = () =>
      setShouldLoadVideo((current) => current || !mediaQuery.matches)

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => {
        timeoutId = setTimeout(scheduleVideoLoad, delay)
      }, { timeout: 2500 })
    } else {
      timeoutId = setTimeout(scheduleVideoLoad, delay)
    }

    return () => {
      if (idleId) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      mediaQuery.removeEventListener('change', updateMotionPreference)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || hasUserInteracted) return

    const handleFirstInteraction = () => setHasUserInteracted(true)
    const passiveOptions: AddEventListenerOptions = { passive: true }

    window.addEventListener('pointerdown', handleFirstInteraction, passiveOptions)
    window.addEventListener('keydown', handleFirstInteraction)
    window.addEventListener('touchstart', handleFirstInteraction, passiveOptions)
    window.addEventListener('wheel', handleFirstInteraction, passiveOptions)

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction, passiveOptions)
      window.removeEventListener('keydown', handleFirstInteraction)
      window.removeEventListener('touchstart', handleFirstInteraction, passiveOptions)
      window.removeEventListener('wheel', handleFirstInteraction, passiveOptions)
    }
  }, [hasUserInteracted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldLoadVideo) return

    const tryPlay = () => {
      video.play().catch(() => {})
    }

    if (video.readyState >= 2) {
      tryPlay()
      return
    }

    video.addEventListener('canplay', tryPlay, { once: true })
    return () => video.removeEventListener('canplay', tryPlay)
  }, [shouldLoadVideo])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [])

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-black">
      {/* Responsive poster image for faster mobile loading */}
      <picture className="absolute inset-0">
        <source
          media="(max-width: 767px)"
          srcSet={POSTER_HERO_MOBILE}
          type="image/webp"
        />
        <source
          media="(min-width: 768px) and (max-width: 1279px)"
          srcSet={POSTER_HERO_TABLET}
          type="image/webp"
        />
        <img
          src={POSTER_HERO}
          alt="Hero background"
          className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover"
          loading="eager"
          fetchPriority="high"
        />
      </picture>

      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        // Start with auto preload on mobile once shouldLoadVideo is true
        preload={shouldLoadVideo ? 'auto' : 'none'}
        onWaiting={onWait}
        onPlaying={onPlay}
        onCanPlay={onPlay}
        onLoadedData={() => setVideoLoaded(true)}
        className={`absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover transition-opacity duration-500 ${videoLoaded && hasUserInteracted && !prefersReducedMotion ? 'opacity-100' : 'opacity-0'}`}
      >
        {shouldLoadVideo && (
          <source
            src={VIDEO_3D_ROTATION}
            type="video/mp4"
          />
        )}
      </video>

      {/* Premium fallback if hero stalls */}
      {isStalled && !prefersReducedMotion && <BrandedSpinner />}

      {/* Overlay - removed expensive backdrop-brightness-75 */}
      <div className="absolute inset-0 bg-black/30" />
    </div>
  )
}

export default memo(VideoBackground)
