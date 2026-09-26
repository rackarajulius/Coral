import { Activity, Briefcase, Camera, Edit3, GraduationCap, LogOut, Settings, User, Users } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '../ui/button'
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { ProfileAvatar } from '@/components/jobSeeker/ProfileVisuals';


const menuItems = [
  { icon: User, label: 'Profile', path: '/jobseeker/profile' },
  { icon: Users, label: 'Connections', path: '/connections' },
  { icon: Activity, label: 'Activity', path: '/activity' },
  { icon: Briefcase, label: 'Job preferences', path: '/jobseeker/preferences' },
  { icon: GraduationCap, label: 'AI Interview Prep', path: '/interview-prep' },
  { icon: Settings, label: 'Settings', path: '/jobseeker/settings' },
];

const ProgressSidebar = () => {
   const location = useLocation();
  const currentPath = location.pathname;
  const { profile } = useProfile();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading: isUploading, upload: uploadAvatarFile } = useAvatarUpload();

  // Home, the same place every other sign-out lands (the route gate sends
  // you there too). Going via /login reopened the sign-in modal the moment
  // you had chosen to leave.
  const handleSignOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadAvatarFile(file);
  };

  const handleEditClick = () => {
    fileInputRef.current?.click();
  };


    
    
  return (
    <aside className='w-64 '>

    {/* Section 1: Profile Image with Edit */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-4 hover:shadow-md transition-shadow duration-300">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={handleEditClick}>
            <ProfileAvatar
              name={profile.name}
              avatarUrl={profile.avatarUrl || user?.avatarUrl || undefined}
              className="w-24 h-24 rounded-full ring-4 ring-gray-50 dark:ring-gray-700 shadow-md transition-all duration-300 group-hover:ring-blue-100 dark:group-hover:ring-blue-900"
              textClassName="text-xl"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100" />
              )}
            </div>
            {/* Edit button - always visible, scales up on hover */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick();
              }}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 group-hover:scale-110 transform scale-100"
              aria-label="Upload new photo"
              disabled={isUploading}
            >
              <Edit3 className="w-4 h-4 text-white" />
            </button>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              aria-label="Upload profile photo"
            />
          </div>
          <h3 className="mt-3 font-semibold text-gray-900 dark:text-white text-center">
            {profile.name || 'Your profile'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-0.5">{profile.headline?.split('|')[0]?.trim()}</p>
        </div>
      </div>
      


      {/* Section 2: Menu Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 
      dark:border-gray-700 overflow-hidden transition-shadow duration-300">
        <nav className="py-2">
          {menuItems.map((item, index) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className="font-medium">{item.label}</span>
                {index === 0 && (
                  <span className="ml-auto bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                    Pro
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>


      {/* Section 3: Sign Out */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300
        dark:border-gray-700 overflow-hidden mt-4 transition-shadow duration-300">
        <Button onClick={handleSignOut} variant='outline' className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600
         dark:text-gray-300 dark:hover:bg-red-900/20 hover:text-red-600
         transition-all duration-200">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign out</span>
        </Button>
      </div>
    </aside>
  )
}

export default ProgressSidebar
