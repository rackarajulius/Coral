import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createSpace, uploadPostMedia, type Space } from "@/lib/api/community";

/**
 * Starts a space.
 *
 * The dialog says the two things that decide whether this goes well: you are
 * taking responsibility for it, and an empty one does not stay on the list.
 * Both are true of the server, and someone who knows them up front makes a
 * better decision about whether to create one at all.
 */
export function NewSpaceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (space: Space) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: () =>
      createSpace({
        name: name.trim(),
        description: description.trim() || undefined,
        bannerUrl: banner ?? undefined,
      }),
    onSuccess: (space) => {
      toast.success(`${space.name} created`, { description: "You are its moderator." });
      void queryClient.invalidateQueries({ queryKey: ["community-spaces"] });
      setName("");
      setDescription("");
      setBanner(null);
      onCreated(space);
      onClose();
    },
    // Verbatim: the refusals here are specific and useful — a name already
    // covered, or one that is reserved — and worth reading rather than
    // flattening into "could not create".
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Uploaded before the space exists, which is fine: the file lands in our
   * bucket unattached, and an abandoned form leaves it to the hourly orphan
   * sweep rather than to nothing.
   */
  const pickBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadPostMedia(file);
      setBanner(uploaded.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const valid = name.trim().length >= 3 && !uploading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Start a space</DialogTitle>
          <DialogDescription>
            A place for one subject. You will be its moderator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/*
            A header, offered and never required.

            It sits first because this is the moment someone cares most about
            how the space looks — but a name and a first post matter more, so
            nothing here blocks Create.
          */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void pickBanner(e.target.files?.[0])}
            />
            <div className="relative h-24 overflow-hidden rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/10 to-accent/10">
              {banner && (
                <img src={banner} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {!banner && (
                  <>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {uploading ? "Uploading…" : "Add a banner (optional)"}
                  </>
                )}
              </button>
              {banner && (
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  aria-label="Remove banner"
                  className="absolute right-2 top-2 rounded-full bg-background/85 p-1 backdrop-blur"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="space-name" className="text-xs">Name</Label>
            <Input
              id="space-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data Science"
              maxLength={60}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="space-desc" className="text-xs">
              What is it for <span className="font-normal text-muted-foreground">— optional</span>
            </Label>
            <Textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line, so people know whether they belong here."
              rows={2}
              maxLength={300}
              className="mt-1 resize-none"
            />
          </div>

          {/* Said before, not discovered later. Someone whose space disappears
              without warning concludes the product ate it. */}
          <p className="text-xs text-muted-foreground">
            A space with no posts after two weeks is retired automatically. Existing subjects are
            refused so one topic does not end up split across three rooms.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewSpaceDialog;
