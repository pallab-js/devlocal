import { type HTMLAttributes, forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/* ── Card ─────────────────────────────────────────────────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Section title rendered above the card body */
  title?: string;
  /** Extra content rendered in the title row (e.g. actions / counts) */
  titleExtra?: React.ReactNode;
}

export function Card({ title, titleExtra, children, className, ...props }: CardProps) {
  return (
    <div
      className={cn("bg-surface border border-border rounded-lg overflow-hidden", className)}
      {...props}
    >
      {title && (
        <div className="flex items-center px-4 py-3 border-b border-border-light bg-surface-hi">
          <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3 flex-1">
            {title}
          </span>
          {titleExtra}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ── Input ────────────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 select-none"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "bg-surface-2 border rounded px-3 py-1.5 text-[12px] text-text font-mono",
            "outline-none transition-colors",
            error
              ? "border-error focus:border-error focus:ring-1 focus:ring-error/30"
              : "border-border focus:border-green focus:ring-1 focus:ring-green/30",
            "placeholder:text-text-3",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {hint && !error && (
          <span id={`${inputId}-hint`} className="text-[11px] text-text-3">
            {hint}
          </span>
        )}
        {error && (
          <span id={`${inputId}-error`} className="text-[11px] text-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

/* ── Select ───────────────────────────────────────────────────────────────── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, children, className, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[10px] font-mono uppercase tracking-[0.8px] text-text-3 select-none"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "bg-surface-2 border border-border rounded px-2.5 py-1.5 text-[12px] text-text font-mono",
            "outline-none focus:border-green focus:ring-1 focus:ring-green/30 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
Select.displayName = "Select";

/* ── Badge ────────────────────────────────────────────────────────────────── */

type BadgeVariant = "running" | "paused" | "restarting" | "exited" | "dead" | "created" | "default";

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  running:    "text-green bg-green/10 border-green/30",
  paused:     "text-orange bg-orange/10 border-orange/30",
  restarting: "text-violet bg-violet/10 border-violet/30",
  exited:     "text-text-3 bg-surface-2 border-border-hi",
  dead:       "text-error bg-error/10 border-error/30",
  created:    "text-text-3 bg-surface-2 border-border-hi",
  default:    "text-text-3 bg-surface-2 border-border-hi",
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant }: BadgeProps) {
  const v: BadgeVariant =
    variant ?? ((label in BADGE_CLASSES ? label : "default") as BadgeVariant);
  return (
    <span
      className={cn(
        "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
        BADGE_CLASSES[v],
      )}
    >
      {label}
    </span>
  );
}

/* ── ProgressBar ──────────────────────────────────────────────────────────── */

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
}

export function ProgressBar({ value, max, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorClass = pct > 85 ? "bg-error" : pct > 70 ? "bg-orange" : "bg-green";
  return (
    <div className={cn("bg-surface-3 rounded h-1.5 overflow-hidden", className)}>
      <div
        className={cn("h-full transition-all duration-500", colorClass)}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

/* ── SectionTitle ─────────────────────────────────────────────────────────── */

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-mono uppercase tracking-[1.2px] text-text-3 block">
      {children}
    </span>
  );
}
