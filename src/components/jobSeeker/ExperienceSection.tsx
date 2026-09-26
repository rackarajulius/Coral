import { useState, useEffect } from 'react';
import { BadgeCheck, Building2, Calendar, Mail, MapPin, Pencil, Plus, Save, X, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProfile, Experience, Skill } from '@/contexts/ProfileContext';
import {
  confirmWorkEmailVerification,
  startWorkEmailVerification,
} from '@/lib/api/verifications';

interface ValidationErrors {
  title?: string;
  company?: string;
  period?: string;
  description?: string;
}

const ExperienceSection = () => {
  const { 
    profile, 
    addExperience, 
    updateExperience, 
    deleteExperience, 
    updateSkills 
  } = useProfile();
  
  // Dialog states
  const [isExperienceDialogOpen, setIsExperienceDialogOpen] = useState(false);
  const [isSkillsDialogOpen, setIsSkillsDialogOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [experienceToDelete, setExperienceToDelete] = useState<number | null>(null);
  
  // Form states
  const [editTitle, setEditTitle] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Work-email verification — a code sent to the company's own domain. Free,
  // unlike an ID check, and it settles without anyone reviewing it by hand.
  const [verifyingExp, setVerifyingExp] = useState<Experience | null>(null);
  const [verifyStep, setVerifyStep] = useState<'email' | 'code'>('email');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifySentTo, setVerifySentTo] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [newSkillName, setNewSkillName] = useState('');
  const [editSkills, setEditSkills] = useState<Skill[]>([]);
  const [skillError, setSkillError] = useState('');
  
  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ title: boolean; company: boolean; period: boolean; description: boolean }>({
    title: false,
    company: false,
    period: false,
    description: false,
  });

  const validate = () => {
    const newErrors: ValidationErrors = {};
    
    if (!editTitle.trim()) {
      newErrors.title = 'Job title is required';
    } else if (editTitle.trim().length < 2) {
      newErrors.title = 'Job title must be at least 2 characters';
    } else if (editTitle.trim().length > 100) {
      newErrors.title = 'Job title cannot exceed 100 characters';
    }
    
    if (!editCompany.trim()) {
      newErrors.company = 'Company name is required';
    } else if (editCompany.trim().length < 2) {
      newErrors.company = 'Company name must be at least 2 characters';
    } else if (editCompany.trim().length > 100) {
      newErrors.company = 'Company name cannot exceed 100 characters';
    }
    
    if (editPeriod && !/^\d{4}\s*-\s*(\d{4}|Present)$/i.test(editPeriod.trim())) {
      newErrors.period = 'Use format: "YYYY - YYYY" or "YYYY - Present"';
    }
    
    if (editDescription && editDescription.length > 1000) {
      newErrors.description = 'Description cannot exceed 1000 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate on change after touched
  useEffect(() => {
    if (Object.values(touched).some(Boolean)) {
      validate();
    }
  }, [editTitle, editCompany, editPeriod, editDescription, touched]);

  const openExperienceEdit = (exp: Experience | null) => {
    if (exp) {
      setEditingExperience(exp);
      setEditTitle(exp.title);
      setEditCompany(exp.company);
      setEditLocation(exp.location);
      setEditPeriod(exp.period);
      setEditDescription(exp.description);
    } else {
      setEditingExperience(null);
      setEditTitle('');
      setEditCompany('');
      setEditLocation('');
      setEditPeriod('');
      setEditDescription('');
    }
    setErrors({});
    setTouched({ title: false, company: false, period: false, description: false });
    setIsExperienceDialogOpen(true);
  };

  const handleSaveExperience = () => {
    setTouched({ title: true, company: true, period: true, description: true });
    
    if (!validate()) {
      return;
    }
    
    if (editingExperience) {
      updateExperience(editingExperience.id, {
        title: editTitle,
        company: editCompany,
        location: editLocation,
        period: editPeriod,
        description: editDescription,
      });
    } else {
      addExperience({
        title: editTitle,
        company: editCompany,
        logo: editCompany.charAt(0),
        location: editLocation,
        period: editPeriod,
        duration: 'New',
        description: editDescription,
        verified: false,
      });
    }
    setIsExperienceDialogOpen(false);
  };

  const openVerify = (exp: Experience) => {
    setVerifyingExp(exp);
    setVerifyStep('email');
    setVerifyEmail('');
    setVerifyCode('');
    setVerifySentTo('');
    setVerifyError('');
  };

  const handleSendCode = async () => {
    if (!verifyingExp?.serverId) return;
    setVerifyBusy(true);
    setVerifyError('');
    try {
      const { sentTo } = await startWorkEmailVerification(verifyingExp.serverId, verifyEmail.trim());
      setVerifySentTo(sentTo);
      setVerifyStep('code');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Could not send the code');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!verifyingExp?.serverId) return;
    setVerifyBusy(true);
    setVerifyError('');
    try {
      const result = await confirmWorkEmailVerification(verifyingExp.serverId, verifyCode.trim());
      updateExperience(verifyingExp.id, {
        verified: result.verified,
        verifiedWorkDomain: result.domain,
      });
      setVerifyingExp(null);
      // Two different outcomes deserve two different messages: the badge means
      // we tied the domain to this employer, the domain alone doesn't.
      if (result.verified) toast.success(result.message);
      else toast.info(result.message, { duration: 10000 });
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Could not confirm the code');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleDeleteExperience = () => {
    if (experienceToDelete) {
      deleteExperience(experienceToDelete);
      setDeleteConfirmOpen(false);
      setExperienceToDelete(null);
    }
  };

  const openSkillsEdit = () => {
    setEditSkills([...profile.skills]);
    setSkillError('');
    setIsSkillsDialogOpen(true);
  };

  const handleAddSkill = () => {
    const trimmedSkill = newSkillName.trim();
    
    if (!trimmedSkill) {
      setSkillError('Skill name is required');
      return;
    }
    
    if (trimmedSkill.length < 2) {
      setSkillError('Skill must be at least 2 characters');
      return;
    }
    
    if (trimmedSkill.length > 50) {
      setSkillError('Skill cannot exceed 50 characters');
      return;
    }
    
    if (editSkills.find(s => s.name.toLowerCase() === trimmedSkill.toLowerCase())) {
      setSkillError('This skill already exists');
      return;
    }
    
    setEditSkills([...editSkills, { name: trimmedSkill }]);
    setNewSkillName('');
    setSkillError('');
  };

  const handleRemoveSkill = (skillName: string) => {
    setEditSkills(editSkills.filter(s => s.name !== skillName));
  };

  const handleSaveSkills = () => {
    if (editSkills.length === 0) {
      setSkillError('At least one skill is required');
      return;
    }
    updateSkills(editSkills);
    setIsSkillsDialogOpen(false);
  };

  return (
    <>
      <section 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300"
        role="region"
        aria-label="Experience section"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Experience</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => openExperienceEdit(null)}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Add experience"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => profile.experiences[0] && openExperienceEdit(profile.experiences[0])}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Edit experiences"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Experience List */}
        <div className="space-y-6" role="list" aria-label="Work experiences">
          {profile.experiences.map((exp, index) => (
            <div key={exp.id} className="flex gap-4 relative group" role="listitem">
              {/* Timeline Connector Line */}
              {index < profile.experiences.length - 1 && (
                <div className="absolute left-[22px] top-12 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500 transition-colors" aria-hidden="true" />
              )}
              
              {/* Company logo */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-lg font-bold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-gray-600 group-hover:shadow-md transition-all duration-300" aria-hidden="true">
                {exp.company.charAt(0)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{exp.title}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{exp.company}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {exp.period}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {exp.location}
                      </span>
                      <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        {exp.duration}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exp.verified ? (
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                          <BadgeCheck className="w-4 h-4" aria-hidden="true" />
                          Verified
                        </div>
                      </div>
                    ) : exp.verifiedWorkDomain ? (
                      // The domain checked out but we couldn't tie it to this
                      // employer. Saying so is honest; a green badge wouldn't be.
                      <div
                        className="flex-shrink-0 flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-medium"
                        title={`A work email at ${exp.verifiedWorkDomain} was confirmed. We couldn't match that domain to ${exp.company}.`}
                      >
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        {exp.verifiedWorkDomain}
                      </div>
                    ) : exp.serverId ? (
                      // Only a saved role can be verified — the code is tied to
                      // its id, which a local-only draft doesn't have yet.
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => openVerify(exp)}
                        aria-label={`Verify ${exp.title} at ${exp.company} with your work email`}
                      >
                        <BadgeCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        Verify
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => openExperienceEdit(exp)}
                      aria-label={`Edit ${exp.title} at ${exp.company}`}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                  {exp.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Skills Section */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Skills</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={openSkillsEdit}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 px-3 text-sm font-medium"
              aria-label="Edit skills"
            >
              <Pencil className="w-4 h-4 mr-1" aria-hidden="true" />
              Edit Skills
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2" role="list" aria-label="Skills">
            {profile.skills.map((skill) => (
              <span 
                key={skill.name}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 text-sm font-medium hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/50 dark:hover:to-blue-800/50 cursor-pointer transition-all duration-200 border border-blue-200 dark:border-blue-700"
                role="listitem"
              >
                {skill.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Experience Edit Dialog */}
      <Dialog open={isExperienceDialogOpen} onOpenChange={setIsExperienceDialogOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="experience-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" aria-hidden="true" />
              {editingExperience ? 'Edit Experience' : 'Add Experience'}
            </DialogTitle>
          </DialogHeader>
          <p id="experience-dialog-description" className="sr-only">
            {editingExperience ? 'Edit your work experience details.' : 'Add a new work experience to your profile.'}
          </p>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exp-title" className="text-sm font-medium text-gray-700 mb-2 block">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="exp-title"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setTouched(prev => ({ ...prev, title: true }));
                  }}
                  className={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., Senior Product Manager"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                />
                {errors.title && (
                  <p id="title-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.title}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="exp-company" className="text-sm font-medium text-gray-700 mb-2 block">
                  Company <span className="text-red-500">*</span>
                </label>
                <Input
                  id="exp-company"
                  value={editCompany}
                  onChange={(e) => {
                    setEditCompany(e.target.value);
                    setTouched(prev => ({ ...prev, company: true }));
                  }}
                  className={errors.company ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., Flutterwave"
                  aria-invalid={!!errors.company}
                  aria-describedby={errors.company ? 'company-error' : undefined}
                />
                {errors.company && (
                  <p id="company-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.company}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exp-location" className="text-sm font-medium text-gray-700 mb-2 block">Location</label>
                <Input
                  id="exp-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g., Lagos, Nigeria (Remote)"
                />
              </div>
              <div>
                <label htmlFor="exp-period" className="text-sm font-medium text-gray-700 mb-2 block">Period</label>
                <Input
                  id="exp-period"
                  value={editPeriod}
                  onChange={(e) => {
                    setEditPeriod(e.target.value);
                    setTouched(prev => ({ ...prev, period: true }));
                  }}
                  className={errors.period ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., Jan 2022 - Present"
                  aria-invalid={!!errors.period}
                  aria-describedby={errors.period ? 'period-error' : undefined}
                />
                {errors.period && (
                  <p id="period-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.period}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="exp-description" className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
              <Textarea
                id="exp-description"
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  setTouched(prev => ({ ...prev, description: true }));
                }}
                rows={4}
                className={`resize-none ${errors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder="Describe your responsibilities and achievements..."
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'desc-error' : 'desc-counter'}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.description && (
                  <p id="desc-error" className="text-xs text-red-500 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.description}
                  </p>
                )}
                <p id="desc-counter" className="text-xs text-gray-500 ml-auto">
                  {editDescription.length}/1000 characters
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              {editingExperience && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setExperienceToDelete(editingExperience.id);
                    setDeleteConfirmOpen(true);
                    setIsExperienceDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsExperienceDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" aria-hidden="true" />
                Cancel
              </Button>
              <Button 
                onClick={handleSaveExperience}
                disabled={Object.keys(errors).length > 0 && Object.values(touched).some(Boolean)}
              >
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skills Edit Dialog */}
      <Dialog open={isSkillsDialogOpen} onOpenChange={setIsSkillsDialogOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="skills-dialog-description">
          <DialogHeader>
            <DialogTitle>Edit Skills</DialogTitle>
          </DialogHeader>
          <p id="skills-dialog-description" className="sr-only">
            Add or remove skills from your profile. Click on a skill to remove it.
          </p>
          
          <div className="space-y-4 py-4">
            <div 
              className="flex flex-wrap gap-2 min-h-[100px] p-4 border border-gray-200 rounded-lg bg-gray-50"
              role="list"
              aria-label="Current skills - click to remove"
            >
              {editSkills.map((skill) => (
                <button 
                  key={skill.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200 cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors group"
                  onClick={() => handleRemoveSkill(skill.name)}
                  role="listitem"
                  aria-label={`Remove ${skill.name}`}
                >
                  {skill.name}
                  <X className="w-3 h-3 opacity-0 group-hover:opacity-100" aria-hidden="true" />
                </button>
              ))}
              {editSkills.length === 0 && (
                <p className="text-sm text-gray-500">No skills added yet</p>
              )}
            </div>
            
            <div>
              <div className="flex gap-2">
                <label htmlFor="new-skill" className="sr-only">Add new skill</label>
                <Input
                  id="new-skill"
                  value={newSkillName}
                  onChange={(e) => {
                    setNewSkillName(e.target.value);
                    setSkillError('');
                  }}
                  placeholder="Add a new skill..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                  className={skillError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  aria-invalid={!!skillError}
                  aria-describedby={skillError ? 'skill-error' : undefined}
                />
                <Button variant="outline" onClick={handleAddSkill}>
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  Add
                </Button>
              </div>
              {skillError && (
                <p id="skill-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  {skillError}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">Click on a skill to remove it</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkillsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSkills} disabled={editSkills.length === 0}>
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Skills
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Work-email verification */}
      <Dialog open={!!verifyingExp} onOpenChange={(open) => !open && setVerifyingExp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
              Verify {verifyingExp?.company}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {verifyStep === 'email' ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We'll send a 6-digit code to your work address at {verifyingExp?.company}.
                  Receiving it is the proof — the address is only used for this check and
                  never shown on your profile.
                </p>
                <div>
                  <label htmlFor="verify-work-email" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Work email
                  </label>
                  <Input
                    id="verify-work-email"
                    type="email"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    A personal address can't show where you work, so Gmail, Outlook and the
                    like aren't accepted.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter the code we sent to <strong>{verifySentTo}</strong>. It expires in 15 minutes.
                </p>
                <Input
                  id="verify-work-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.5em] font-semibold"
                  aria-label="6-digit verification code"
                />
                <button
                  type="button"
                  onClick={() => { setVerifyStep('email'); setVerifyError(''); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Use a different address
                </button>
              </>
            )}

            {verifyError && (
              <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
                <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                {verifyError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyingExp(null)}>
              Cancel
            </Button>
            {verifyStep === 'email' ? (
              <Button onClick={handleSendCode} disabled={verifyBusy || !verifyEmail.trim()}>
                {verifyBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Send code
              </Button>
            ) : (
              <Button onClick={handleConfirmCode} disabled={verifyBusy || verifyCode.length !== 6}>
                {verifyBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Confirm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Experience?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this experience entry from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExperienceToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExperience} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExperienceSection;
