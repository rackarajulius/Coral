import { useState, useEffect } from 'react';
import { Globe2, Pencil, Save, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProfile } from '@/contexts/ProfileContext';

interface ValidationErrors {
  about?: string;
  languages?: string;
}

const AboutSection = () => {
  const { profile, updateAbout, updateLanguages } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [editAbout, setEditAbout] = useState(profile.about);
  const [editLanguages, setEditLanguages] = useState(profile.languages.join(', '));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ about: boolean; languages: boolean }>({ about: false, languages: false });

  // Validation
  const validate = () => {
    const newErrors: ValidationErrors = {};
    
    if (!editAbout.trim()) {
      newErrors.about = 'Professional summary is required';
    } else if (editAbout.trim().length < 50) {
      newErrors.about = 'Summary should be at least 50 characters';
    } else if (editAbout.trim().length > 2000) {
      newErrors.about = 'Summary cannot exceed 2000 characters';
    }
    
    if (!editLanguages.trim()) {
      newErrors.languages = 'At least one language is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate on change after touched
  useEffect(() => {
    if (touched.about || touched.languages) {
      validate();
    }
  }, [editAbout, editLanguages, touched]);

  const handleOpenEdit = () => {
    setEditAbout(profile.about);
    setEditLanguages(profile.languages.join(', '));
    setErrors({});
    setTouched({ about: false, languages: false });
    setIsEditing(true);
  };

  const handleSave = () => {
    setTouched({ about: true, languages: true });
    
    if (!validate()) {
      return;
    }
    
    updateAbout(editAbout);
    updateLanguages(editLanguages.split(',').map(l => l.trim()).filter(l => l));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditAbout(profile.about);
    setEditLanguages(profile.languages.join(', '));
    setErrors({});
    setTouched({ about: false, languages: false });
    setIsEditing(false);
  };

  // Split about text into paragraphs
  const paragraphs = profile.about.split('\n\n').filter(p => p.trim());

  return (
    <>
      <section 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300"
        role="region"
        aria-label="About section"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Globe2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">About</h2>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleOpenEdit}
            className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Edit about section"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {paragraph}
            </p>
          ))}
          
          {/* Languages */}
          <div className="flex items-center gap-2 pt-2">
            <Globe2 className="w-4 h-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Languages:</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{profile.languages.join(', ')}</span>
          </div>
        </div>
      </section>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl" aria-describedby="about-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
              Edit About Section
            </DialogTitle>
          </DialogHeader>
          <p id="about-dialog-description" className="sr-only">
            Edit your professional summary and languages you speak.
          </p>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="about-summary" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Professional Summary <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="about-summary"
                value={editAbout}
                onChange={(e) => {
                  setEditAbout(e.target.value);
                  setTouched(prev => ({ ...prev, about: true }));
                }}
                rows={6}
                className={`resize-none ${errors.about ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder="Tell us about yourself..."
                aria-invalid={!!errors.about}
                aria-describedby={errors.about ? 'about-error' : 'about-counter'}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.about && (
                  <p id="about-error" className="text-xs text-red-500 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    {errors.about}
                  </p>
                )}
                <p id="about-counter" className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {editAbout.length}/2000 characters
                </p>
              </div>
            </div>
            
            <div>
              <label htmlFor="about-languages" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Languages <span className="text-red-500">*</span>
              </label>
              <Input
                id="about-languages"
                value={editLanguages}
                onChange={(e) => {
                  setEditLanguages(e.target.value);
                  setTouched(prev => ({ ...prev, languages: true }));
                }}
                className={errors.languages ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., English, Swahili, French"
                aria-invalid={!!errors.languages}
                aria-describedby={errors.languages ? 'languages-error' : 'languages-hint'}
              />
              {errors.languages && (
                <p id="languages-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  {errors.languages}
                </p>
              )}
              <p id="languages-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Separate languages with commas
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" aria-hidden="true" />
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={Object.keys(errors).length > 0 && touched.about && touched.languages}
            >
              <Save className="w-4 h-4 mr-2" aria-hidden="true" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AboutSection;
