/** The PowerWeek wordmark: wide uppercase Archivo, WEEK in volt. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display stretch-wide font-black tracking-[-0.01em] ${className || "text-[1.0625rem]"}`}
    >
      POWER<span className="text-volt-ink">WEEK</span>
    </span>
  );
}

/** The app mark: seven pill bars on a volt tile, one per weekday. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const heights = [0.55, 0.38, 0.85, 0.3, 0.7, 0.22, 0.48];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="#d4ff3a" />
      {heights.map((h, i) => {
        const height = Math.max(3, h * 20);
        return (
          <rect
            key={i}
            x={4.5 + i * 3.4}
            y={26 - height}
            width="2.4"
            height={height}
            rx="1.2"
            fill="#0b0b0c"
          />
        );
      })}
    </svg>
  );
}
