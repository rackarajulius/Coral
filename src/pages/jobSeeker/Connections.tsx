import { Users, UserPlus, Search, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import ProgressSidebar from '@/components/jobSeeker/ProgressSidebar';
import { useProfile } from '@/contexts/ProfileContext';

const Connections = () => {
  const { profile } = useProfile();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-6 pt-16">
              <ProgressSidebar />
            </div>
          </div>

          {/* Center */}
          <main className="flex-1 min-w-0 mx-auto lg:mx-0" role="main">
            <div className="pt-16 space-y-6 max-w-4xl">
              {/* Heading + count */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Connections</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {/* No count until something is actually counting them — the
                        card below already says the feature is on its way. */}
                    {profile.connections
                      ? profile.connections + ' connections in your network'
                      : 'Your professional network'}
                  </p>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search your connections..." className="pl-9" />
              </div>

              {/* Empty state */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <UserPlus className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grow your network</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Connection management is coming soon. In the meantime, discover people and
                  companies across the platform to start building your network.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                  <Button asChild>
                    <Link to="/community">
                      <Compass className="w-4 h-4 mr-2" />
                      Explore community
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/companies">Browse companies</Link>
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Connections;
