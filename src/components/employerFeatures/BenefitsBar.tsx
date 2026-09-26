import React from 'react'
import { Card, CardContent } from '../ui/card';
import { Clock, Shield, Target, TrendingUp, UsersRound } from 'lucide-react';





const benefits = [
  { icon: Clock, title: 'Faster Hiring', description: 'Reduce time-to-hire by up to 40% with streamlined processes and AI assistance.' },
  { icon: UsersRound, title: 'Better Candidates', description: 'AI matching ensures you find candidates with the right skills and cultural fit.' },
  { icon: TrendingUp, title: 'Higher ROI', description: 'Track every dollar spent and optimize your recruitment budget effectively.' },
  { icon: Shield, title: 'Secure & Compliant', description: 'Enterprise-grade security with full GDPR compliance and data protection.' },
];

const BenefitsBar = () => { 
  return (
    <section className="py-16 px-6 bg-background">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <Card key={b.title} className="border border-border shadow-none bg-card text-center">
              <CardContent className="pt-6 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        
    </section>
  )
}

export default BenefitsBar
