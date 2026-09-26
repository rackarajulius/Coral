import { useState, useEffect } from 'react';
import { GraduationCap, Pencil, Plus, Save, X, Trash2, Calendar, MapPin, Award, AlertCircle } from 'lucide-react';
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
import { useProfile, Education } from '@/contexts/ProfileContext';

interface ValidationErrors {
  degree?: string;
  school?: string;
  period?: string;
  gpa?: string;
  description?: string;
}

const EducationSection = () => {
  const { profile, addEducation, updateEducation, deleteEducation } = useProfile();
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [educationToDelete, setEducationToDelete] = useState<number | null>(null);
  
  // Form states
  const [editDegree, setEditDegree] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGpa, setEditGpa] = useState('');
  const [editHonors, setEditHonors] = useState('');
  
  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ degree: boolean; school: boolean; period: boolean; gpa: boolean; description: boolean }>({
    degree: false,
    school: false,
    period: false,
    gpa: false,
    description: false,
  });

  const validate = () => {
    const newErrors: ValidationErrors = {};
    
    if (!editDegree.trim()) {
      newErrors.degree = 'Degree is required';
    } else if (editDegree.trim().length < 2) {
      newErrors.degree = 'Degree must be at least 2 characters';
    } else if (editDegree.trim().length > 100) {
      newErrors.degree = 'Degree cannot exceed 100 characters';
    }
    
    if (!editSchool.trim()) {
      newErrors.school = 'School is required';
    } else if (editSchool.trim().length < 2) {
      newErrors.school = 'School name must be at least 2 characters';
    } else if (editSchool.trim().length > 100) {
      newErrors.school = 'School name cannot exceed 100 characters';
    }
    
    if (editPeriod && !/^\d{4}\s*-\s*\d{4}$/.test(editPeriod.trim())) {
      newErrors.period = 'Use format: "YYYY - YYYY"';
    }
    
    if (editGpa && !/^\d+\.?\d*\s*\/\s*\d+\.?\d*$/.test(editGpa.trim())) {
      newErrors.gpa = 'Use format: "3.8/4.0"';
    }
    
    if (editDescription && editDescription.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate on change after touched
  useEffect(() => {
    if (Object.values(touched).some(Boolean)) {
      validate();
    }
  }, [editDegree, editSchool, editPeriod, editGpa, editDescription, touched]);

  const openEditDialog = (edu: Education | null) => {
    if (edu) {
      setEditingEducation(edu);
      setEditDegree(edu.degree);
      setEditSchool(edu.school);
      setEditLocation(edu.location);
      setEditPeriod(edu.period);
      setEditDescription(edu.description);
      setEditGpa(edu.gpa || '');
      setEditHonors(edu.honors || '');
    } else {
      setEditingEducation(null);
      setEditDegree('');
      setEditSchool('');
      setEditLocation('');
      setEditPeriod('');
      setEditDescription('');
      setEditGpa('');
      setEditHonors('');
    }
    setErrors({});
    setTouched({ degree: false, school: false, period: false, gpa: false, description: false });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    setTouched({ degree: true, school: true, period: true, gpa: true, description: true });
    
    if (!validate()) {
      return;
    }

    const educationData = {
      degree: editDegree,
      school: editSchool,
      location: editLocation,
      period: editPeriod,
      description: editDescription,
      gpa: editGpa || undefined,
      honors: editHonors || undefined,
    };

    if (editingEducation) {
      updateEducation(editingEducation.id, educationData);
    } else {
      addEducation(educationData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (educationToDelete) {
      deleteEducation(educationToDelete);
      setDeleteConfirmOpen(false);
      setEducationToDelete(null);
    }
  };

  return (
    <>
      <section 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300"
        role="region"
        aria-label="Education section"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <GraduationCap className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Education</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => openEditDialog(null)}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Add education"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => profile.educations[0] && openEditDialog(profile.educations[0])}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Edit education entries"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Education List */}
        <div className="space-y-6" role="list" aria-label="Education entries">
          {profile.educations.map((edu, index) => (
            <div key={edu.id} className="flex gap-4 relative group" role="listitem">
              {/* Timeline Connector Line */}
              {index < profile.educations.length - 1 && (
                <div className="absolute left-[22px] top-12 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500 transition-colors" aria-hidden="true" />
              )}
              
              {/* School logo */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center shadow-sm border border-purple-100 dark:border-purple-700 group-hover:shadow-md transition-all duration-300" aria-hidden="true">
                <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{edu.degree}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{edu.school}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {edu.period}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        {edu.location}
                      </span>
                      {edu.gpa && (
                        <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                          GPA: {edu.gpa}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {edu.honors && (
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-medium">
                          <Award className="w-4 h-4" aria-hidden="true" />
                          {edu.honors}
                        </div>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => openEditDialog(edu)}
                      aria-label={`Edit ${edu.degree} at ${edu.school}`}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {edu.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                    {edu.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {profile.educations.length === 0 && (
          <div className="text-center py-8">
            <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No education added yet</p>
            <Button variant="outline" onClick={() => openEditDialog(null)}>
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Education
            </Button>
          </div>
        )}
      </section>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="education-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-gray-600" aria-hidden="true" />
              {editingEducation ? 'Edit Education' : 'Add Education'}
            </DialogTitle>
          </DialogHeader>
          <p id="education-dialog-description" className="sr-only">
            {editingEducation ? 'Edit your education details.' : 'Add a new education entry to your profile.'}
          </p>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edu-degree" className="text-sm font-medium text-gray-700 mb-2 block">
                  Degree <span className="text-red-500">*</span>
                </label>
                <Input
                  id="edu-degree"
                  value={editDegree}
                  onChange={(e) => {
                    setEditDegree(e.target.value);
                    setTouched(prev => ({ ...prev, degree: true }));
                  }}
                  className={errors.degree ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., BSc, Computer Science"
                  aria-invalid={!!errors.degree}
                  aria-describedby={errors.degree ? 'degree-error' : undefined}
                />
                {errors.degree && (
                  <p id="degree-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.degree}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="edu-school" className="text-sm font-medium text-gray-700 mb-2 block">
                  School <span className="text-red-500">*</span>
                </label>
                <Input
                  id="edu-school"
                  value={editSchool}
                  onChange={(e) => {
                    setEditSchool(e.target.value);
                    setTouched(prev => ({ ...prev, school: true }));
                  }}
                  className={errors.school ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., University of Lagos"
                  aria-invalid={!!errors.school}
                  aria-describedby={errors.school ? 'school-error' : undefined}
                />
                {errors.school && (
                  <p id="school-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.school}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edu-location" className="text-sm font-medium text-gray-700 mb-2 block">Location</label>
                <Input
                  id="edu-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g., Lagos, Nigeria"
                />
              </div>
              <div>
                <label htmlFor="edu-period" className="text-sm font-medium text-gray-700 mb-2 block">Period</label>
                <Input
                  id="edu-period"
                  value={editPeriod}
                  onChange={(e) => {
                    setEditPeriod(e.target.value);
                    setTouched(prev => ({ ...prev, period: true }));
                  }}
                  className={errors.period ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., 2015 - 2019"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edu-gpa" className="text-sm font-medium text-gray-700 mb-2 block">GPA (optional)</label>
                <Input
                  id="edu-gpa"
                  value={editGpa}
                  onChange={(e) => {
                    setEditGpa(e.target.value);
                    setTouched(prev => ({ ...prev, gpa: true }));
                  }}
                  className={errors.gpa ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., 3.8/4.0"
                  aria-invalid={!!errors.gpa}
                  aria-describedby={errors.gpa ? 'gpa-error' : undefined}
                />
                {errors.gpa && (
                  <p id="gpa-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.gpa}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="edu-honors" className="text-sm font-medium text-gray-700 mb-2 block">Honors (optional)</label>
                <Input
                  id="edu-honors"
                  value={editHonors}
                  onChange={(e) => setEditHonors(e.target.value)}
                  placeholder="e.g., Dean's List, Cum Laude"
                />
              </div>
            </div>
            <div>
              <label htmlFor="edu-description" className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
              <Textarea
                id="edu-description"
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  setTouched(prev => ({ ...prev, description: true }));
                }}
                rows={3}
                className={`resize-none ${errors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder="Describe your studies, achievements, activities..."
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
                  {editDescription.length}/500 characters
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              {editingEducation && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setEducationToDelete(editingEducation.id);
                    setDeleteConfirmOpen(true);
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" aria-hidden="true" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={(Object.keys(errors).length > 0 && Object.values(touched).some(Boolean)) || !editDegree || !editSchool}
              >
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Education?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this education entry from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEducationToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EducationSection;
