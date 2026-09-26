import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { responseTemplates, reviews } from "@/data/employer/reviews/reviews";
import { toast } from "@/hooks/use-toast";

import { cn } from "@/lib/utils";
import { Send, Star, Stars } from "lucide-react";
import { useState } from "react";

const ResponseDialog = () => {
    
    function Stars({ value, size = 14 }: { value: number; size?: number }) {
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors",
                i <= Math.round(value) ? "fill-accent text-accent" : "fill-muted text-muted"
              )}
            />
          ))}
        </div>
      );
    };
    const submitResponse = () => {
        toast({ title: "Response published", description: "Your reply is now visible on the review." });
        setResponseDialog(null);
        setResponseText("");
      };
    
     const [responseDialog, setResponseDialog] = useState<string | null>(null);
      const [responseText, setResponseText] = useState("");
  return (
   <Dialog open={!!responseDialog} onOpenChange={(o) => !o && setResponseDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
          </DialogHeader>
          {responseDialog && (() => {
            const r = reviews.find((x) => x.id === responseDialog);
            if (!r) return null;
            return (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Stars value={r.rating} size={12} />
                    <span className="text-xs text-muted-foreground">{r.type} · {r.date}</span>
                  </div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Response</label>
                    <Select onValueChange={(v) => setResponseText(responseTemplates.find((t) => t.id === v)?.body || "")}>
                      <SelectTrigger className="h-7 w-auto text-xs"><SelectValue placeholder="Use template" /></SelectTrigger>
                      <SelectContent>
                        {responseTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write a thoughtful, professional response..."
                    className="min-h-[160px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Responses are public and represent your company. Be respectful and constructive.</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialog(null)}>Save Draft</Button>
            <Button onClick={submitResponse} className="gap-2"><Send className="h-3.5 w-3.5" />Publish Response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
};

export default ResponseDialog;
