"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: "horizontal" | "vertical" | "diagonal";
  pauseOnHover?: boolean;
  yoyo?: boolean;
};

export function GradientText({
  children,
  className = "",
  colors = ["#5227FF", "#FF9FFC", "#B19EEF"],
  animationSpeed = 8,
  showBorder = false,
  direction = "horizontal",
  pauseOnHover = false,
  yoyo = true
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const animationDuration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += delta;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleProgress = (elapsedRef.current % fullCycle) / animationDuration;
      const nextValue = cycleProgress <= 1 ? cycleProgress : 2 - cycleProgress;
      progress.set(nextValue * 100);
      return;
    }

    progress.set(((elapsedRef.current % animationDuration) / animationDuration) * 100);
  });

  const backgroundPosition = useTransform(progress, (value) => {
    if (direction === "vertical") {
      return `50% ${value}%`;
    }

    if (direction === "diagonal") {
      return `${value}% ${value}%`;
    }

    return `${value}% 50%`;
  });

  const gradientAngle =
    direction === "horizontal" ? "to right" : direction === "vertical" ? "to bottom" : "to bottom right";
  const gradientColors = [...colors, colors[0]].join(", ");

  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === "horizontal" ? "300% 100%" : direction === "vertical" ? "100% 300%" : "300% 300%",
    backgroundRepeat: "repeat"
  };

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  }, [pauseOnHover]);

  return (
    <motion.span className={`relative inline-flex ${className}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {showBorder ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[inherit] opacity-60 blur-md"
          style={{ ...gradientStyle, backgroundPosition }}
        />
      ) : null}
      <motion.span
        className="relative inline-block text-transparent [background-clip:text] [-webkit-background-clip:text]"
        style={{ ...gradientStyle, backgroundPosition }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
