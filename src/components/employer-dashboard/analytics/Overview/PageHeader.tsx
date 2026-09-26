import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import FiltersBar from '../FilterBar';
import React from 'react'

const PageHeader = () => {
  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Analytics &amp; Reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track employer brand performance, hiring outcomes, candidate engagement, and talent
            market trends from one unified analytics workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="default" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>
      <FiltersBar />
    </header>
  );
};

export default PageHeader;
