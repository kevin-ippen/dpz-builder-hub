import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/use-api';

interface AssetImage {
  id: string;
  image_url: string;
  image_type: string;
  sort_order: number;
  caption?: string;
  alt_text?: string;
}

interface ImageCarouselProps {
  assetId: string;
}

export function ImageCarousel({ assetId }: ImageCarouselProps) {
  const { get: apiGet } = useApi();
  const [images, setImages] = useState<AssetImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    (async () => {
      const resp = await apiGet<any>(`/api/dpz/assets/${assetId}/images`);
      if (!resp.error && resp.data?.items?.length) {
        setImages(resp.data.items);
      }
    })();
  }, [assetId, apiGet]);

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);

  if (images.length === 0) return null;

  const img = images[current];

  return (
    <>
      {/* Inline carousel */}
      <div className="relative group/carousel rounded-lg overflow-hidden border bg-muted/30">
        <div className="relative aspect-[2/1] overflow-hidden">
          <img
            src={img.image_url}
            alt={img.alt_text || img.caption || 'Screenshot'}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          {/* Expand button */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/70"
            aria-label="Expand image"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/60"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/60"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dots + caption */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            {img.caption && (
              <span className="text-[11px] text-white/90 font-medium truncate mr-2">
                {img.caption}
              </span>
            )}
            {images.length > 1 && (
              <div className="flex gap-1 ml-auto">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full transition-all',
                      i === current ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/70',
                    )}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={img.image_url}
              alt={img.alt_text || img.caption || 'Screenshot'}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            {img.caption && (
              <p className="text-center text-sm text-white/80 mt-3">{img.caption}</p>
            )}
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-3">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i === current ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
