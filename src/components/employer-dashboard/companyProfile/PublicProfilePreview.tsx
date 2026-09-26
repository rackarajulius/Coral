import { EmployerBrand } from "@/data/companyProfile/employer-brand-schema";
import { Building2, Globe, MapPin, Users, Calendar, Quote, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSocialIcon } from "@/lib/socialIcons";
import { Icon } from "./IconPicker";

interface Props {
  data: EmployerBrand;
}

function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return null;
}

export function PublicProfilePreview({ data }: Props) {
  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <div className="relative">
        <div className="aspect-[4/1] w-full bg-muted overflow-hidden">
          {data.banner ? (
            <img src={data.banner} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-hero" />
          )}
        </div>
        <div className="px-6 md:px-10 -mt-12 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="w-24 h-24 rounded-2xl bg-card border-4 border-card shadow-elevated overflow-hidden flex items-center justify-center shrink-0">
              {data.logo ? (
                <img src={data.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 pb-1">
              <h1 className="font-display font-bold text-2xl md:text-3xl tracking-tight">
                {data.displayName || "Your company name"}
              </h1>
              {data.tagline && <p className="text-muted-foreground mt-1">{data.tagline}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
                {data.headquarters && (
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.headquarters}</span>
                )}
                {data.companySize && (
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{data.companySize} employees</span>
                )}
                {data.foundedYear && (
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Founded {data.foundedYear}</span>
                )}
                {data.website && (
                  <a href={data.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                    <Globe className="w-3.5 h-3.5" />{data.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {data.industries.slice(0, 5).map((i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground">
                    {i}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {data.social.map((s) => {
                const SocialIcon = getSocialIcon(s.label);
                return <SocialBtn key={s.id} href={s.url} icon={<SocialIcon className="w-4 h-4" />} />;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 space-y-10">
        {/* About */}
        {data.overview && (
          <Section title="About">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{data.overview}</p>
            {(data.mission || data.vision) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {data.mission && (
                  <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-accent mb-1">Mission</p>
                    <p className="text-sm">{data.mission}</p>
                  </div>
                )}
                {data.vision && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-primary mb-1">Vision</p>
                    <p className="text-sm">{data.vision}</p>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Values */}
        {data.values.length > 0 && (
          <Section title="What we value">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.values.map((v) => (
                <div key={v.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="mb-2 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name={v.icon} className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-sm">{v.title}</p>
                  {v.description && <p className="text-xs text-muted-foreground mt-1">{v.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Why work here */}
        {data.whyWorkHere.length > 0 && (
          <Section title="Why work here">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.whyWorkHere.map((w) => (
                <div key={w.id} className="p-4 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40">
                  <div className="mb-2 w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon name={w.icon} className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-sm">{w.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Gallery */}
        {data.gallery.length > 0 && (
          <Section title="Life at the company">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {data.gallery.map((g, i) => (
                <div
                  key={g.id}
                  className={`rounded-xl overflow-hidden bg-muted ${i === 0 ? "row-span-2 col-span-2 md:col-span-1" : ""}`}
                >
                  <img src={g.url} alt={g.caption || ""} className="w-full h-full object-cover aspect-square" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Video */}
        {data.cultureVideo && (
          <Section title="A look inside">
            <div className="aspect-video rounded-2xl overflow-hidden bg-muted relative">
              {data.cultureVideo.startsWith("http") ? (
                (() => {
                  const embedUrl = toEmbedUrl(data.cultureVideo!);
                  return embedUrl ? (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-4 text-center">
                      <Play className="w-8 h-8 opacity-40" />
                      <span>Preview unavailable — paste a YouTube, Vimeo, or Loom URL to embed.</span>
                    </div>
                  );
                })()
              ) : (
                <>
                  <video src={data.cultureVideo} controls className="w-full h-full" />
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/60 text-primary-foreground text-[11px] backdrop-blur pointer-events-none">
                    <Play className="w-3 h-3" /> Culture video
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* Benefit categories */}
        {data.benefitCategories.length > 0 && (
          <Section title="Perks & benefits">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.benefitCategories.map((cat) => (
                <div key={cat.id} className=" bg-card p-4 h-full flex flex-col">
                  <div className="mb-3 min-w-0">
                    <p className="font-semibold text-sm">{cat.name || "Untitled category"}</p>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cat.description}</p>
                    )}
                  </div>
                  {cat.items.length > 0 && (
                    <div className="flex flex-col gap-2 mt-auto">
                      {cat.items.map((it) => (
                        <div
                          key={it.id}
                          className={cn(
                            "p-3 rounded-xl border",
                            it.featured ? "border-accent/40 bg-accent/5" : "border-border bg-background"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg bg-muted text-foreground/80 flex items-center justify-center shrink-0">
                              <Icon name={it.icon} className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{it.label}</p>
                                {it.featured && (
                                  <Star className="w-3 h-3 text-accent fill-accent shrink-0" />
                                )}
                              </div>
                              {it.description && (
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  {it.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {it.type && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                                    {it.type}
                                  </span>
                                )}
                                {(it.locations || []).slice(0, 3).map((l) => (
                                  <span
                                    key={l}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground border border-border"
                                  >
                                    <MapPin className="w-2.5 h-2.5" />
                                    {l}
                                  </span>
                                ))}
                                {(it.locations?.length || 0) > 3 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{(it.locations!.length - 3)} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {data.cultureDescription && (
              <p className="text-sm text-muted-foreground mt-5 leading-relaxed">{data.cultureDescription}</p>
            )}
          </Section>
        )}

        {/* Awards & Accreditations */}
        {(data.awards || []).length > 0 && (
          <Section title="Awards & Accreditations">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.awards.map((award) => (
                <div
                  key={award.id}
                  className="group relative p-5 rounded-2xl border border-border bg-card hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                      {award.badgeUrl ? (
                        <img src={award.badgeUrl} alt={award.title} className="w-full h-full object-cover" />
                      ) : (
                        <Star className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    {award.year && (
                      <span className="px-2 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-medium tracking-wide">
                        {award.year}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight mb-1">{award.title}</h3>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                    {award.organization}
                  </p>
                  {award.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-auto">
                      {award.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Testimonials */}
        {data.testimonials.length > 0 && (
          <Section title="From the team">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.testimonials.map((t) => (
                <div key={t.id} className="p-5 rounded-2xl border border-border bg-card relative">
                  <Quote className="absolute top-3 right-3 w-5 h-5 text-accent/30" />
                  <p className="text-sm leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3 mt-4">
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted" />
                    )}
                    <div>
                      <p className="text-sm font-semibold leading-tight">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Video Testimonials */}
        {data.videoTestimonials.filter((v) => v.videoUrl || v.thumbnail).length > 0 && (
          <Section title="Hear from the team">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.videoTestimonials
                .filter((v) => v.videoUrl || v.thumbnail)
                .map((v) => (
                  <div key={v.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="relative aspect-video bg-muted">
                      {v.videoUrl ? (
                        <video
                          src={v.videoUrl}
                          poster={v.thumbnail}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : v.thumbnail ? (
                        <>
                          <img src={v.thumbnail} alt={v.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-foreground/70 backdrop-blur flex items-center justify-center">
                              <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold leading-tight">{v.name || "Employee"}</p>
                      <p className="text-xs text-muted-foreground">{v.role}</p>
                    </div>
                  </div>
                ))}
            </div>
          </Section>
        )}

        {/* DEI */}
        {data.deiStats.length > 0 && (
          <Section title="Our team in numbers">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.deiStats.map((s) => (
                <div key={s.id} className="p-4 rounded-xl border border-border bg-card text-center">
                  <p className="text-2xl font-bold text-accent">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Locations */}
        {data.locations.length > 0 && (
          <Section title="Where we are">
            <div className="flex flex-wrap gap-2">
              {data.locations.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border"
                >
                  <MapPin className="w-3 h-3" />
                  {l.city}, {l.country}
                  {l.isHQ && <span className="text-accent">· HQ</span>}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="font-display font-semibold text-lg mb-4">{title}</h2>
    {children}
  </section>
);

const SocialBtn = ({ href, icon }: { href: string; icon: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
  >
    {icon}
  </a>
);