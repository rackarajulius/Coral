import Header from '@/components/Header'
import AboutSection from '@/components/jobSeeker/AboutSection'
import ActivityFeed from '@/components/jobSeeker/ActivityFeed'
import AIToolsSidebar from '@/components/jobSeeker/AIToolsSidebar'
import CertificationsSection from '@/components/jobSeeker/CertificationsSection'
import ContactLinksSection from '@/components/jobSeeker/ContactLinksSection'
import EducationSection from '@/components/jobSeeker/EducationSection'
import ExperienceSection from '@/components/jobSeeker/ExperienceSection'
import PortfolioSection from '@/components/jobSeeker/PortfolioSection'
import RecommendationsSection from '@/components/jobSeeker/RecommendationsSection'
import ProfileFooter from '@/components/jobSeeker/ProfileFooter'
import ProfileHero from '@/components/jobSeeker/ProfileHero'
import ResumeSection from '@/components/jobSeeker/ResumeSection'
import ProgressSidebar from '@/components/jobSeeker/ProgressSidebar'
import React from 'react'

const Profile = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation Bar */}
      <Header/>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Progress Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-6 pt-16">
              <ProgressSidebar />
            </div>
          </div>

          {/* Center - Hero and Main Content */}
          <main className="flex-1 min-w-0 mx-auto lg:mx-0" role="main">
            {/* Hero Section */}
            <div className="pt-16 mb-6">
              <ProfileHero />
            </div>

            {/* Main Content Cards */}
            <div className="space-y-4">
              <AboutSection />
              <ContactLinksSection />
              {/* Before Experience on purpose: it is the single highest-leverage
                  thing on this page, and the sections below it are largely what
                  it fills in. */}
              <ResumeSection />
              <ExperienceSection/>
              <EducationSection/>
              <CertificationsSection/>
              <PortfolioSection />
              <RecommendationsSection />
              <ActivityFeed />
              <ProfileFooter />
            </div>
          </main>

          {/* Right Sidebar - AI Tools */}
          <div className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-6 pt-16">
               <AIToolsSidebar />
           
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
