import React from 'react'
import { Badge } from '../ui/badge';
import { ArrowRight, Eye, FileText, MessageCircle, MessageSquare, Users, UsersRound } from 'lucide-react';
import { Button } from '../ui/button';

const pipelineCandidates = [
  { initials: 'SJ', name: 'Candidate 1', role: 'Software Engineer', score: 86 },
  { initials: 'MC', name: 'Candidate 2', role: 'Software Engineer', score: 87 },
  { initials: 'ED', name: 'Candidate 3', role: 'Software Engineer', score: 88 },
];
const ATS = () => {
  return (
    <section className="py-20 px-6 surface-light">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5">
              Applicant Tracking System
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Our intuitive Kanban-style pipeline makes it easy to manage candidates through
              every stage of the hiring process. Drag and drop candidates, add notes, schedule
              interviews, and collaborate with your team—all in one place.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                { icon: UsersRound, text: 'Kanban-style pipeline with custom stages' },
                { icon: MessageCircle, text: 'In-app messaging with candidates' },
                { icon: FileText, text: 'Resume parsing and candidate profiles' },
                { icon: Eye, text: 'Activity tracking and audit logs' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm text-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
            <Button variant="default" size="lg" className="rounded-full">
              Start Tracking Applicants <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Mock Pipeline */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="grid grid-cols-4 gap-2 mb-5">
              {['New', 'Reviewed', 'Interview', 'Hired'].map((stage, idx) => (
                <div key={stage} className="text-center">
                  <span className="text-xs font-semibold text-foreground">{stage}</span>
                  <span className="block text-xs text-muted-foreground">({[4, 3, 2, 1][idx]})</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {pipelineCandidates.map((c) => (
                <div key={c.initials} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {c.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">{c.score}%</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
    </section>
  )
}

export default ATS
