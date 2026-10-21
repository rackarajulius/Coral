import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, DollarSign, Briefcase, Clock, Target, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import ProgressSidebar from '@/components/jobSeeker/ProgressSidebar';
import { useProfile } from '@/contexts/ProfileContext';
import { WORK_ELIGIBILITY_OPTIONS, getWorkEligibilityOption } from '@/lib/workEligibility';
import { CityAutocomplete } from '@/components/location/CityAutocomplete';

const JobPreferences = () => {
  const { profile, updateJobPreferences, updateProfileInfo } = useProfile();
  const [jobPreferences, setJobPreferences] = useState(profile.jobPreferences);
  const [locationDraft, setLocationDraft] = useState('');
  const [workEligibility, setWorkEligibility] = useState(profile.workEligibility);
  const [workPermitExpiry, setWorkPermitExpiry] = useState(profile.workPermitExpiry);

  const eligibilityOption = getWorkEligibilityOption(workEligibility);

  const handleSave = () => {
    updateJobPreferences(jobPreferences);
    updateProfileInfo({
      workEligibility,
      // Clear the expiry if the chosen status doesn't use one.
      workPermitExpiry: eligibilityOption?.hasExpiry ? workPermitExpiry : '',
    });
    toast.success('Job preferences saved');
  };

  const addLocation = (location: string) => {
    const place = location.trim();
    setLocationDraft('');
    if (place && !jobPreferences.locations.some((l) => l.toLowerCase() === place.toLowerCase())) {
      setJobPreferences({
        ...jobPreferences,
        locations: [...jobPreferences.locations, place]
      });
    }
  };

  const removeLocation = (location: string) => {
    setJobPreferences({
      ...jobPreferences,
      locations: jobPreferences.locations.filter(l => l !== location)
    });
  };

  const addIndustry = (industry: string) => {
    if (industry && !jobPreferences.industries.includes(industry)) {
      setJobPreferences({
        ...jobPreferences,
        industries: [...jobPreferences.industries, industry]
      });
    }
  };

  const removeIndustry = (industry: string) => {
    setJobPreferences({
      ...jobPreferences,
      industries: jobPreferences.industries.filter(i => i !== industry)
    });
  };

  const addKeyword = (keyword: string) => {
    if (keyword && !jobPreferences.keywords.includes(keyword.toLowerCase())) {
      setJobPreferences({
        ...jobPreferences,
        keywords: [...jobPreferences.keywords, keyword.toLowerCase()]
      });
    }
  };

  const removeKeyword = (keyword: string) => {
    setJobPreferences({
      ...jobPreferences,
      keywords: jobPreferences.keywords.filter(k => k !== keyword)
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Bar */}
      <Header />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Progress Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-6 pt-16">
              <ProgressSidebar />
            </div>
          </div>

          {/* Center - Main Content */}
          <main className="flex-1 min-w-0 mx-auto lg:mx-0" role="main">
            <div className="pt-16">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Job Preferences</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Customize your job search to find the perfect opportunities that match your career goals.
                </p>
              </div>

              <div className="space-y-6 max-w-4xl">
          {/* Work Eligibility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Work Eligibility in Canada
              </CardTitle>
              <CardDescription>
                The first thing recruiters check. Sharing it upfront speeds up your applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Status</Label>
                  <Select value={workEligibility} onValueChange={setWorkEligibility}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your status" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_ELIGIBILITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {eligibilityOption?.hasExpiry && (
                  <div>
                    <Label htmlFor="permit-expiry" className="mb-2 block">Permit valid until</Label>
                    <Input
                      id="permit-expiry"
                      type="date"
                      value={workPermitExpiry}
                      onChange={(e) => setWorkPermitExpiry(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {eligibilityOption && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Shown on your profile as “{eligibilityOption.badge}”.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Job Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Job Types
              </CardTitle>
              <CardDescription>
                Select the types of employment you're interested in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['full-time', 'part-time', 'contract', 'freelance', 'internship'].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Switch
                    checked={jobPreferences.jobTypes.includes(type)}
                    onCheckedChange={(checked) => {
                      const newTypes = checked
                        ? [...jobPreferences.jobTypes, type]
                        : jobPreferences.jobTypes.filter(t => t !== type);
                      setJobPreferences({...jobPreferences, jobTypes: newTypes});
                    }}
                  />
                  <Label className="capitalize">{type.replace('-', ' ')}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Experience Level */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Experience Level
              </CardTitle>
              <CardDescription>
                What level of experience are you looking for?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={jobPreferences.experienceLevel}
                onValueChange={(value) => setJobPreferences({...jobPreferences, experienceLevel: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry Level</SelectItem>
                  <SelectItem value="mid">Mid Level</SelectItem>
                  <SelectItem value="senior">Senior Level</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Salary Expectations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Salary Expectations
              </CardTitle>
              <CardDescription>
                Minimum annual salary you're targeting (USD)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                placeholder="e.g., 80000"
                value={jobPreferences.expectedSalary}
                onChange={(e) => setJobPreferences({...jobPreferences, expectedSalary: e.target.value})}
              />
            </CardContent>
          </Card>

          {/* Locations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Preferred Locations
              </CardTitle>
              <CardDescription>
                Cities or regions where you'd like to work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <CityAutocomplete
                  className="flex-1"
                  variant="field"
                  aria-label="Add a preferred location"
                  placeholder="Add a city, or type “Remote”"
                  value={locationDraft}
                  onChange={setLocationDraft}
                  onSelect={(city) => addLocation(city.label)}
                  onCommit={addLocation}
                  near={profile.location.split(',').pop()?.trim() || undefined}
                />
                <Button variant="outline" onClick={() => addLocation(locationDraft)}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {jobPreferences.locations.map((location) => (
                  <Badge key={location} variant="secondary" className="cursor-pointer" onClick={() => removeLocation(location)}>
                    {location} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Remote Work */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Work Preferences
              </CardTitle>
              <CardDescription>
                Your preferences for work arrangement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={jobPreferences.remoteWork}
                  onCheckedChange={(checked) => setJobPreferences({...jobPreferences, remoteWork: checked})}
                />
                <Label>Open to remote work</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={jobPreferences.willingToRelocate}
                  onCheckedChange={(checked) => setJobPreferences({...jobPreferences, willingToRelocate: checked})}
                />
                <Label>Willing to relocate</Label>
              </div>
            </CardContent>
          </Card>

          {/* Industries */}
          <Card>
            <CardHeader>
              <CardTitle>Preferred Industries</CardTitle>
              <CardDescription>
                Industries you're most interested in working in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add an industry..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addIndustry((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Add an industry..."]') as HTMLInputElement;
                    if (input?.value) {
                      addIndustry(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {jobPreferences.industries.map((industry) => (
                  <Badge key={industry} variant="secondary" className="cursor-pointer" onClick={() => removeIndustry(industry)}>
                    {industry} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Skills & Keywords</CardTitle>
              <CardDescription>
                Keywords that describe your skills and interests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill or keyword..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addKeyword((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Add a skill or keyword..."]') as HTMLInputElement;
                    if (input?.value) {
                      addKeyword(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {jobPreferences.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="cursor-pointer" onClick={() => removeKeyword(keyword)}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={handleSave} className="px-8">
                    Save Preferences
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

export default JobPreferences;