import { ArrowRight, Play, Building2,Briefcase, Heart, UsersRound } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import coverImg from '@/assets/cover-preview.jpg';

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-background pt-6">
      {/* Background Decor - Responsive scaling */}
      <div className="absolute top-0 left-0 w-64 h-64 md:w-96 md:h-96 blob-indigo opacity-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] blob-rose opacity-10 translate-x-1/4 translate-y-1/4 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 md:px-12 lg:px-24 py-8 md:py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left: Copy Content */}
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            <h1 className="text-3xl xsm:text-4xl xs:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-extrabold text-foreground mb-6 leading-[1.1] tracking-tight">
              Attract top talent<br />
              with a powerful<br />
              employer brand
            </h1>

            <p className="text-base xsm:text-lg text-muted-foreground mb-6 md:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Create a compelling company presence, highlight your culture, and connect with the right candidates all from one platform.
            </p>

            <div className="flex flex-col xs:flex-row items-center justify-center lg:justify-start gap-4">
              <Button size="lg" className="group w-full xs:w-auto h-12 px-8 text-base rounded-full">
                Get Started
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" className="w-full xs:w-auto h-12 px-8 text-base gap-2 rounded-full">
                <Play className="w-4 h-4 fill-current" />
                Book Demo
              </Button>
            </div>
          </div>

          {/* Right: UI Mockup Preview - Visible from 'lg' upwards */}
          <div className="relative hidden lg:block animate-in fade-in slide-in-from-right-8 duration-1000">
            <div className="relative rounded-2xl border border-border bg-card shadow-xl overflow-hidden 
            transform hover:scale-[1.02] transition-transform duration-500">
              {/* Mock browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/20 border border-amber-400/40" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 rounded-md bg-background/50 border border-border flex items-center px-3">
                    <span className="text-[10px] text-muted-foreground truncate">yourcompany.jobs/culture</span>
                  </div>
                </div>
              </div>

              {/* Mock content */}
              <div className="p-5 space-y-5">
                {/* Cover Photo */}
                <div className="relative h-32 xl:h-40 rounded-xl overflow-hidden group">
                  <img src={coverImg} alt="Preview" className="w-full h-full object-cover transition-transform duration-700
                   group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                {/* Profile Section */}
                <div className="flex items-end gap-4 -mt-10 relative z-10 px-2">
                  <div className="w-12 h-12 rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="pb-1">
                    <p className="text-base font-bold text-foreground">NovaPay Technologies</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Fintech • San Francisco, CA
                    </p>
                  </div>
                </div>

                  <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: UsersRound, label: 'Team', value: '1,200+' },
                    { icon: Briefcase, label: 'Open Roles', value: '48' },
                    { icon: Heart, label: 'Rating', value: '4.8★' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-muted/50 border border-border p-3 text-center">
                      <m.icon className="w-4 h-4 mx-auto mb-1 text-indigo" />
                      <p className="text-sm font-semibold text-foreground">{m.value}</p>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {['Innovation', 'Remote-first', 'DEI Focus', 'Growth'].map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-indigo/10 text-indigo font-medium">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HeroSection;