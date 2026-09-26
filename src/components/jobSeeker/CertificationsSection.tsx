import { useState, useEffect } from 'react';
import { Award, Pencil, Plus, Save, X, Trash2, ExternalLink, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useProfile, Certification } from '@/contexts/ProfileContext';

interface ValidationErrors {
  name?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialUrl?: string;
}

const CertificationsSection = () => {
  const { profile, addCertification, updateCertification, deleteCertification } = useProfile();
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [certToDelete, setCertToDelete] = useState<number | null>(null);
  
  // Form states
  const [editName, setEditName] = useState('');
  const [editIssuer, setEditIssuer] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editCredentialId, setEditCredentialId] = useState('');
  const [editCredentialUrl, setEditCredentialUrl] = useState('');
  const [editNoExpiry, setEditNoExpiry] = useState(false);
  
  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ 
    name: boolean; 
    issuer: boolean; 
    issueDate: boolean; 
    expiryDate: boolean;
    credentialUrl: boolean;
  }>({
    name: false,
    issuer: false,
    issueDate: false,
    expiryDate: false,
    credentialUrl: false,
  });

  const validate = () => {
    const newErrors: ValidationErrors = {};
    
    if (!editName.trim()) {
      newErrors.name = 'Certification name is required';
    } else if (editName.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (editName.trim().length > 100) {
      newErrors.name = 'Name cannot exceed 100 characters';
    }
    
    if (!editIssuer.trim()) {
      newErrors.issuer = 'Issuing organization is required';
    } else if (editIssuer.trim().length < 2) {
      newErrors.issuer = 'Issuer must be at least 2 characters';
    } else if (editIssuer.trim().length > 100) {
      newErrors.issuer = 'Issuer cannot exceed 100 characters';
    }
    
    if (!editIssueDate.trim()) {
      newErrors.issueDate = 'Issue date is required';
    } else if (!/^\d{4}(-\d{2})?$/.test(editIssueDate.trim())) {
      newErrors.issueDate = 'Use format: YYYY or YYYY-MM';
    }
    
    if (!editNoExpiry && editExpiryDate && !/^\d{4}(-\d{2})?$/.test(editExpiryDate.trim())) {
      newErrors.expiryDate = 'Use format: YYYY or YYYY-MM';
    }
    
    if (editCredentialUrl && !/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(editCredentialUrl.trim())) {
      newErrors.credentialUrl = 'Please enter a valid URL';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate on change after touched
  useEffect(() => {
    if (Object.values(touched).some(Boolean)) {
      validate();
    }
  }, [editName, editIssuer, editIssueDate, editExpiryDate, editCredentialUrl, editNoExpiry, touched]);

  const openEditDialog = (cert: Certification | null) => {
    if (cert) {
      setEditingCert(cert);
      setEditName(cert.name);
      setEditIssuer(cert.issuer);
      setEditIssueDate(cert.issueDate);
      setEditExpiryDate(cert.expiryDate || '');
      setEditCredentialId(cert.credentialId || '');
      setEditCredentialUrl(cert.credentialUrl || '');
      setEditNoExpiry(cert.noExpiry);
    } else {
      setEditingCert(null);
      setEditName('');
      setEditIssuer('');
      setEditIssueDate('');
      setEditExpiryDate('');
      setEditCredentialId('');
      setEditCredentialUrl('');
      setEditNoExpiry(false);
    }
    setErrors({});
    setTouched({ name: false, issuer: false, issueDate: false, expiryDate: false, credentialUrl: false });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    setTouched({ name: true, issuer: true, issueDate: true, expiryDate: true, credentialUrl: true });
    
    if (!validate()) {
      return;
    }

    const certData = {
      name: editName,
      issuer: editIssuer,
      issueDate: editIssueDate,
      expiryDate: editNoExpiry ? undefined : editExpiryDate || undefined,
      credentialId: editCredentialId || undefined,
      credentialUrl: editCredentialUrl || undefined,
      noExpiry: editNoExpiry,
    };

    if (editingCert) {
      updateCertification(editingCert.id, certData);
    } else {
      addCertification(certData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (certToDelete) {
      deleteCertification(certToDelete);
      setDeleteConfirmOpen(false);
      setCertToDelete(null);
    }
  };

  const formatDate = (date: string) => {
    if (date.includes('-')) {
      const [year, month] = date.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(month) - 1]} ${year}`;
    }
    return date;
  };

  return (
    <>
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Award className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Certifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => openEditDialog(null)}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Add certification"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => profile.certifications[0] && openEditDialog(profile.certifications[0])}
              className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Edit certifications"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Certifications List */}
        <div className="space-y-4">
          {profile.certifications.map((cert) => (
            <div key={cert.id} className="flex gap-4 relative group">
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center shadow-sm border border-amber-100 dark:border-amber-700 group-hover:shadow-md transition-all duration-300">
                <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {cert.name}
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{cert.issuer}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Issued {formatDate(cert.issueDate)}
                      </span>
                      {cert.noExpiry ? (
                        <span className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                          No Expiration
                        </span>
                      ) : cert.expiryDate && (
                        <span className="flex items-center gap-1">
                          Expires {formatDate(cert.expiryDate)}
                        </span>
                      )}
                    </div>
                    {cert.credentialId && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Credential ID: {cert.credentialId}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cert.credentialUrl && (
                      <a
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => openEditDialog(cert)}
                      aria-label={`Edit ${cert.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {profile.certifications.length === 0 && (
          <div className="text-center py-8">
            <Award className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No certifications added yet</p>
            <Button variant="outline" onClick={() => openEditDialog(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Certification
            </Button>
          </div>
        )}
      </section>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-gray-600" />
              {editingCert ? 'Edit Certification' : 'Add Certification'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Certification Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setTouched(prev => ({ ...prev, name: true }));
                }}
                className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., AWS Solutions Architect"
              />
              {errors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Issuing Organization <span className="text-red-500">*</span>
              </label>
              <Input
                value={editIssuer}
                onChange={(e) => {
                  setEditIssuer(e.target.value);
                  setTouched(prev => ({ ...prev, issuer: true }));
                }}
                className={errors.issuer ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., Amazon Web Services"
              />
              {errors.issuer && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.issuer}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <Input
                  value={editIssueDate}
                  onChange={(e) => {
                    setEditIssueDate(e.target.value);
                    setTouched(prev => ({ ...prev, issueDate: true }));
                  }}
                  className={errors.issueDate ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., 2023-06"
                />
                {errors.issueDate && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.issueDate}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Expiry Date
                </label>
                <Input
                  value={editExpiryDate}
                  onChange={(e) => {
                    setEditExpiryDate(e.target.value);
                    setTouched(prev => ({ ...prev, expiryDate: true }));
                  }}
                  disabled={editNoExpiry}
                  className={errors.expiryDate ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  placeholder="e.g., 2025-06"
                />
                {errors.expiryDate && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.expiryDate}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="noExpiry"
                checked={editNoExpiry}
                onCheckedChange={(checked) => {
                  setEditNoExpiry(checked as boolean);
                  if (checked) setEditExpiryDate('');
                }}
              />
              <label
                htmlFor="noExpiry"
                className="text-sm font-medium text-gray-700 cursor-pointer"
              >
                This certification does not expire
              </label>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Credential ID (optional)</label>
              <Input
                value={editCredentialId}
                onChange={(e) => setEditCredentialId(e.target.value)}
                placeholder="e.g., AWS-12345678"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Credential URL (optional)</label>
              <Input
                value={editCredentialUrl}
                onChange={(e) => {
                  setEditCredentialUrl(e.target.value);
                  setTouched(prev => ({ ...prev, credentialUrl: true }));
                }}
                className={errors.credentialUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., https://aws.amazon.com/certification"
              />
              {errors.credentialUrl && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.credentialUrl}
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              {editingCert && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setCertToDelete(editingCert.id);
                    setDeleteConfirmOpen(true);
                    setIsDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={(Object.keys(errors).length > 0 && Object.values(touched).some(Boolean)) || !editName || !editIssuer || !editIssueDate}
              >
                <Save className="w-4 h-4 mr-2" />
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
            <AlertDialogTitle>Delete Certification?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this certification from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCertToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CertificationsSection;
