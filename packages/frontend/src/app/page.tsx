import dynamic from 'next/dynamic'
import TopNav from '@/components/home/TopNav'
import HeroSection from '@/components/home/HeroSection'

// Lazy load intersection observer component itself
const LazyOnView = dynamic(() => import('@/components/home/LazyOnView').then(mod => ({ default: mod.LazyOnView })), {
  ssr: false,
})

// Below-the-fold components - lazy load with low priority and no preload
const GetStartedSection = dynamic(() => import('@/components/home/GetStartedSection'), {
  ssr: false,
  loading: () => <section className="relative h-screen overflow-hidden bg-black" />,
})

const HowItWorksSection = dynamic(() => import('@/components/home/HowItWorksSection'), {
  ssr: false,
  loading: () => <section className="relative bg-how-it-works-cream py-32 sm:py-48" />,
})

const FinalCtaSection = dynamic(() => import('@/components/home/FinalCtaSection'), {
  ssr: false,
  loading: () => <section className="relative h-screen overflow-hidden bg-black" />,
})

const FooterWithFaq = dynamic(() => import('@/components/home/FooterWithFaq'), {
  ssr: false,
  loading: () => <footer className="bg-black py-16 px-8 relative z-30" />,
})

// Base URL for backend API (uses env in prod, falls back to localhost:3001 in dev)
const NEWSLETTER_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function Home() {
  return (
    <main className="relative bg-white">
      {/* Client component - has onClick handler */}
      <TopNav />

      {/* Client component - has video and animations */}
      <HeroSection />

      {/* Client component - lazy loads AurenAnimation */}
      <LazyOnView
        placeholder={<section className="relative h-screen overflow-hidden bg-black" />}
        mobileRootMargin="0px"
      >
        <GetStartedSection />
      </LazyOnView>

      {/* Client component - below the fold */}
      <LazyOnView
        placeholder={<section className="relative bg-how-it-works-cream py-32 sm:py-48" />}
        mobileRootMargin="0px"
      >
        <HowItWorksSection />
      </LazyOnView>

      {/* Client component - has video with useInView */}
      <LazyOnView
        placeholder={<section className="relative h-screen overflow-hidden bg-black" />}
        mobileRootMargin="0px"
      >
        <FinalCtaSection />
      </LazyOnView>

      {/* Client component - has form state */}
      <LazyOnView
        placeholder={<footer className="bg-black py-16 px-8 relative z-30" />}
        mobileRootMargin="0px"
      >
        <FooterWithFaq newsletterApiBase={NEWSLETTER_API_BASE} />
      </LazyOnView>
    </main>
  )
}
