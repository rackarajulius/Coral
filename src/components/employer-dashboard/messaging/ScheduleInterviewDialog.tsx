import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { proposeInterview } from "@/lib/api/hiring";

type Medium = "video" | "phone" | "onsite";

/** The soonest a slot may be — an invitation for five minutes' time helps nobody. */
const MIN_LEAD_MINUTES = 30;

function defaultSlot(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(10, 0, 0, 0);
  // datetime-local wants local time with no zone suffix.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Proposes interview times to a candidate.
 *
 * Times are offered rather than imposed: the candidate picks one from their
 * activity page, which is also what triggers the calendar event and video link.
 * Nothing here books anything outright.
 */
export function ScheduleInterviewDialog({
  open,
  onClose,
  candidateId,
  candidateName,
}: {
  open: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
}) {
  const [role, setRole] = useState("");
  const [medium, setMedium] = useState<Medium>("video");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [slots, setSlots] = useState<string[]>([defaultSlot(2)]);

  const earliest = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  const validSlots = slots.filter((s) => s && new Date(s).getTime() > earliest.getTime());
  const hasPastSlot = slots.some((s) => s && new Date(s).getTime() <= earliest.getTime());

  const propose = useMutation({
    mutationFn: () =>
      proposeInterview({
        candidateId,
        role: role.trim() || undefined,
        medium,
        location: medium === "onsite" ? location.trim() || undefined : undefined,
        proposedSlots: validSlots.map((s) => new Date(s).toISOString()),
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Invitation sent", {
        description: `${candidateName} can pick a time from their activity page.`,
      });
      setRole("");
      setMessage("");
      setSlots([defaultSlot(2)]);
      onClose();
    },
    // Surfaced verbatim: the common failure here is the verification gate, and
    // "couldn't schedule" would hide the one thing they need to act on.
    onError: (e) => toast.error((e as Error).message || "Couldn't send the invitation"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Invite {candidateName} to interview</DialogTitle>
          <DialogDescription>
            Offer a few times. They choose one, and the calendar invite and video link follow
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="iv-role">Role (optional)</Label>
            <Input
              id="iv-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Senior Backend Engineer"
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="iv-medium">Format</Label>
              <Select value={medium} onValueChange={(v) => setMedium(v as Medium)}>
                <SelectTrigger id="iv-medium" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="onsite">In person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {medium === "onsite" && (
              <div>
                <Label htmlFor="iv-location">Where</Label>
                <Input
                  id="iv-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Office address"
                  className="mt-1.5"
                />
              </div>
            )}
          </div>

          <div>
            <Label>Times you can offer</Label>
            <div className="mt-1.5 space-y-2">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={slot}
                    onChange={(e) =>
                      setSlots((s) => s.map((v, n) => (n === i ? e.target.value : v)))
                    }
                    className="flex-1"
                  />
                  {slots.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground"
                      onClick={() => setSlots((s) => s.filter((_, n) => n !== i))}
                      aria-label="Remove this time"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {/* Three is plenty — a long list makes choosing harder, not easier. */}
            {slots.length < 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-xs"
                onClick={() => setSlots((s) => [...s, defaultSlot(s.length + 2)])}
              >
                <Plus className="h-3.5 w-3.5" />Add another time
              </Button>
            )}
            {hasPastSlot && (
              <p className="mt-1.5 text-xs text-destructive">
                Times must be at least {MIN_LEAD_MINUTES} minutes from now.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="iv-message">Message (optional)</Label>
            <Textarea
              id="iv-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything they should know beforehand."
              className="mt-1.5 min-h-[70px] resize-y"
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={propose.isPending}>Cancel</Button>
          <Button
            onClick={() => propose.mutate()}
            disabled={validSlots.length === 0 || propose.isPending}
          >
            {propose.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduleInterviewDialog;
