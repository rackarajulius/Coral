import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'

const AIMatching = () => {
  return (
    <section className="py-20 px-6 bg-gradient-to-br from-[hsl(270,76%,12%)]
     to-[hsl(239,84%,18%)] text-white relative overflow-hidden">
         <div className="absolute inset-0 opacity-20 blob-indigo pointer-events-none" />
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* AI Score Viz */}
          <div className="flex justify-center">
            <div className="glass rounded-3xl p-8 w-full max-w-sm space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">AI Match Score</span>
                <span className="text-4xl font-extrabold text-white">94%</span>
              </div>
               <Progress value={94} className="h-3 bg-white/20 overflow-hidden [&>div]:transition-all [&>div]:duration-700
                 [&>div]:ease-out [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-orange-500"/>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Skills Match', value: 'Excellent' },
                  { label: 'Experience', value: '5+ years' },
                  { label: 'Culture Fit', value: 'High' },
                  { label: 'Availability', value: 'Immediate' },
                ].map((d) => (
                  <div key={d.label} className="text-center">
                    <p className="text-xs text-white/60">{d.label}</p>
                    <p className="text-sm font-semibold text-white">{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
              <span className="text-sm font-semibold text-[hsl(var(--accent))]">AI Powered</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-5">
              AI-Powered Candidate Matching
            </h2>
            <p className="text-white/70 leading-relaxed mb-8">
              Our advanced AI analyzes resumes, skills, and experience to automatically
              rank candidates by relevance. Save hours of manual screening and find the
              best fit for your roles.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Smart resume parsing and skill extraction',
                'Automated candidate ranking',
                'Bias-reduced screening',
                'Transparent scoring explanations',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Button variant="default" size="lg" asChild>
              <Link to="/ai-hiring">
                Explore AI Matching <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      
    </section>
  )
}

export default AIMatching
