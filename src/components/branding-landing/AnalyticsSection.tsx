import { Eye, MousePointerClick, FileText, Heart, Check } from 'lucide-react';

const metrics = [
  { icon: Eye, label: 'Profile Views', value: '12,847', change: '+34%' },
  { icon: MousePointerClick, label: 'Candidate Engagement', value: '4,291', change: '+28%' },
  { icon: FileText, label: 'Job Applications', value: '1,583', change: '+52%' },
  { icon: Heart, label: 'Talent Interest', value: '8,720', change: '+41%' },
];

const AnalyticsSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-96 h-96 blob-indigo opacity-5 -translate-y-1/2" />

      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Dashboard mock */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
             <div className="flex gap-1.5 border border-border rounded-full px-2 py-0.5">
                 <div className="w-3 h-3 rounded-full bg-red-400/20 border border-red-400/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/20 border border-amber-400/40" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-6 rounded-md border border-border bg-card flex items-center px-3">
                  <span className="text-xs text-muted-foreground">analytics.dashboard</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-border p-4 bg-background">
                    <div className="flex items-center justify-between mb-3">
                      <m.icon className="h-5 w-5 text-indigo" />
                      <span className="text-xs font-semibold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">{m.change}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
              {/* Chart placeholder */}
              <div className="mt-4 h-32 rounded-xl bg-card border border-border flex items-end px-4 pb-4 gap-2">
                {[40, 55, 35, 70, 60, 80, 65, 90, 75, 85, 95, 88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-orange-500/20 hover:bg-orange-500/40 transition-colors"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Measure your <span className="gradient-text-hero">employer brand impact</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Track profile views, candidate engagement, job applications, and talent interest in real-time. Make data-driven decisions to strengthen your employer brand.
            </p>
            <ul className="space-y-3">
              {['Real-time engagement metrics', 'Application funnel analytics', 'Candidate source tracking', 'Custom reporting dashboards'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                           <Check className="w-3 h-3 text-white" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalyticsSection;
