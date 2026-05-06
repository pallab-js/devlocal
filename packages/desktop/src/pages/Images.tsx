import { useState, useRef, useMemo, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useImages, useImageMutations } from "../hooks/useQueries";
import { Skeleton } from "../components/Skeleton";
import { useDebounce } from "../hooks/useDebounce";
import { type ImageInfo, type PullProgress } from "../lib/ipc";

const cardClass = "bg-surface border border-border rounded-lg p-4 md:p-5";
const secTitleClass = "text-[11px] font-mono uppercase tracking-[1.2px] text-text-3 mb-4 block";
const btnBase = "text-[11px] px-2.5 py-1 rounded border font-mono cursor-pointer transition-colors";
const btnRed = `${btnBase} text-error bg-error/10 border-error hover:bg-error/20`;
const btnGreen = `${btnBase} text-green bg-green/10 border-green hover:bg-green/20`;

function formatSize(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageRow({ img, onRemove, style }: { 
  img: ImageInfo; 
  onRemove: () => void;
  style?: React.CSSProperties;
}) {
  const shortId = img.id.replace("sha256:", "").substring(0, 12);
  const tags = img.repo_tags && img.repo_tags.length > 0 ? img.repo_tags.join(", ") : "<none>";
  const date = new Date(img.created * 1000).toLocaleDateString();

  return (
    <tr className="border-b border-border-light hover:bg-surface-hi/50 transition-colors flex w-full" style={style}>
      <td className="p-3 w-32 shrink-0 font-mono text-[12px] text-violet">{shortId}</td>
      <td className="p-3 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium">{tags}</td>
      <td className="p-3 w-32 shrink-0 text-text-3 text-[12px]">{date}</td>
      <td className="p-3 w-32 shrink-0 text-text-2 text-[12px] font-mono">{formatSize(img.size)}</td>
      <td className="p-3 w-24 shrink-0">
        <button onClick={onRemove} className={btnRed}>Delete</button>
      </td>
    </tr>
  );
}

export default function Images() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const parentRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);

  const { data: images, isLoading, error, refetch } = useImages();
  const { remove, prune } = useImageMutations();

  const filteredImages = useMemo(() => {
    if (!images) return [];
    if (!debouncedSearch) return images;
    const s = debouncedSearch.toLowerCase();
    return images.filter(img => 
      img.id.toLowerCase().includes(s) || 
      (img.repo_tags && img.repo_tags.some(t => t.toLowerCase().includes(s)))
    );
  }, [images, debouncedSearch]);

  const rowVirtualizer = useVirtualizer({
    count: filteredImages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 49,
    overscan: 10,
  });

  const handlePrune = async () => {
    if (confirm("Prune all unused images?")) {
      await prune.mutateAsync();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-text m-0">Images</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsPulling(true)} className={btnGreen}>Pull Image</button>
          <button onClick={handlePrune} className="text-[11px] px-2.5 py-1 rounded border border-border bg-surface-2 text-text-3 font-mono hover:bg-surface-3 transition-colors">Prune</button>
        </div>
      </div>

      <section className={cardClass}>
        <div className="flex items-center mb-4">
          <h2 className={`${secTitleClass} m-0 flex-1`}>Local Images</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images…"
            className="text-[11px] px-2.5 py-1 rounded border border-border bg-surface-2 text-text font-mono outline-none w-64 focus:border-green focus:ring-1 focus:ring-green/30"
          />
        </div>

        {isLoading && <div className="flex flex-col gap-2.5">{[0,1,2].map(i => <Skeleton key={i} height={36} />)}</div>}
        {error && <p className="text-error text-[13px]">Failed to load images.</p>}
        {images && images.length === 0 && <p className="text-text-3 text-[13px]">No images found.</p>}
        {images && images.length > 0 && filteredImages.length === 0 && <p className="text-text-3 text-[13px]">No images match your search.</p>}

        {filteredImages.length > 0 && (
          <div 
            ref={parentRef}
            className="overflow-y-auto max-h-[600px] border border-border rounded-md"
          >
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border flex w-full">
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-32 shrink-0">ID</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 flex-1">Tags</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-32 shrink-0">Created</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-32 shrink-0">Size</th>
                  <th className="text-left p-3 pt-1 text-[10px] font-mono uppercase tracking-wider text-text-3 w-24 shrink-0">Actions</th>
                </tr>
              </thead>
              <tbody 
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const img = filteredImages[virtualRow.index];
                  return (
                    <ImageRow 
                      key={img.id} 
                      img={img}
                      onRemove={() => {
                        if (confirm(`Delete image ${img.repo_tags?.[0] || img.id}?`)) {
                          remove.mutate({ id: img.id });
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isPulling && <PullModal onClose={() => { setIsPulling(false); refetch(); }} />}
    </div>
  );
}

function PullModal({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState("");
  const [tag, setTag] = useState("latest");
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<Record<string, PullProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const { pull } = useImageMutations();

  useEffect(() => {
    const unlistenProgress = listen<PullProgress>("pull-progress", (e) => {
      const p = e.payload;
      if (p.id) {
        setProgress(prev => ({ ...prev, [p.id!]: p }));
      }
    });

    const unlistenError = listen<string>("pull-error", (e) => {
      setError(e.payload);
      setPulling(false);
    });

    const unlistenFinished = listen<void>("pull-finished", () => {
      setPulling(false);
      onClose();
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenError.then(fn => fn());
      unlistenFinished.then(fn => fn());
    };
  }, [onClose]);

  const handlePull = async () => {
    if (!image) return;
    setPulling(true);
    setError(null);
    setProgress({});
    try {
      await pull.mutateAsync({ image, tag });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface-hi">
          <h3 className="text-[15px] font-bold m-0">Pull Image</h3>
          <button onClick={onClose} className="text-text-3 hover:text-text bg-transparent border-none cursor-pointer text-xl p-1">&times;</button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {!pulling ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-3">Image Name</label>
                <input 
                  value={image} 
                  onChange={e => setImage(e.target.value)} 
                  placeholder="e.g. nginx, postgres"
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-[13px] outline-none focus:border-green focus:ring-1 focus:ring-green/30"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-3">Tag</label>
                <input 
                  value={tag} 
                  onChange={e => setTag(e.target.value)} 
                  placeholder="latest"
                  className="bg-surface-2 border border-border rounded-md px-3 py-2 text-[13px] outline-none focus:border-green focus:ring-1 focus:ring-green/30"
                />
              </div>
              {error && <p className="text-error text-[12px] m-0 bg-error/10 p-2 rounded border border-error/20">{error}</p>}
              <button 
                onClick={handlePull} 
                disabled={!image}
                className="mt-2 bg-green text-surface-2 font-bold py-2.5 rounded-md hover:bg-green-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[14px]"
              >
                Pull Image
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 border-2 border-green border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[13px] font-medium text-text-2">Pulling {image}:{tag}...</span>
              </div>
              
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2">
                {Object.values(progress).map((p) => (
                  <div key={p.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-text-3">{p.id}</span>
                      <span className="text-text-2">{p.status}</span>
                    </div>
                    {p.current !== undefined && p.total !== undefined && (
                      <div className="bg-surface-3 rounded h-1 overflow-hidden">
                        <div 
                          className="bg-green h-full transition-all duration-300"
                          style={{ width: `${(p.current / p.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(progress).length === 0 && <p className="text-[12px] text-text-3 italic">Waiting for progress...</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
