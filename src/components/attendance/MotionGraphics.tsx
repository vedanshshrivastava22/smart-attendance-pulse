import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A slim, smooth scroll progress indicator pinned to the top of the page.
 * Uses a spring so the motion feels physical rather than linear.
 */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-primary via-primary-glow to-secondary-foreground/60"
    />
  );
};

/**
 * Ambient, GPU-friendly background graphics: soft drifting gradient orbs,
 * a faint grid, and a slow parallax shift driven by scroll. Purely decorative.
 */
export const AnimatedBackground = ({ className }: { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%", "-14%"]);

  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-hero-gradient opacity-90" />

      {/* faint engineering grid for depth */}
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
      <motion.div
        style={{ y: y1 }}
        className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45], x: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--primary-glow)/0.5),transparent_65%)]" />
      </motion.div>

      <motion.div
        style={{ y: y2 }}
        className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full blur-3xl"
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.65, 0.4], x: [0, -40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--secondary)/0.55),transparent_65%)]" />
      </motion.div>

      <motion.div
        className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.32),transparent_60%)]" />
      </motion.div>
    </div>
  );
};

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
export const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    variants={revealVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.18 }}
    transition={{ delay }}
    className={className}
  >
    {children}
  </motion.div>
);

/**
 * Staggered container + item pair for lists/grids that should cascade in on scroll.
 */
export const RevealStagger = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.15 }}
    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    className={className}
  >
    {children}
  </motion.div>
);

export const RevealItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div variants={revealVariants} className={className}>
    {children}
  </motion.div>
);
