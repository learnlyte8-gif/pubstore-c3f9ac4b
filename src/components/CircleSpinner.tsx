import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
  /** Unused — kept for API compatibility */
  thickness?: number;
  /** Optional progress 0-100. When provided, a thin arc track is drawn behind the bubbles. */
  value?: number;
  label?: string;
};

/**
 * Samsung One UI-style "bubble" loader.
 * Eight blue dots arranged on a ring, orbiting and pulsing — clean, friendly, distinctly Samsung.
 */
export default function CircleSpinner({
  size = 20,
  className,
  value,
  label,
}: Props) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, value));
  const dots = 8;
  const dotR = size * 0.11;
  const ringR = size / 2 - dotR;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <span
      role={indeterminate ? "status" : "progressbar"}
      aria-label={label ?? (indeterminate ? "Loading" : `${Math.round(clamped)}%`)}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={indeterminate ? "samsung-bubble-spin" : undefined}
      >
        {!indeterminate && (
          <circle
            cx={cx}
            cy={cy}
            r={ringR}
            fill="none"
            stroke="hsl(212 100% 50% / 0.18)"
            strokeWidth={Math.max(1, size * 0.06)}
          />
        )}
        {Array.from({ length: dots }).map((_, i) => {
          const angle = (i / dots) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * ringR;
          const y = cy + Math.sin(angle) * ringR;
          // Front bubbles are bigger/brighter; trailing fade — Samsung look
          const t = i / dots;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={dotR * (0.55 + 0.45 * (1 - t))}
              fill="hsl(212 100% 52%)"
              opacity={0.25 + 0.75 * (1 - t)}
              style={{
                animation: indeterminate
                  ? `samsung-bubble-pulse 1.1s ${(-t * 1.1).toFixed(2)}s infinite ease-in-out`
                  : undefined,
                transformOrigin: `${x}px ${y}px`,
              }}
            />
          );
        })}
      </svg>
    </span>
  );
}
