import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { 
  User, 
  Bell, 
  Shield, 
  Eye, 
  Key, 
  Mail,
  Smartphone,
  Link2,
  Trash2,
  Save,
  Briefcase,
  MapPin,
  DollarSign,
  Monitor,
  Sun,
  Moon,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UNDERLINE_TABS_LIST, UNDERLINE_TAB_TRIGGER } from '@/lib/tabStyles';
import { DemographicSelfReportCard } from '@/components/jobSeeker/DemographicSelfReportCard';
import { SubscriptionCard } from '@/components/jobSeeker/SubscriptionCard';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ProgressSidebar from '@/components/jobSeeker/ProgressSidebar';
import { useProfile } from '@/contexts/ProfileContext';
import {
  getViewVisibility,
  setViewVisibility as setViewVisibilityApi,
  type ViewVisibility,
} from '@/lib/api/jobSeekerProfile';
import { useAuth } from '@/contexts/AuthContext';

// Canonical vocabularies — these MUST match the backend + the Job Preferences
// page so both editors round-trip the same stored values.
const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior Level' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
];

const SettingsPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { profile, updateProfileInfo, updateJobPreferences, updateNotificationSettings, updatePrivacySettings } = useProfile();
  const { user, updateUser, changePassword, getLinkedProviders, linkProvider, unlinkProvider } = useAuth();

  // Account fields (names live on the User; headline + phone on the profile).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [phone, setPhone] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Connected accounts
  const [linkedProviders, setLinkedProviders] = useState<{ provider: string; email: string | null }[]>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const providerInfo = (provider: string) => linkedProviders.find((p) => p.provider === provider);

  useEffect(() => {
    getLinkedProviders().then(setLinkedProviders).catch(() => setLinkedProviders([]));
  }, [getLinkedProviders]);

  const handleChangePassword = async () => {
    if (!currentPassword) return toast.error('Enter your current password');
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return toast.error('New passwords do not match');

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggleProvider = async (provider: 'google' | 'apple') => {
    const isLinked = !!providerInfo(provider);
    setConnectingProvider(provider);
    try {
      if (isLinked) {
        await unlinkProvider(provider);
        toast.success(`${provider === 'google' ? 'Google' : 'Apple'} disconnected`);
        setLinkedProviders(await getLinkedProviders());
      } else {
        // Redirects to the provider's consent screen; returns to this page.
        await linkProvider(provider);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update connection');
    } finally {
      setConnectingProvider(null);
    }
  };
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    emailJobAlerts: true,
    emailApplicationUpdates: true,
    emailMarketing: false,
    pushJobAlerts: true,
    pushApplicationUpdates: true,
    pushMessages: true,
    pushJobRecommendations: true,
    emailJobRecommendations: false,
  });

  // Two different questions, deliberately two switches. "Open to work" says
  // whether you are looking; "discoverable" says whether recruiters may find
  // you. They used to be one flag, which meant nobody who was quietly employed
  // could ever be approached. Both live on the profile rather than in
  // privacySettings, so they are tracked here and saved through
  // updateProfileInfo with the rest of the page.
  const [openToWork, setOpenToWork] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);

  /**
   * How you appear to people whose profiles you view — and, by the same
   * switch, whether you get to see who viewed yours.
   *
   * Saved on change rather than with the page's Save button: it decides what
   * happens on your very next profile visit, and a setting that only takes
   * effect after you remember to press Save would quietly not be in force.
   */
  const [viewVisibility, setViewVisibility] = useState<ViewVisibility>('private');
  useEffect(() => {
    getViewVisibility()
      .then((v) => setViewVisibility(v.visibility))
      .catch(() => {
        /* leave the safe default showing rather than guessing */
      });
  }, []);

  const changeViewVisibility = async (next: ViewVisibility) => {
    const previous = viewVisibility;
    setViewVisibility(next);
    try {
      await setViewVisibilityApi(next);
      toast.success(
        next === 'private'
          ? 'You now browse privately — and your own viewer list is off'
          : 'Saved',
      );
    } catch (err) {
      setViewVisibility(previous);
      toast.error(err instanceof Error ? err.message : 'Could not save that');
    }
  };

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showEmail: false,
    showPhone: false,
    allowMessages: true,
    showSalaryExpectations: false,
  });

  // Job preferences — seeded from the profile in the effect below.
  const [jobPreferences, setJobPreferences] = useState({
    jobTypes: [] as string[],
    experienceLevel: '',
    expectedSalary: '',
    willingToRelocate: false,
    locations: [] as string[],
  });

  // Seed all editable fields from the contexts once they're available, without
  // clobbering edits-in-progress (seed only on the initial population).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setHeadline(profile.headline ?? '');
    setPhone(profile.phone ?? '');
    setJobPreferences({
      jobTypes: profile.jobPreferences.jobTypes ?? [],
      experienceLevel: profile.jobPreferences.experienceLevel ?? '',
      expectedSalary: profile.jobPreferences.expectedSalary ?? '',
      willingToRelocate: !!profile.jobPreferences.willingToRelocate,
      locations: profile.jobPreferences.locations ?? [],
    });
    setNotifications(profile.notificationSettings);
    setPrivacy(profile.privacySettings);
    setOpenToWork(profile.openToWork);
    setDiscoverable(profile.discoverable);
    seeded.current = true;
  }, [user, profile]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Names persist to the backend User via PATCH /users/me.
      const fn = firstName.trim();
      const ln = lastName.trim();
      await updateUser({
        firstName: fn,
        lastName: ln,
        displayName: [fn, ln].filter(Boolean).join(' ') || undefined,
      });

      // Headline, phone, job preferences, and notification/privacy settings all
      // flow through ProfileContext, which debounce-syncs them to the backend.
      updateProfileInfo({
        headline: headline.trim(),
        phone: phone.trim(),
        openToWork,
        discoverable,
      });
      updateJobPreferences({
        jobTypes: jobPreferences.jobTypes,
        experienceLevel: jobPreferences.experienceLevel,
        expectedSalary: jobPreferences.expectedSalary,
        willingToRelocate: jobPreferences.willingToRelocate,
        locations: jobPreferences.locations,
      });
      updateNotificationSettings(notifications);
      updatePrivacySettings(privacy);

      toast.success('Settings saved successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    toast.error('Account deletion is disabled in demo mode');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-6 pt-16">
              <ProgressSidebar />
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0 pt-16">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
            </div>

            <Tabs defaultValue="account" className="space-y-6">
              <div className="sticky top-16 z-10 -mx-4 px-4 bg-white dark:bg-gray-900">
              <TabsList className={UNDERLINE_TABS_LIST}>
                <TabsTrigger value="account" className={UNDERLINE_TAB_TRIGGER}>
                  <User className="w-4 h-4 mr-2" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="notifications" className={UNDERLINE_TAB_TRIGGER}>
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="privacy" className={UNDERLINE_TAB_TRIGGER}>
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy
                </TabsTrigger>
                <TabsTrigger value="preferences" className={UNDERLINE_TAB_TRIGGER}>
                  <Briefcase className="w-4 h-4 mr-2" />
                  Job Preferences
                </TabsTrigger>
              </TabsList>
              </div>

              {/* Account Tab */}
              <TabsContent value="account" className="space-y-6">
                <SubscriptionCard />

                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-card" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-card" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input id="email" type="email" value={user?.email ?? ''} readOnly className="pl-10 pr-10 bg-card text-gray-500 cursor-not-allowed" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-green-500" aria-label="Verified">
                          <Check className="h-2.5 w-2.5 text-green-500" strokeWidth={3} />
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Your email is managed by your sign-in and can't be changed here.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" className="pl-10 bg-card" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="headline">Professional Headline</Label>
                      <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Senior Product Manager | AI & FinTech" className="bg-card" />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Password & Security */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Password & Security
                    </CardTitle>
                    <CardDescription>Manage your password and account security</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" placeholder="••••••••" className="bg-card" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                      </div>
                      <div></div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" placeholder="••••••••" className="bg-card" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" placeholder="••••••••" className="bg-card" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                      </div>
                    </div>
                    <Button variant="outline" className="mt-2" onClick={handleChangePassword} disabled={passwordLoading}>
                      {passwordLoading ? 'Updating…' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Connected Accounts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link2 className="w-5 h-5" />
                      Connected Accounts
                    </CardTitle>
                    <CardDescription>Link your social accounts for easier login</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <div>
                          <p className="font-medium dark:text-white">Google</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                            {providerInfo('google')?.email ?? (providerInfo('google') ? 'Connected' : 'Not connected')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={connectingProvider === 'google'}
                        onClick={() => handleToggleProvider('google')}
                      >
                        {connectingProvider === 'google'
                          ? '…'
                          : providerInfo('google') ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16.7023 0C15.0734 0.0807095 13.2947 1.10192 12.2805 2.44211C11.3598 3.67134 10.6406 5.4183 10.9649 7.12095C12.7436 7.16879 14.572 6.11066 15.5574 4.77047C16.4782 3.54125 17.1178 1.79428 16.7023 0ZM16.7669 7.25371C14.3955 7.25371 13.7932 8.54191 12.0148 8.54191C10.1939 8.54191 8.88057 7.26972 6.86991 7.26972C4.92163 7.26972 2.81285 8.58415 1.4963 10.7215C-0.498768 14.0739 0.96491 19.1951 2.8986 22.0311C3.82363 23.4191 4.94915 24.984 6.45245 24.9999C7.88687 25.0159 8.38527 24.2079 10.1777 24.1919C11.9702 24.1758 12.4365 25.0159 13.8708 24.999C15.3741 24.984 16.3595 23.595 17.2845 22.207C18.3797 20.579 18.832 18.9989 18.8638 18.8983C18.832 18.8823 15.785 17.7125 15.7531 14.3909C15.7213 11.6511 18.1398 10.2791 18.2825 10.1943C16.9147 8.15902 14.8405 7.9099 14.2067 7.85646C12.6391 7.70769 11.3279 8.77783 10.1617 8.80185C8.93121 8.82586 8.00598 7.61265 6.33599 7.26972C6.33599 7.25371 6.33599 7.25371 16.7669 7.25371Z"/>
                        </svg>
                        <div>
                          <p className="font-medium dark:text-white">Apple</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                            {providerInfo('apple')?.email ?? (providerInfo('apple') ? 'Connected' : 'Not connected')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={connectingProvider === 'apple'}
                        onClick={() => handleToggleProvider('apple')}
                      >
                        {connectingProvider === 'apple'
                          ? '…'
                          : providerInfo('apple') ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </div>

                {/* Appearance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Appearance</CardTitle>
                    <CardDescription>Customize how the app looks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Theme</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Select your preferred theme</p>
                        {theme === 'system' && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                            <Monitor className="w-3 h-3" />
                            Currently using {resolvedTheme} mode
                          </p>
                        )}
                      </div>
                      <Select value={theme} onValueChange={(value) => setTheme(value)}>
                        <SelectTrigger className="w-40 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <span className="flex items-center gap-2"><Sun className="w-4 h-4" /> Light</span>
                          </SelectItem>
                          <SelectItem value="dark">
                            <span className="flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</span>
                          </SelectItem>
                          <SelectItem value="system">
                            <span className="flex items-center gap-2"><Monitor className="w-4 h-4" /> System</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                {/* Email Notifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email Notifications
                    </CardTitle>
                    <CardDescription>Choose what emails you'd like to receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Job Alerts</p>
                        <p className="text-sm text-gray-500">Emails from the job alerts you've set up</p>
                      </div>
                      <Switch
                        checked={notifications.emailJobAlerts}
                        onCheckedChange={(checked) => setNotifications({...notifications, emailJobAlerts: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">Jobs picked for you</p>
                        <p className="text-sm text-muted-foreground">
                          At most one email a day with up to five jobs matched to your profile. Off unless you turn it on.
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailJobRecommendations}
                        onCheckedChange={(checked) => setNotifications({...notifications, emailJobRecommendations: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Application Updates</p>
                        <p className="text-sm text-gray-500">Receive updates on your job applications</p>
                      </div>
                      <Switch 
                        checked={notifications.emailApplicationUpdates}
                        onCheckedChange={(checked) => setNotifications({...notifications, emailApplicationUpdates: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Marketing & Promotions</p>
                        <p className="text-sm text-gray-500">Receive tips, insights, and promotional content</p>
                      </div>
                      <Switch 
                        checked={notifications.emailMarketing}
                        onCheckedChange={(checked) => setNotifications({...notifications, emailMarketing: checked})}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Push Notifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Push Notifications
                    </CardTitle>
                    <CardDescription>Configure your push notification preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Job Alerts</p>
                        <p className="text-sm text-gray-500">When a job alert you've set up finds new jobs</p>
                      </div>
                      <Switch
                        checked={notifications.pushJobAlerts}
                        onCheckedChange={(checked) => setNotifications({...notifications, pushJobAlerts: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">Jobs picked for you</p>
                        <p className="text-sm text-muted-foreground">
                          A daily roundup of up to five new jobs that match your skills and preferences
                        </p>
                      </div>
                      <Switch
                        checked={notifications.pushJobRecommendations}
                        onCheckedChange={(checked) => setNotifications({...notifications, pushJobRecommendations: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Application Updates</p>
                        <p className="text-sm text-gray-500">Real-time application status changes</p>
                      </div>
                      <Switch 
                        checked={notifications.pushApplicationUpdates}
                        onCheckedChange={(checked) => setNotifications({...notifications, pushApplicationUpdates: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Messages</p>
                        <p className="text-sm text-gray-500">Notifications for new messages from employers</p>
                      </div>
                      <Switch 
                        checked={notifications.pushMessages}
                        onCheckedChange={(checked) => setNotifications({...notifications, pushMessages: checked})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Privacy Tab */}
              <TabsContent value="privacy" className="space-y-6">
                {/* Profile Visibility */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Profile Visibility
                    </CardTitle>
                    <CardDescription>Control who can see your profile information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium">When you view someone's profile</p>
                      <p className="text-sm text-gray-500">
                        How you appear to them. Browse privately and you can't see who viewed
                        you either — the same switch works both ways.
                      </p>
                      <Select value={viewVisibility} onValueChange={(v) => void changeViewVisibility(v as ViewVisibility)}>
                        <SelectTrigger className="mt-3 max-w-sm" aria-label="Profile view visibility">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="named">Your name and headline</SelectItem>
                          <SelectItem value="company">Your company only</SelectItem>
                          <SelectItem value="private">Private — nobody sees you</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-2 text-xs text-gray-500">
                        Changing this affects future visits only. It never reveals or hides
                        browsing you already did.
                      </p>
                    </div>
                    <Separator />
                    {/* Moved here from the profile page, where it sat in a
                        "Profile settings" card beside two switches that were
                        never wired to anything. This is the real one. */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Open to Work</p>
                        <p className="text-sm text-gray-500">
                          Tell employers you are looking. It shows as a badge and moves you
                          up in their search results — it is not what decides whether they
                          can find you.
                        </p>
                      </div>
                      <Switch
                        checked={openToWork}
                        onCheckedChange={setOpenToWork}
                        aria-label="Open to work"
                      />
                    </div>
                    <Separator />
                    {/* The real discovery switch. Named for what it does rather
                        than for the flag, because "open to work" had been doing
                        this job silently and people read it as a badge. */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Appear in Recruiter Searches</p>
                        <p className="text-sm text-gray-500">
                          Let employers find your profile when they search for candidates.
                          Turn this off and you stay out of their results whether or not you
                          are open to work. Your email address is never shown to them either
                          way — messages come through Coral.
                        </p>
                      </div>
                      <Switch
                        checked={discoverable}
                        onCheckedChange={setDiscoverable}
                        aria-label="Appear in recruiter searches"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Public Profile</p>
                        <p className="text-sm text-gray-500">
                          Allow employers to open your profile. Turning this off hides it
                          from everyone except companies you have applied to.
                        </p>
                      </div>
                      <Switch 
                        checked={privacy.profileVisible}
                        onCheckedChange={(checked) => setPrivacy({...privacy, profileVisible: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show Email Address</p>
                        <p className="text-sm text-gray-500">Display your email on your public profile</p>
                      </div>
                      <Switch 
                        checked={privacy.showEmail}
                        onCheckedChange={(checked) => setPrivacy({...privacy, showEmail: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show Phone Number</p>
                        <p className="text-sm text-gray-500">Display your phone number on your public profile</p>
                      </div>
                      <Switch 
                        checked={privacy.showPhone}
                        onCheckedChange={(checked) => setPrivacy({...privacy, showPhone: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Allow Messages</p>
                        <p className="text-sm text-gray-500">Let employers send you messages directly</p>
                      </div>
                      <Switch 
                        checked={privacy.allowMessages}
                        onCheckedChange={(checked) => setPrivacy({...privacy, allowMessages: checked})}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show Salary Expectations</p>
                        <p className="text-sm text-gray-500">Display your expected salary range publicly</p>
                      </div>
                      <Switch 
                        checked={privacy.showSalaryExpectations}
                        onCheckedChange={(checked) => setPrivacy({...privacy, showSalaryExpectations: checked})}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Data & Storage */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data & Storage</CardTitle>
                    <CardDescription>Manage your data and download your information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* The resume is managed on the profile, since it is a
                        document employers receive rather than a preference.
                        Pointed to from here anyway, because this is where
                        people come looking for their own data. */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="font-medium dark:text-white">Your Resume</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          View, replace or delete it on your profile
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/jobseeker/profile#resume">Manage</Link>
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <p className="font-medium dark:text-white">Download Your Data</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get a copy of all your data</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Request Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <DemographicSelfReportCard />
              </TabsContent>

              {/* Job Preferences Tab */}
              <TabsContent value="preferences" className="space-y-6">
                {/* Job Search Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="w-5 h-5" />
                      Job Search Preferences
                    </CardTitle>
                    <CardDescription>Define what you're looking for in your next role</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Job Types</Label>
                      <div className="flex flex-wrap gap-2">
                        {JOB_TYPE_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              jobPreferences.jobTypes.includes(value)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            onClick={() => {
                              const newTypes = jobPreferences.jobTypes.includes(value)
                                ? jobPreferences.jobTypes.filter(t => t !== value)
                                : [...jobPreferences.jobTypes, value];
                              setJobPreferences({...jobPreferences, jobTypes: newTypes});
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Experience Level</Label>
                        <Select value={jobPreferences.experienceLevel} onValueChange={(value) => setJobPreferences({...jobPreferences, experienceLevel: value})}>
                          <SelectTrigger className="bg-card">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPERIENCE_OPTIONS.map(({ value, label }) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Salary Range</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={jobPreferences.expectedSalary}
                            onChange={(e) => setJobPreferences({...jobPreferences, expectedSalary: e.target.value})}
                            className="pl-10 bg-card"
                          />
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Willing to Relocate</p>
                        <p className="text-sm text-gray-500">Open to moving for a new opportunity</p>
                      </div>
                      <Switch 
                        checked={jobPreferences.willingToRelocate}
                        onCheckedChange={(checked) => setJobPreferences({...jobPreferences, willingToRelocate: checked})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Preferred Locations
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {jobPreferences.locations.map((location) => (
                          <span 
                            key={location}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium flex items-center gap-1"
                          >
                            {location}
                            <button 
                              className="ml-1 hover:text-red-500"
                              onClick={() => setJobPreferences({
                                ...jobPreferences, 
                                locations: jobPreferences.locations.filter(l => l !== location)
                              })}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button className="px-3 py-1.5 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-500 transition-colors">
                          + Add Location
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-8 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Save your changes</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Make sure to save before leaving this page</p>
              </div>
              <Button onClick={handleSave} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                {isLoading ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

            {/* Danger Zone */}
            <Card className="mt-6 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
              <CardHeader>
                <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Delete Account</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAccount}>
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
