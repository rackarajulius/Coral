import { Button } from '@/components/ui/button'
import { ArrowRight, Star } from 'lucide-react'

const FinalCta = () => {
  return (
    <section className="mx-auto mt-5 max-w-5xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-border p-12 text-center md:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
        />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-foreground backdrop-blur">
            <Star className="h-3 w-3 text-accent" /> Rated 4.9 / 5 by recruiting teams
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Start hiring smarter today.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-foreground/80 md:text-base">
            14-day free trial on Pro. No credit card required. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg">
              Get Started Free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Talk to Sales
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-foreground/60">
            <span>No credit card required</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>14-day free trial</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FinalCta
