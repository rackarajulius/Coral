import { Button } from '@/components/ui/button';
import { Bell, Download, MessageSquare, Settings, Share2, Shield } from 'lucide-react';
import React from 'react'

const Header = () => {
  return (

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Employer Reviews</h1>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                    Monitor, analyze, and respond to reviews from employees, candidates, contractors, and interns.
                  </p>
                </div>
                  <Button variant="outline" size="sm" className="gap-2"><Bell className="h-4 w-4" />Alerts</Button>
                  <Button variant="outline" size="sm" className="gap-2"><Share2 className="h-4 w-4" />Share Report</Button>
                  <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export</Button>
                  <Button size="sm" variant='default'><MessageSquare className="h-4 w-4" />Respond to Reviews</Button>
               
      </div>
   
  );
};

export default Header;
