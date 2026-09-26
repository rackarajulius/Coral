import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera, ChevronLeft, ChevronRight, Play, Pause,
  Volume2, VolumeX, Maximize, X, Info
} from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/** A direct/object video URL we can play inline with <video> (vs. an embed link). */
function isPlayableVideoUrl(v: string): boolean {
  return (
    v.startsWith('data:video') ||
    v.startsWith('blob:') ||
    v.includes('/storage/v1/object/public/') ||
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v)
  );
}

/** Converts common share links (YouTube/Vimeo/Loom) to their embeddable iframe URL. */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'loom.com') {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch {
    /* not a parseable URL — fall through */
  }
  return url;
}

// --- Custom Video Player Component ---
const CultureVideoPlayer = ({ videoUrl }: { videoUrl: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout>();

  const togglePlay = () => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    setIsPlaying(!videoRef.current.paused);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    const time = (value[0] / 100) * videoRef.current.duration;
    videoRef.current.currentTime = time;
    setProgress(value[0]);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => isPlaying && setShowControls(false), 2500);
  };

  return (
    <div 
      className="relative rounded-2xl overflow-hidden bg-black group shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video object-cover cursor-pointer"
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer" onClick={togglePlay}>
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-xl transform transition-transform group-hover:scale-110">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className={cn(
        "absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-500 pt-12",
        showControls || !isPlaying ? "opacity-100" : "opacity-0"
      )}>
        <Slider 
          value={[progress]} 
          onValueChange={handleSeek} 
          max={100} 
          step={0.1} 
          className="mb-4"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 rounded-full" onClick={togglePlay}>
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 rounded-full" onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <span className="text-xs font-mono text-white/80 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 rounded-full" onClick={() => videoRef.current?.requestFullscreen()}>
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Main Gallery Component ---
interface CompanyMediaGalleryProps {
  company?: EmployerCompany;
}

const CompanyMediaGallery = ({ company }: CompanyMediaGalleryProps) => {
  // Real profiles carry their own photos/video; the mock preview uses samples.
  const photos = company
    ? company.galleryPhotos.map((p) => ({ src: p.url, label: p.caption || 'Photo' }))
    : mockCompany.media.photos;
  const cultureVideoUrl = company ? (company.cultureVideoUrl ?? '') : mockCompany.media.cultureVideoUrl;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // The masonry grid shows up to 5 photos (1 lead + 4 small). The 6th, 7th… are
  // revealed by paging through with the chevrons — the layout itself stays put.
  const PHOTOS_PER_PAGE = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(Math.ceil(photos.length / PHOTOS_PER_PAGE), 1);
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PHOTOS_PER_PAGE;
  const pagePhotos = photos.slice(pageStart, pageStart + PHOTOS_PER_PAGE);

  const goNext = useCallback(() => setSelectedIndex(prev => (prev! + 1) % photos.length), [photos.length]);
  const goPrev = useCallback(() => setSelectedIndex(prev => (prev! - 1 + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') setSelectedIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex, goNext, goPrev]);

  // A real company with no uploaded media shouldn't show an empty "culture" card.
  if (company && photos.length === 0 && !cultureVideoUrl) return null;

  return (
    <>
      <Card id="media" className="border-border/50 rounded-3xl shadow-sm overflow-hidden scroll-mt-28">
        <CardHeader className="pb-6 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2 text-foreground">
              <Camera className="h-5 w-5 text-primary" />
              Inside Our Culture
            </CardTitle>
            <div className="flex items-center gap-2">
               {photos.length > 0 && (
                 <Badge variant="secondary" className="rounded-full font-bold text-[10px] px-2.5">
                   {photos.length} photos
                 </Badge>
               )}
               {cultureVideoUrl && (
                 <Badge variant="secondary" className="rounded-full font-bold text-[10px] px-2.5 bg-primary/10 text-primary border-none">
                   1 VIDEO
                 </Badge>
               )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-10">
          {/* Section 1: Video */}
          {cultureVideoUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Featured: Culture Reel</h3>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                <Info className="h-3 w-3 mr-1" /> Details
              </Button>
            </div>
            {isPlayableVideoUrl(cultureVideoUrl) ? (
              <CultureVideoPlayer videoUrl={cultureVideoUrl} />
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl aspect-video">
                <iframe
                  src={toEmbedUrl(cultureVideoUrl)}
                  title="Culture video"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
          )}

          {/* Section 2: Photo Grid — 1 lead + 4 small; chevrons page through the 6th+ */}
          {photos.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary/40" />
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">The Workspace</h3>
              </div>
              {totalPages > 1 && (
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="outline" size="icon" className="rounded-full h-8 w-8" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous photos">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full h-8 w-8" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)} aria-label="More photos">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-[280px] sm:h-[340px] lg:h-[420px]">
              <div
                role="button"
                tabIndex={0}
                aria-label={`View photo: ${pagePhotos[0].label}`}
                className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg border border-border/40"
                onClick={() => setSelectedIndex(pageStart)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(pageStart)}
              >
                <img src={pagePhotos[0].src} alt={pagePhotos[0].label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                   <p className="text-white text-sm font-bold tracking-tight">{pagePhotos[0].label}</p>
                </div>
              </div>

              {pagePhotos.slice(1).map((photo, i) => (
                <div
                  key={`${photo.label}-${pageStart + i + 1}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo: ${photo.label}`}
                  className="relative rounded-2xl overflow-hidden cursor-pointer group border border-border/40 shadow-sm"
                  onClick={() => setSelectedIndex(pageStart + i + 1)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(pageStart + i + 1)}
                >
                  <img src={photo.src} alt={photo.label} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                     <Maximize className="text-white h-6 w-6 scale-75 group-hover:scale-100 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* --- Lightbox Modal --- */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-6xl p-0 bg-black/98 border-none overflow-hidden ring-0">
          <DialogTitle className="sr-only">Lightbox Gallery</DialogTitle>
          {selectedIndex !== null && (
            <div className="relative h-[85vh] flex flex-col">
              <div className="p-4 flex justify-between items-center text-white z-50">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Media Gallery</span>
                <Button variant="ghost" size="icon" aria-label="Close gallery" className="text-white hover:bg-white/10 rounded-full" onClick={() => setSelectedIndex(null)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="flex-1 relative flex items-center justify-center p-4">
                <img
                  src={photos[selectedIndex].src}
                  alt={photos[selectedIndex].label}
                  className="max-w-full max-h-full object-contain animate-in fade-in zoom-in-95 duration-500 rounded-lg shadow-2xl"
                />
                <Button variant="ghost" size="icon" aria-label="Previous photo" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-14 sm:w-14 bg-white/5 hover:bg-white/10 rounded-full text-white" onClick={goPrev}>
                  <ChevronLeft className="h-5 w-5 sm:h-8 sm:w-8" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Next photo" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-14 sm:w-14 bg-white/5 hover:bg-white/10 rounded-full text-white" onClick={goNext}>
                  <ChevronRight className="h-5 w-5 sm:h-8 sm:w-8" />
                </Button>
              </div>

              <div className="p-8 text-center bg-gradient-to-t from-black to-transparent">
                 <h4 className="text-xl font-bold text-white mb-2">{photos[selectedIndex].label}</h4>
                 <div className="flex justify-center gap-1.5">
                   {photos.map((_, i) => (
                     <div key={i} className={cn("h-1 rounded-full transition-all duration-300", i === selectedIndex ? "w-8 bg-primary" : "w-1.5 bg-white/20")} />
                   ))}
                 </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompanyMediaGallery;