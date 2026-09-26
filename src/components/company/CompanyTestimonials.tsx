import { useState, useRef, useEffect, useCallback } from 'react';
import { Quote, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoModal = ({ item, open, onClose }: { item: typeof mockCompany.videoTestimonials[0] | null; open: boolean; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  const handleClose = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    setProgress(0);
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-0 bg-background border-border overflow-hidden gap-0">
        <DialogTitle className="sr-only">{item.name} — Testimonial Video</DialogTitle>
        <div className="relative">
          <button
            onClick={handleClose}
            aria-label="Close video"
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-foreground/60 hover:bg-foreground/80 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-primary-foreground" />
          </button>
          <video
            ref={videoRef}
            src={item.videoUrl}
            className="w-full aspect-video object-cover cursor-pointer"
            playsInline
            preload="metadata"
            poster={item.thumbnail}
            onClick={togglePlay}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (!v) return;
              setCurrentTime(v.currentTime);
              setProgress((v.currentTime / v.duration) * 100);
            }}
            onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
            onEnded={() => setIsPlaying(false)}
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 cursor-pointer" onClick={togglePlay}>
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                <Play className="h-7 w-7 text-primary-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 to-transparent p-3 pt-8">
            <Slider
              value={[progress]}
              onValueChange={(val) => {
                const v = videoRef.current;
                if (!v) return;
                v.currentTime = (val[0] / 100) * v.duration;
                setProgress(val[0]);
              }}
              max={100}
              step={0.1}
              className="mb-2 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setIsMuted(v.muted);
                }}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <span className="text-xs text-primary-foreground/80 font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Speaker info */}
        <div className="p-4 flex items-center gap-3 border-t border-border">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{item.avatar}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.role}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AUTOPLAY_MS = 5000;

/**
 * Employee stories — DEMO ROUTE ONLY.
 *
 * There is no testimonials field on EmployerCompany and no endpoint behind
 * one, so every real employer page was showing the same invented people
 * ("Sarah Chen", "Marcus Johnson", "Priya Patel") vouching for them, with
 * invented video testimonials to match. Named strangers endorsing a real
 * company is not a placeholder, it is a fabrication.
 *
 * The real employee voice on this page is CompanyReviews, which is backed by
 * actual reviews. Until testimonials have data of their own, this renders
 * only for the demo company.
 */
interface CompanyTestimonialsProps {
  company?: EmployerCompany;
}

const CompanyTestimonials = ({ company }: CompanyTestimonialsProps) => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [activeVideo, setActiveVideo] = useState<typeof mockCompany.videoTestimonials[0] | null>(null);
  const t = mockCompany.testimonials;
  const videoTestimonials = mockCompany.videoTestimonials;

  const advance = useCallback(() => {
    setCurrent((c) => (c + 1) % t.length);
  }, [t.length]);

  useEffect(() => {
    if (paused || t.length <= 1) return;
    const id = setInterval(advance, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, advance, t.length]);

  // After the hooks, not before: an early return above them would change hook
  // order if a company ever arrived after the first render.
  if (company) return null;

  return (
    <>
      <Card className="border-border/50 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Employee Stories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Video Testimonials */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Video Testimonials</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videoTestimonials.map((item) => (
                <div
                  key={item.avatar}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play video testimonial from ${item.name}`}
                  className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[3/4] sm:aspect-square md:aspect-[4/3]"
                  onClick={() => setActiveVideo(item)}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveVideo(item)}
                >
                  <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/80 group-hover:bg-primary flex items-center justify-center transition-colors shadow-lg">
                      <Play className="h-4 w-4 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-primary-foreground text-xs font-semibold leading-tight">{item.name}</p>
                    <p className="text-primary-foreground/70 text-[10px]">{item.role}</p>
                  </div>
                  <span className="absolute top-2 right-2 bg-foreground/60 text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
                    {item.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Written Testimonial Carousel */}
          {t.length === 0 ? (
            <div className="p-6 rounded-xl bg-muted/50 border border-border/50 text-center text-muted-foreground">
              <p className="text-sm">No written testimonials yet.</p>
            </div>
          ) : (
          <div
            className="relative p-6 rounded-xl bg-muted/50 border border-border/50"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <Quote className="h-8 w-8 text-primary/20 mb-3" />
            <p className="text-sm text-foreground leading-relaxed italic mb-5">
              "{t[current].quote}"
            </p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {t[current].avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{t[current].name}</p>
                <p className="text-xs text-muted-foreground">{t[current].role} · {t[current].tenure}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-5">
              <div className="flex gap-1.5">
                {t.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrent(i); setPaused(false); }}
                    aria-label={`Go to testimonial ${i + 1}`}
                    className="relative h-1.5 rounded-full overflow-hidden bg-border transition-all"
                    style={{ width: i === current ? 24 : 6 }}
                  >
                    {i === current && !paused && (
                      <span
                        className="absolute inset-y-0 left-0 bg-primary rounded-full"
                        style={{ animation: `progress-fill ${AUTOPLAY_MS}ms linear forwards` }}
                      />
                    )}
                    {i === current && paused && (
                      <span className="absolute inset-0 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Previous testimonial" className="h-8 w-8 rounded-full" onClick={() => { setCurrent((current - 1 + t.length) % t.length); setPaused(false); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Next testimonial" className="h-8 w-8 rounded-full" onClick={() => { setCurrent((current + 1) % t.length); setPaused(false); }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      <VideoModal item={activeVideo} open={!!activeVideo} onClose={() => setActiveVideo(null)} />
    </>
  );
};

export default CompanyTestimonials;
