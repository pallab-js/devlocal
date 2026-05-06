interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 4 }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// Inject keyframes once
if (typeof document !== "undefined" && !document.getElementById("skeleton-style")) {
  const style = document.createElement("style");
  style.id = "skeleton-style";
  style.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
  document.head.appendChild(style);
}
