import React from 'react'
import RoiMetricCard from './RoiMetricCard'
import { roiMetrics } from '@/data/employer/pricing/pricing'

const RoiSection = () => {
  return (
     <section className="mx-auto mt-10 max-w-6xl px-6">
      <div className="mb-10 max-w-2xl">
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Measurable outcomes, not vanity metrics.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Aggregate results from 400+ recruiting teams using the Pro and Enterprise plans.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {roiMetrics.map((m) => (
          <RoiMetricCard key={m.label} {...m} />
        ))}
      </div>
    </section>
  )
}

export default RoiSection
