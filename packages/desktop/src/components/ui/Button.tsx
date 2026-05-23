import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "warning";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "text-green bg-green-dim border-green-border hover:bg-green/20 focus-visible:ring-green/40",
  secondary:
    "text-text-2 bg-surface-2 border-border hover:bg-surface-3 focus-visible:ring-border-hi",
  danger:
    "text-error bg-error-dim border-error-border hover:bg-error/20 focus-visible:ring-error/40",
  warning:
    "text-orange bg-orange-dim border-orange-border hover:bg-orange/20 focus-visible:ring-orange/40",
  ghost:
    "text-text-3 bg-transparent border-transparent hover:bg-surface-2 hover:text-text-2 focus-visible:ring-border",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[11px] px-2.5 py-1 rounded gap-1",
  md: "text-[12px] px-3.5 py-1.5 rounded-md gap-1.5",
  lg: "text-[13px] px-4 py-2 rounded-lg gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "sm", loading, disabled, children, className, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center font-mono font-semibold border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
