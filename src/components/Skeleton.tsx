interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 4 }: SkeletonProps) {
  return (
    <div
      className="animate-pulse"
      style={{
        width,
        height,
        borderRadius,
        background: "var(--surface-2)",
      }}
    />
  );
}
