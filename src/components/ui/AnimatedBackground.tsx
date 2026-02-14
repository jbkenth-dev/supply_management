import { motion, useScroll, useTransform } from "framer-motion";

interface AnimatedBackgroundProps {
  imageUrl?: string;
}

export function AnimatedBackground({ imageUrl }: AnimatedBackgroundProps) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [-50, 250]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950 pointer-events-none z-0">
      {/* Base Background Image - Forced to cover 100% of the section without any gaps */}
      {imageUrl && (
        <div className="absolute inset-0 w-full h-full">
          <motion.img 
            style={{ y }}
            src={imageUrl} 
            alt="Background" 
            className="absolute top-0 left-0 min-w-full min-h-[120%] w-full h-[120%] object-cover opacity-90 origin-top scale-105"
          />
          {/* Professional Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/80"></div>
          <div className="absolute inset-0 bg-slate-950/30"></div>
        </div>
      )}

      {!imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-secondary-900 to-black"></div>
      )}

      {/* Subtle Animated Blobs for depth */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-500 rounded-full blur-[120px]"
      />

      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.15, 0.1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-secondary-500 rounded-full blur-[120px]"
      />

      {/* Modern Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
        }}
      ></div>

      {/* Noise Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-overlay"></div>
    </div>
  );
}
