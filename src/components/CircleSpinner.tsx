import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
  /**
   * Stroke thickness as a fraction of size. Defaults to 0.12.
   */
  thickness?: number;
  /**
   * If provided (0-100) renders a determinate progress arc; otherwise
   * renders an indeterminate spinning ring.
   */
  value?: number;
  label?: string;
};

/**
 * Circular progress / spinner used app-wide for loading states.
 * Indeterminate by default (just spins). Pass `value` for a real progress arc.
 */
export default function CircleSpinner({
  size = 16,
  className,
  thickness = 0.12,
  value,
  label,
}: Props) {
  const stroke = Math.max(1.5, size * thickness);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, value));
  const dash = indeterminate ? circumference * 0.25 : (clamped / 100) * circumference;

  return (
    <span
      role={indeterminate ? "status" : "progressbar"}
      aria-label={label ?? (indeterminate ? "Loading" : `${Math.round(clamped)}%`)}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn("inline-flex items-center justify-center text-current", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={indeterminate ? "animate-spin" : undefined}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={!indeterminate ? { transition: "stroke-dasharray 200ms ease" } : undefined}
        />
      </svg>
    </span>
  );
}
