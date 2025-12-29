'use client'

export default function VideoBackground() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-black">
      <video
        autoPlay
        loop
        muted
        playsInline
        // 👇 CORRECT PATH for public/images/poster-hero.jpg
        poster="/images/poster-hero.jpg"
        className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover"
      >
        <source
          src="https://storage.googleapis.com/auren-public-asset/auren_3d_rotation.mp4"
          type="video/mp4"
        />
      </video>
      <div className="absolute inset-0 bg-black/20" />
    </div>
  )
}