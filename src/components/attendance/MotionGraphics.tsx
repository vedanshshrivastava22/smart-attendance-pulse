import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  m,
  LazyMotion,
  domAnimation,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Detects very low-end devices so we can disable continuous/ambient animation
 * loops that hurt FPS. Cheap checks only (no per-frame work).
 */
const useLowPowerDevice = () => {
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const cores = navigator.hardwareConcurrency ?? 8;
    // @ts-expect-error deviceMemory is non-standard but widely available
    const memory = navigator.deviceMemory ?? 8;
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    setLowPower(cores <= 4 || memory <= 4 || Boolean(coarse));
  }, []);

  return lowPower;
};

/**
 * A slim, smooth scroll progress indicator pinned to the top of the page.
 * Uses framer-motion motion values + a spring so updates happen off the React
 * render path (no component re-renders per scroll frame) and stay throttled to
 * the browser's animation frame.
 */
export const ScrollProgress = memo(() => {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // Lighter spring on the work side; rAF-driven by framer-motion internally.
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.35,
    restDelta: 0.001,
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden
        style={{
          scaleX: prefersReduced ? scrollYProgress : scaleX,
          willChange: "transform",
        }}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-primary via-primary-glow to-secondary-foreground/60"
      />
    </LazyMotion>
  );
});
ScrollProgress.displayName = "ScrollProgress";

/**
 * Ambient, GPU-friendly background graphics. On low-power devices or when the
 * user prefers reduced motion, the continuous animation loops are dropped and
 * only static gradients remain — large FPS win with the same visual identity.
 */
export const AnimatedBackground = memo(({ className }: { className?: string }) => {
  const prefersReduced = useReducedMotion();
  const lowPower = useLowPowerDevice();
  const animate = !prefersReduced && !lowPower;

  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
        <div className="absolute inset-0 bg-hero-gradient opacity-90" />

        {/* faint engineering grid for depth (static, no animation) */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(circle at 50% 30%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 30%, black, transparent 78%)",
          }}
        />

        {/* drifting gradient orbs */}
        <m.div
          style={{ y: animate ? y1 : undefined, willChange: "transform" }}
          className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
          animate={animate ? { scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45], x: [0, 30, 0] } : undefined}
          transition={animate ? { duration: 14, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--primary-glow)/0.5),transparent_65%)]" />
        </m.div>

        <m.div
          style={{ y: animate ? y2 : undefined, willChange: "transform" }}
          className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full blur-3xl"
          animate={animate ? { scale: [1, 1.18, 1], opacity: [0.4, 0.65, 0.4], x: [0, -40, 0] } : undefined}
          transition={animate ? { duration: 18, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--secondary)/0.55),transparent_65%)]" />
        </m.div>

        {/* Third orb only animates on capable devices to save a render layer */}
        {animate && (
          <m.div
            className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
            style={{ willChange: "transform" }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.32),transparent_60%)]" />
          </m.div>
        )}
      </div>
    </LazyMotion>
  );
});
AnimatedBackground.displayName = "AnimatedBackground";

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Scroll-reveal wrapper. Children fade and rise into view once, smoothly.
 */
export const Reveal = memo(
  ({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => (
    <LazyMotion features={domAnimation} strict>
      <m.div
        variants={revealVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.18 }}
        transition={{ delay }}
        className={className}
      >
        {children}
      </m.div>
    </LazyMotion>
  ),
);
Reveal.displayName = "Reveal";

/**
 * Staggered container + item pair for lists/grids that should cascade in on scroll.
 */
export const RevealStagger = memo(({ children, className }: { children: ReactNode; className?: string }) => (
  <LazyMotion features={domAnimation} strict>
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </m.div>
  </LazyMotion>
));
RevealStagger.displayName = "RevealStagger";

export const RevealItem = memo(({ children, className }: { children: ReactNode; className?: string }) => (
  <LazyMotion features={domAnimation} strict>
    <m.div variants={revealVariants} className={className}>
      {children}
    </m.div>
  </LazyMotion>
));
RevealItem.displayName = "RevealItem";
