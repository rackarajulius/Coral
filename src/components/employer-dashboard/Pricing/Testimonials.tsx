import { Badge } from '@/components/ui/badge'
import { testimonials } from '@/data/employer/pricing/pricing'
import { cn } from '@/lib/utils'
import { Quote } from 'lucide-react'
import React from 'react'

const Testimonials = () => {
  return (
     <section className="mx-auto mt-5 max-w-6xl px-6">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Loved by recruiting leaders
        </h2>
        <p className="mt-3 text-muted-foreground">Real outcomes from teams that switched.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 [grid-auto-rows:1fr]">
        {testimonials.map((t, i) => (
          <figure
            key={t.name}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-0.5 hover:shadow-elevated",
              i === 0 && "lg:row-span-2 lg:bg-gradient-to-br lg:from-card lg:to-secondary/50"
            )}
          >
            <Quote className="h-5 w-5 text-accent/60" />
            <blockquote className={cn("mt-4 text-foreground/90", i === 0 ? "text-lg leading-relaxed" : "text-sm leading-relaxed")}>
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                </div>
              </div>
              <Badge variant="secondary" className="border border-accent/20 bg-accent/10 text-accent">
                {t.metric}
              </Badge>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default Testimonials
