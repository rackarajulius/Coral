import { useState, useEffect, useRef } from 'react';
import { Plus, FileText, ExternalLink, Pencil, Save, X, Trash2, AlertCircle, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile, PortfolioItem } from '@/contexts/ProfileContext';
import { uploadPortfolioImage } from '@/lib/api/jobSeekerProfile';

/** What the link is called, per kind of item. */
const LINK_COPY: Record<PortfolioItem['type'], { label: string; placeholder: string; open: string }> = {
  project: { label: 'Link', placeholder: 'e.g., github.com/username/project', open: 'View project' },
  video: { label: 'Video link', placeholder: 'e.g., youtube.com/watch?v=abc123', open: 'Watch' },
  document: { label: 'Document link', placeholder: 'e.g., drive.google.com/file/...', open: 'Open document' },
  design: { label: 'Design link', placeholder: 'e.g., figma.com/file/...', open: 'View design' },
};

interface ValidationErrors {
  title?: string;
  description?: string;
  link?: string;
  image?: string;
}

const PortfolioSection = () => {
  const { profile, addPortfolioItem, updatePortfolioItem, deletePortfolioItem } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  
  // Form states
  const [editType, setEditType] = useState<PortfolioItem['type']>('project');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editImageUrl, setEditImageUrl] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ title: boolean; description: boolean; link: boolean }>({
    title: false,
    description: false,
    link: false,
  });

  const validate = () => {
    const newErrors: ValidationErrors = {};
    
    if (!editTitle.trim()) {
      newErrors.title = 'Title is required';
    } else if (editTitle.trim().length < 2) {
      newErrors.title = 'Title must be at least 2 characters';
    } else if (editTitle.trim().length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }
    
    if (!editDescription.trim()) {
      newErrors.description = 'Description is required';
    } else if (editDescription.trim().length > 200) {
      newErrors.description = 'Description cannot exceed 200 characters';
    }
    
    // Any kind of item may carry a link. Only Projects used to get the field,
    // so a "Document" item was a title and a picture with the document nowhere.
    if (editLink.trim()) {
      // Basic URL validation
      const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
      if (!urlPattern.test(editLink.trim())) {
        newErrors.link = 'Please enter a valid URL';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate on change after touched
  useEffect(() => {
    if (Object.values(touched).some(Boolean)) {
      validate();
    }
  }, [editTitle, editDescription, editLink, touched]);

  const openEditDialog = (item: PortfolioItem | null) => {
    if (item) {
      setEditingItem(item);
      setEditType(item.type);
      setEditTitle(item.title);
      setEditDescription(item.description);
      setEditLink(item.link || '');
      setEditImageUrl(item.imageUrl);
    } else {
      setEditingItem(null);
      setEditType('project');
      setEditTitle('');
      setEditDescription('');
      setEditLink('');
      setEditImageUrl(undefined);
    }
    setErrors({});
    setTouched({ title: false, description: false, link: false });
    setIsEditDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Please upload an image file' }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Image must be less than 5MB' }));
      return;
    }

    setIsUploading(true);
    setErrors(prev => ({ ...prev, image: undefined }));

    try {
      // Straight to storage; the item keeps only the URL. Encoding the picture
      // into the item itself put megabytes of text into every profile response,
      // and anything much over 1.5 MB was refused outright.
      setEditImageUrl(await uploadPortfolioImage(file));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        image: err instanceof Error ? err.message : 'Failed to upload image',
      }));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  /**
   * Older items kept the picture inside themselves as a data URL. Move it into
   * storage the first time such an item is saved, so it stops travelling in
   * every profile response.
   */
  const toStoredUrl = async (url: string | undefined): Promise<string | undefined> => {
    if (!url || !url.startsWith('data:')) return url;
    const blob = await (await fetch(url)).blob();
    const ext = blob.type.split('/')[1] || 'png';
    return uploadPortfolioImage(new File([blob], `portfolio.${ext}`, { type: blob.type }));
  };

  const handleSave = async () => {
    setTouched({ title: true, description: true, link: true });
    
    if (!validate() || isSaving) {
      return;
    }

    setIsSaving(true);
    let imageUrl: string | undefined;
    try {
      imageUrl = await toStoredUrl(editImageUrl);
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        image: err instanceof Error ? err.message : 'Could not save the image',
      }));
      setIsSaving(false);
      return;
    }

    // No view or download counts: nothing measures either, and a permanent
    // "0 views" claimed that something did.
    const itemData: Omit<PortfolioItem, 'id'> = {
      type: editType,
      title: editTitle,
      description: editDescription,
      thumbnail: editType,
      imageUrl,
      link: editLink.trim() || undefined,
    };

    if (editingItem) {
      updatePortfolioItem(editingItem.id, itemData);
    } else {
      addPortfolioItem(itemData);
    }
    setIsSaving(false);
    setIsEditDialogOpen(false);
  };

  const handleDelete = () => {
    if (itemToDelete) {
      deletePortfolioItem(itemToDelete);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const renderThumbnail = (item: PortfolioItem) => {
    const bgColors: Record<string, string> = {
      video: 'bg-purple-100 text-purple-600',
      document: 'bg-blue-100 text-blue-600',
      project: 'bg-green-100 text-green-600',
      design: 'bg-orange-100 text-orange-600',
    };
    
    // If there's a custom image, show it
    if (item.imageUrl) {
      return (
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
          <img 
            src={item.imageUrl} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    // Otherwise show type-based placeholder
    return (
      <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${bgColors[item.type]} flex items-center justify-center`}>
        <span className="text-xs font-semibold capitalize">{item.type}</span>
      </div>
    );
  };

  return (
    <>
      <section className="bg-card rounded-lg border border-border p-5" role="region" aria-label="Featured portfolio items">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Featured</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => openEditDialog(null)}
              className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Add featured item"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => profile.portfolioItems[0] && openEditDialog(profile.portfolioItems[0])}
              className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Edit featured items"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Portfolio Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.portfolioItems.map((item) => (
            // No pointer cursor: the card itself does nothing. Only the link
            // underneath opens anything, and it says where it goes.
            <div
              key={item.id}
              className="flex gap-3 p-3 rounded-lg border border-border transition-colors group"
              role="article"
              aria-label={item.title}
            >
              {/* Thumbnail */}
              {renderThumbnail(item)}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {item.title}
                  </h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(item);
                    }}
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                
                {/* Where the work itself lives */}
                {item.link && (
                  <a
                    href={item.link.startsWith('http') ? item.link : `https://${item.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
                  >
                    {LINK_COPY[item.type].open}
                    <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {profile.portfolioItems.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No featured items yet</p>
            <Button variant="outline" onClick={() => openEditDialog(null)}>
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Featured Item
            </Button>
          </div>
        )}

        {/* Add New Button */}
        {profile.portfolioItems.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4 border-dashed border-2 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/50"
            onClick={() => openEditDialog(null)}
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add another item
          </Button>
        )}
      </section>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby="portfolio-dialog-description">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Featured Item' : 'Add Featured Item'}</DialogTitle>
          </DialogHeader>
          <p id="portfolio-dialog-description" className="sr-only">
            Add or edit a featured portfolio item with title, description, and optional image.
          </p>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="portfolio-type" className="text-sm font-medium text-gray-700 mb-2 block">Type</label>
              <Select value={editType} onValueChange={(value: PortfolioItem['type']) => setEditType(value)}>
                <SelectTrigger id="portfolio-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="portfolio-title" className="text-sm font-medium text-gray-700 mb-2 block">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                id="portfolio-title"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setTouched(prev => ({ ...prev, title: true }));
                }}
                className={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., Product Launch Keynote"
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
              <label htmlFor="portfolio-description" className="text-sm font-medium text-gray-700 mb-2 block">
                Description <span className="text-red-500">*</span>
              </label>
              <Input
                id="portfolio-description"
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  setTouched(prev => ({ ...prev, description: true }));
                }}
                className={errors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder="e.g., AfriTech Summit 2025"
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'description-error' : undefined}
              />
              {errors.description && (
                <p id="description-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  {errors.description}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {editDescription.length}/200 characters
              </p>
            </div>
            
            {/* Image Upload */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Image (optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                aria-label="Upload portfolio image"
              />
              
              {editImageUrl ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={editImageUrl} 
                    alt="Portfolio preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setEditImageUrl(undefined)}
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50"
                  aria-label="Click to upload image"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6" aria-hidden="true" />
                      <span className="text-xs">Click to upload image</span>
                      <span className="text-xs text-gray-400">Max 5MB</span>
                    </>
                  )}
                </button>
              )}
              {errors.image && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  {errors.image}
                </p>
              )}
            </div>
            
            {/* Every type gets this: a Video with nowhere to watch it, or a
                Document with nothing to open, was of no use to anyone. */}
            <div>
              <label htmlFor="portfolio-link" className="text-sm font-medium text-gray-700 mb-2 block">
                {LINK_COPY[editType].label} (optional)
              </label>
              <Input
                id="portfolio-link"
                value={editLink}
                onChange={(e) => {
                  setEditLink(e.target.value);
                  setTouched(prev => ({ ...prev, link: true }));
                }}
                className={errors.link ? 'border-red-500 focus-visible:ring-red-500' : ''}
                placeholder={LINK_COPY[editType].placeholder}
                aria-invalid={!!errors.link}
                aria-describedby={errors.link ? 'link-error' : undefined}
              />
              {errors.link && (
                <p id="link-error" className="text-xs text-red-500 flex items-center gap-1 mt-1" role="alert">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  {errors.link}
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <div>
              {editingItem && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setItemToDelete(editingItem.id);
                    setDeleteConfirmOpen(true);
                    setIsEditDialogOpen(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" aria-hidden="true" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={isSaving || isUploading || (Object.keys(errors).length > 0 && Object.values(touched).some(Boolean)) || !editTitle || !editDescription}
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
            <AlertDialogTitle>Delete Featured Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this item from your featured section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PortfolioSection;
