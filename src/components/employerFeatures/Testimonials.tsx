import React from 'react'

import { Star } from 'lucide-react'
import { Card, CardContent } from '../ui/card';



const testimonials = [
  { quote: "The AI matching feature alone saved us countless hours of resume screening. We found better candidates faster.", author: "Sarah Chen", role: "HR Director", company: "TechStart Inc" },
  { quote: "Our employer branding page helped us attract 3x more qualified applicants. The ROI was immediate.", author: "Michael Roberts", role: "Talent Acquisition Lead", company: "Innovate Corp" },
  { quote: "The analytics dashboard gives us insights we never had before. We can now make truly data-driven hiring decisions.", author: "Emily Watson", role: "Recruiting Manager", company: "GrowthLabs" },
];

const Testimonials = () => {
  return (
    <section className="py-20 px-6">
         <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Trusted by <span className="gradient-text">Leading Companies</span>
            </h2>
            <p className="text-muted-foreground text-lg">See what HR professionals are saying about our platform</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.author} className="border-border/60">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {t.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.author}</p>
                      <p className="text-xs text-muted-foreground">{t.role}, {t.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      
    </section>
  )
}

export default Testimonials
