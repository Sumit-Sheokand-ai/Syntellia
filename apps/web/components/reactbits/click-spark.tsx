"use client";

import { useCallback, useEffect, useRef } from "react";

type ClickSparkProps = {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  extraScale?: number;
  children?: React.ReactNode;
};

type Spark = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
};

export function ClickSpark({
  sparkColor = "#fff",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = "ease-out",
  extraScale = 1,
  children
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const parent = canvas.parentElement;

    if (!parent) {
      return;
    }

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(parent);
    resizeCanvas();

    return () => {
      observer.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    (value: number) => {
      switch (easing) {
        case "linear":
          return value;
        case "ease-in":
          return value * value;
        case "ease-in-out":
          return value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;
        default:
          return value * (2 - value);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let animationId = 0;

    const draw = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;

        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);
        const distance = sparkRadius * extraScale * eased;
        const lineLength = sparkSize * (1 - eased * 0.8);
        const opacity = 1 - eased;
        const x1 = spark.x + Math.cos(spark.angle) * distance;
        const y1 = spark.y + Math.sin(spark.angle) * distance;
        const x2 = spark.x + Math.cos(spark.angle) * (distance + lineLength);
        const y2 = spark.y + Math.sin(spark.angle) * (distance + lineLength);

        context.strokeStyle = sparkColor;
        context.globalAlpha = opacity;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();

        return true;
      });

      context.globalAlpha = 1;
      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [duration, easeFunc, extraScale, sparkColor, sparkRadius, sparkSize]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();

    const newSparks = Array.from({ length: sparkCount }, (_, index) => ({
      x,
      y,
      angle: (2 * Math.PI * index) / sparkCount,
      startTime: now
    }));

    sparksRef.current.push(...newSparks);
  };

  return (
    <div className="relative h-full w-full" onClick={handleClick}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}
