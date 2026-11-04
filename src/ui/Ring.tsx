import { motion, useReducedMotion } from 'framer-motion';

/** Circular progress (0..1). Value text sits inside, in the text colour. */
export function Ring({ value, size = 64, stroke = 6, label, children }: { value: number; size?: number; stroke?: number; label?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="ring-wrap" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--faint)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ opacity: v > 0 ? 1 : 0 }}
        />
      </svg>
      {children && <span className="ring-inner">{children}</span>}
    </span>
  );
}
