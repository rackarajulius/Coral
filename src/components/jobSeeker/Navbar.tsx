import { Briefcase } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { BRAND_NAME } from "@/lib/brand";

const Navbar = () => {
  return (
 <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-300 sm:px-6 md:px-8">
    <div className="container mx-auto px-4 md:px-6">
         <div className="flex h-16 items-center justify-between">
             <div className="flex items-center gap-4 ">
                 <Link to="/home" className="flex items-center gap-2 text-primary font-display font-bold text-xl">
                  <Briefcase className="h-6 w-6 text-coral" />
                   <span className="text-2xl font-semibold tracking-tight">{BRAND_NAME}</span>
                 </Link>
                 <nav className="hidden bs-mx:!hidden lg:flex xl:gap-4 items-center gap-6">
                  <Link to="/jobs" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
                   Find Jobs
                  </Link>
                  <Link to="/companies" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
                   Companies
                  </Link>
                  <Link to="/community" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Community
                  </Link>
                 </nav>
             </div>
         </div>
    </div>
 </header>
  )
}

export default Navbar
