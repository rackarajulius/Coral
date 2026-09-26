import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adoptGif, searchGifs } from "@/lib/api/community";

/**
 * Picks a GIF.
 *
 * Choosing one does not insert its address — the server fetches it and stores
 * a copy, so the post ends up referencing our own bucket like every other
 * attachment. That is why selecting shows a spinner: a real transfer happens
 * between the tap and the preview appearing.
 */
export function GifPicker({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (media: { url: string; path: string }) => void;
}) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  // Debounced so typing does not fire a request per keystroke against a
  // third-party quota.
  useEffect(() => {
    const t = setTimeout(() => setQuery(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery({
    queryKey: ["gif-search", query],
    queryFn: () => searchGifs(query),
    enabled: open && query.length > 1,
    retry: false,
  });

  const adopt = useMutation({
    mutationFn: (url: string) => adoptGif(url),
    onSuccess: (media) => {
      onPicked(media);
      setTerm("");
      setQuery("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add a GIF</DialogTitle>
          <DialogDescription>Searches Tenor. A copy is saved with your post.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search GIFs"
            className="pl-9"
          />
        </div>

        <div className="max-h-[50vh] min-h-[8rem] overflow-y-auto">
          {adopt.isPending && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving a copy…
            </div>
          )}

          {!adopt.isPending && results.isFetching && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}

          {!adopt.isPending && results.isError && (
            <p className="py-8 text-center text-sm text-destructive">
              {(results.error as Error).message}
            </p>
          )}

          {!adopt.isPending && !results.isFetching && query.length > 1 && results.data?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing for “{query}”.
            </p>
          )}

          {!adopt.isPending && results.data && results.data.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {results.data.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => adopt.mutate(gif.url)}
                  className="overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.description}
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GifPicker;
