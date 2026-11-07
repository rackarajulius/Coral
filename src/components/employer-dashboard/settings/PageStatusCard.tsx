import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionCard } from "./shared";
import {
  cancelCompanyDeletion,
  deactivateCompanyPage,
  getCompanyPageStatus,
  reactivateCompanyPage,
  scheduleCompanyDeletion,
} from "@/lib/api/companyTeam";

export const COMPANY_PAGE_STATUS_KEY = ["company-page-status"] as const;

/**
 * Deactivate and reactivate the company page — LinkedIn's Settings ›
 * Deactivate page, with the same tick-to-confirm instead of a pop-up. Only the
 * owner gets the controls; everyone else is told when the page is down.
 */
export function PageStatusCard() {
  const queryClient = useQueryClient();
  const [understood, setUnderstood] = useState(false);
  const { data: status } = useQuery({
    queryKey: COMPANY_PAGE_STATUS_KEY,
    queryFn: getCompanyPageStatus,
    retry: false,
  });

  const settle = () => {
    setUnderstood(false);
    queryClient.invalidateQueries({ queryKey: COMPANY_PAGE_STATUS_KEY });
    queryClient.invalidateQueries({ queryKey: ["employer-verification"] });
  };
  const deactivate = useMutation({
    mutationFn: deactivateCompanyPage,
    onSuccess: (result) => {
      settle();
      toast.success("Page deactivated", {
        description: `${result.jobsClosed} live job${result.jobsClosed === 1 ? "" : "s"} closed. You can reactivate it here at any time.`,
      });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't deactivate the page"),
  });
  const reactivate = useMutation({
    mutationFn: reactivateCompanyPage,
    onSuccess: () => {
      settle();
      toast.success("Page reactivated", { description: "It's visible again at the same address." });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't reactivate the page"),
  });

  // Nothing to say to someone who can't act and whose page is live.
  if (!status || (!status.canManage && !status.deactivatedAt)) return null;
  const name = status.companyName || "Your company";

  if (status.deactivatedAt) {
    const since = new Date(status.deactivatedAt).toLocaleDateString(undefined, { dateStyle: "medium" });
    return (
      <>
        <SectionCard
          title="Page deactivated"
          description={`${name}'s page has been down since ${since}. Visitors get a "not found" page, and nobody can post jobs or post as the company.`}
        >
          <p className="text-sm text-muted-foreground">
            Reactivating brings it back at the same address with its followers. Jobs closed when it
            was deactivated stay closed — reopen the ones you want from Jobs.
            {status.deletesAt ? " Reactivating also calls off the deletion." : ""}
          </p>
          {status.canManage ? (
            <Button className="mt-4" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
              {reactivate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              Reactivate page
            </Button>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Your company's owner can reactivate it.</p>
          )}
        </SectionCard>
        {status.canManage && <DeletePageCard name={name} deletesAt={status.deletesAt} onSettled={settle} />}
      </>
    );
  }

  return (
    <SectionCard
      title="Deactivate page"
      description={`Take ${name}'s page down without deleting anything.`}
    >
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Visitors get a "not found" page, and it leaves search, Companies and @mentions.</li>
        <li>Its live jobs close, so nobody applies while it's down.</li>
        <li>Nobody can post jobs, contact candidates or post as the company.</li>
        <li>Followers, posts, your team and your plan stay as they are.</li>
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={understood}
          onCheckedChange={(v) => setUnderstood(v === true)}
        />
        <span className="text-muted-foreground">
          I understand the page and its live jobs will be taken down until I reactivate it.
        </span>
      </label>
      <Button
        variant="destructive"
        className="mt-4"
        onClick={() => deactivate.mutate()}
        disabled={!understood || deactivate.isPending}
      >
        {deactivate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
        Deactivate page
      </Button>
    </SectionCard>
  );
}

/**
 * Deleting the deactivated page for good, 30 days after asking — the owner
 * types the company's name to confirm, and can call it off until the day.
 */
function DeletePageCard({
  name,
  deletesAt,
  onSettled,
}: {
  name: string;
  deletesAt: string | null;
  onSettled: () => void;
}) {
  const [typed, setTyped] = useState("");
  const schedule = useMutation({
    mutationFn: () => scheduleCompanyDeletion(typed),
    onSuccess: () => {
      setTyped("");
      onSettled();
      toast.success("Deletion scheduled", { description: "You can call it off until the day it happens." });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't schedule the deletion"),
  });
  const cancel = useMutation({
    mutationFn: cancelCompanyDeletion,
    onSuccess: () => {
      onSettled();
      toast.success("Deletion called off", { description: "The page stays deactivated." });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't call off the deletion"),
  });

  if (deletesAt) {
    const on = new Date(deletesAt).toLocaleDateString(undefined, { dateStyle: "long" });
    return (
      <SectionCard
        title="Deletion scheduled"
        description={`${name}'s page will be deleted for good on ${on}.`}
      >
        <p className="text-sm text-muted-foreground">
          Until then nothing is lost: call it off here, or reactivate the page.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
          {cancel.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          Call off the deletion
        </Button>
      </SectionCard>
    );
  }

  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();
  return (
    <SectionCard
      title="Delete page permanently"
      description="It's deleted 30 days after you ask, and you can call it off until then."
    >
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-foreground">Deleted</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The page, its followers and its address</li>
            <li>Posts and events in the company's name</li>
            <li>Your team's seats, notes, tags and decided offers</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-foreground">Kept</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Its jobs, closed, still named {name} in candidates' history</li>
            <li>Every member's own account</li>
          </ul>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        A paid plan has to be cancelled first, and no offer can still be waiting for an answer.
      </p>
      <div className="mt-4">
        <label htmlFor="confirmDelete" className="text-sm text-muted-foreground">
          Type <span className="font-medium text-foreground">{name}</span> to confirm
        </label>
        <Input
          id="confirmDelete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1.5 max-w-sm bg-card"
        />
      </div>
      <Button
        variant="destructive"
        className="mt-4"
        onClick={() => schedule.mutate()}
        disabled={!matches || schedule.isPending}
      >
        {schedule.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
        Delete in 30 days
      </Button>
    </SectionCard>
  );
}

export default PageStatusCard;
