import { useState } from 'react';
import { Quote, Pencil, Plus, Save, X, Trash2, MessageSquareQuote } from 'lucide-react';
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
import { useProfile, Recommendation } from '@/contexts/ProfileContext';

const emptyForm = { author: '', authorTitle: '', relationship: '', text: '', date: '' };

const RecommendationsSection = () => {
  const { profile, addRecommendation, updateRecommendation, deleteRecommendation } = useProfile();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recommendation | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const openEdit = (rec: Recommendation | null) => {
    if (rec) {
      setEditing(rec);
      setForm({
        author: rec.author,
        authorTitle: rec.authorTitle,
        relationship: rec.relationship,
        text: rec.text,
        date: rec.date || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const canSave = form.author.trim() && form.text.trim();

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      author: form.author.trim(),
      authorTitle: form.authorTitle.trim(),
      relationship: form.relationship.trim(),
      text: form.text.trim(),
      date: form.date.trim() || undefined,
    };
    if (editing) {
      updateRecommendation(editing.id, payload);
    } else {
      addRecommendation(payload);
    }
    setIsDialogOpen(false);
  };

  return (
    <>
      <section
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300"
        role="region"
        aria-label="Recommendations section"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <MessageSquareQuote className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recommendations</h2>
            {profile.recommendations.length > 0 && (
              <span className="text-sm text-gray-400 dark:text-gray-500">({profile.recommendations.length})</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(null)}
            className="h-9 w-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Add recommendation"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        {profile.recommendations.length > 0 ? (
          <div className="space-y-4">
            {profile.recommendations.map((rec) => (
              <div
                key={rec.id}
                className="relative group p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30"
              >
                <Quote className="w-5 h-5 text-blue-300 dark:text-blue-700 mb-2" aria-hidden="true" />
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">"{rec.text}"</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                    {rec.author.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{rec.author}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {rec.authorTitle}
                      {rec.relationship ? ` · ${rec.relationship}` : ''}
                      {rec.date ? ` · ${rec.date}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => openEdit(rec)}
                  aria-label={`Edit recommendation from ${rec.author}`}
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageSquareQuote className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No recommendations yet. Add testimonials from people you've worked with.
            </p>
            <Button variant="outline" onClick={() => openEdit(null)}>
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Recommendation
            </Button>
          </div>
        )}
      </section>

      {/* Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-gray-600" aria-hidden="true" />
              {editing ? 'Edit Recommendation' : 'Add Recommendation'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rec-author" className="text-sm font-medium text-gray-700 mb-2 block">
                  Recommender <span className="text-red-500">*</span>
                </label>
                <Input
                  id="rec-author"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="e.g., Chidi Okeke"
                />
              </div>
              <div>
                <label htmlFor="rec-title" className="text-sm font-medium text-gray-700 mb-2 block">Their title</label>
                <Input
                  id="rec-title"
                  value={form.authorTitle}
                  onChange={(e) => setForm({ ...form, authorTitle: e.target.value })}
                  placeholder="e.g., VP Engineering, Flutterwave"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rec-rel" className="text-sm font-medium text-gray-700 mb-2 block">Relationship</label>
                <Input
                  id="rec-rel"
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  placeholder="e.g., Managed you directly"
                />
              </div>
              <div>
                <label htmlFor="rec-date" className="text-sm font-medium text-gray-700 mb-2 block">Date</label>
                <Input
                  id="rec-date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  placeholder="e.g., March 2025"
                />
              </div>
            </div>
            <div>
              <label htmlFor="rec-text" className="text-sm font-medium text-gray-700 mb-2 block">
                Recommendation <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="rec-text"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={5}
                className="resize-none"
                placeholder="What did they say about working with you?"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {editing && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteId(editing.id);
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
              <Button onClick={handleSave} disabled={!canSave}>
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recommendation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This recommendation will be permanently removed from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId !== null) deleteRecommendation(deleteId);
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RecommendationsSection;
