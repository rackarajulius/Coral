import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import {
  AlertTriangle, CheckCircle2, Copy, Loader2, Plug, Plus, Send, Trash2, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  connectGoogleWithPopup, disconnectGoogle,
} from "@/lib/api/googleIntegration";
import {
  createWebhook, deleteWebhook, disconnectMicrosoft, disconnectSlack, disconnectZoom,
  getMicrosoftConsentUrl, getSlackInstallUrl, getWebhookEvents, getZoomConsentUrl,
  listIntegrations, listWebhooks, testSlack, testWebhook,
  type IntegrationEntry, type Webhook,
} from "@/lib/api/integrations";

const iconFor = (name: string): LucideIcon =>
  (Icons as unknown as Record<string, LucideIcon>)[name] ?? Plug;

/**
 * Integrations, on its own page rather than a settings tab.
 *
 * The catalogue comes from the server, generated from what is implemented.
 * Hardcoding it in the UI is how webhooks — model, signing secret, delivery
 * tracking and a live emitter — spent their existence listed as "Coming soon".
 */
export default function Integrations() {
  const [params] = useSearchParams();
  const connectRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);

  const catalogue = useQuery({
    queryKey: ["integrations-catalogue"],
    queryFn: listIntegrations,
    retry: false,
  });

  // Slack and Microsoft both return via a full-page redirect rather than a
  // popup, so the outcome arrives as a query parameter.
  useEffect(() => {
    for (const [key, label] of [
      ["slack", "Slack"],
      ["microsoft", "Outlook & Teams"],
      ["zoom", "Zoom"],
    ] as const) {
      const result = params.get(key);
      if (!result) continue;
      if (result === "connected") toast.success(`${label} connected`);
      else toast.error(`${label} connection failed`);
      // Cleared so a refresh doesn't repeat the toast.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Deep-linked from the sidebar's + and from the "connect a calendar"
  // next-action, so the param has to land somewhere visible.
  useEffect(() => {
    if (params.get("connect") !== "1") return;
    connectRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 1600);
    return () => clearTimeout(t);
  }, [params]);

  const entries = catalogue.data ?? [];
  const live = entries.filter((e) => e.status === "connected");
  const offered = entries.filter((e) => e.status === "available" || e.status === "unavailable");
  const later = entries.filter((e) => e.status === "coming_soon");

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Coral to the tools your team already uses.
        </p>
      </header>

      {catalogue.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : catalogue.isError ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {(catalogue.error as Error)?.message || "Couldn't load integrations."}
        </p>
      ) : (
        <div ref={connectRef} className={cn("rounded-2xl transition-shadow", highlight && "ring-2 ring-coral")}>
          {live.length > 0 && (
            <Section title="Connected">
              {live.map((e) => <IntegrationCard key={e.key} entry={e} />)}
            </Section>
          )}
          {offered.length > 0 && (
            <Section title={live.length > 0 ? "Available" : "Connect a tool"}>
              {offered.map((e) => <IntegrationCard key={e.key} entry={e} />)}
            </Section>
          )}
          {later.length > 0 && (
            <Section title="Coming soon">
              {later.map((e) => <IntegrationCard key={e.key} entry={e} />)}
            </Section>
          )}
        </div>
      )}

      <div className="my-8 border-t border-dashed border-border" />
      <WebhooksPanel />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function IntegrationCard({ entry }: { entry: IntegrationEntry }) {
  const Icon = iconFor(entry.icon);
  const isGoogle = entry.key === "google-calendar";

  return (
    <article className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{entry.name}</h3>
          <StatusBadge status={entry.status} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
        {entry.detail && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{entry.detail}</p>
        )}
        {isGoogle && entry.status !== "coming_soon" && entry.status !== "unavailable" && (
          <GoogleControls connected={entry.status === "connected"} />
        )}
        {entry.key === "slack" && entry.status !== "coming_soon" && entry.status !== "unavailable" && (
          <SlackControls connected={entry.status === "connected"} />
        )}
        {entry.key === "microsoft" && entry.status !== "coming_soon" && entry.status !== "unavailable" && (
          <OAuthControls
            connected={entry.status === "connected"}
            label="Outlook & Teams"
            getUrl={getMicrosoftConsentUrl}
            onDisconnect={disconnectMicrosoft}
            disconnectBlurb="New interviews will no longer get a Teams link automatically. Interviews already scheduled keep the links they have."
          />
        )}
        {entry.key === "zoom" && entry.status !== "coming_soon" && entry.status !== "unavailable" && (
          <OAuthControls
            connected={entry.status === "connected"}
            label="Zoom"
            getUrl={getZoomConsentUrl}
            onDisconnect={disconnectZoom}
            disconnectBlurb="New interviews will no longer get a Zoom link. Interviews already scheduled keep the links they have."
          />
        )}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: IntegrationEntry["status"] }) {
  if (status === "connected") {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Connected
      </Badge>
    );
  }
  if (status === "unavailable") {
    // Not "coming soon": it is built, this deployment just has no credentials.
    return (
      <Badge variant="outline" className="gap-1 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Not enabled
      </Badge>
    );
  }
  if (status === "coming_soon") {
    return <Badge variant="outline" className="text-xs font-normal">Coming soon</Badge>;
  }
  return null;
}

function GoogleControls({ connected }: { connected: boolean }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["integrations-catalogue"] });
    queryClient.invalidateQueries({ queryKey: ["google-integration", "status"] });
  };

  const connect = useMutation({
    mutationFn: connectGoogleWithPopup,
    onSuccess: (result) => {
      if (result === "connected") {
        toast.success("Google Calendar connected", {
          description: "Confirmed interviews will get a Meet link automatically.",
        });
        refresh();
      } else if (result === "error") {
        toast.error("Google Calendar connection failed");
      }
      // "dismissed"/"blocked" — the helper already handled the messaging.
    },
    onError: () => toast.error("Google integration isn't configured"),
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogle,
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      refresh();
      setConfirmOpen(false);
    },
    onError: () => toast.error("Couldn't disconnect Google Calendar"),
  });

  return (
    <>
      <div className="mt-3">
        {connected ? (
          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setConfirmOpen(true)}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" className="h-8" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Connect
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              New interviews will no longer get a Meet link automatically. Interviews already
              scheduled keep the links they have.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnect.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); disconnect.mutate(); }}
              disabled={disconnect.isPending}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SlackControls({ connected }: { connected: boolean }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["integrations-catalogue"] });

  const connect = useMutation({
    mutationFn: getSlackInstallUrl,
    // A full-page redirect rather than a popup: Slack's install screen asks the
    // user to pick a channel, which is too much to do in a popup window.
    onSuccess: (url) => { window.location.href = url; },
    onError: (e) => toast.error((e as Error).message),
  });

  const test = useMutation({
    mutationFn: testSlack,
    onSuccess: (r) => {
      refresh();
      if (r.ok) toast.success("Posted to your channel");
      else toast.error("Couldn't post", { description: r.error });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disconnect = useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => { refresh(); setConfirmOpen(false); toast.success("Slack disconnected"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              {test.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <Send className="h-3.5 w-3.5" />}
              Send test
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setConfirmOpen(true)}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" className="h-8" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Add to Slack
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
            <AlertDialogDescription>
              Your channel stops receiving updates. Nothing else changes, and you can reconnect at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnect.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); disconnect.mutate(); }}
              disabled={disconnect.isPending}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Connect / disconnect for a provider that redirects the whole page.
 *
 * Microsoft and Zoom differ only in copy and endpoints, so they share this
 * rather than being two near-identical components that drift apart.
 */
function OAuthControls({
  connected, label, getUrl, onDisconnect, disconnectBlurb,
}: {
  connected: boolean;
  label: string;
  getUrl: () => Promise<string>;
  onDisconnect: () => Promise<unknown>;
  disconnectBlurb: string;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["integrations-catalogue"] });

  const connect = useMutation({
    mutationFn: getUrl,
    onSuccess: (url) => { window.location.href = url; },
    onError: (e) => toast.error((e as Error).message),
  });

  const disconnect = useMutation({
    mutationFn: onDisconnect,
    onSuccess: () => { refresh(); setConfirmOpen(false); toast.success(`${label} disconnected`); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <div className="mt-3">
        {connected ? (
          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setConfirmOpen(true)}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" className="h-8" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Connect
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {label}?</AlertDialogTitle>
            <AlertDialogDescription>{disconnectBlurb}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnect.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); disconnect.mutate(); }}
              disabled={disconnect.isPending}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------- webhooks -------------------------------- */

function WebhooksPanel() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Webhook | null>(null);
  const [revealed, setRevealed] = useState<{ url: string; secret: string } | null>(null);

  const hooks = useQuery({ queryKey: ["webhooks"], queryFn: listWebhooks, retry: false });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    queryClient.invalidateQueries({ queryKey: ["integrations-catalogue"] });
  };

  const remove = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => { refresh(); toast.success("Endpoint removed"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const send = useMutation({
    mutationFn: testWebhook,
    onSuccess: (r) => {
      refresh();
      // The real delivery result, including the status code, because "sent"
      // without an outcome tells you nothing about whether it arrived.
      if (r.ok) toast.success("Test delivered", { description: `Responded ${r.status}` });
      else toast.error("Test failed", { description: r.error || `Responded ${r.status ?? "no response"}` });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = hooks.data ?? [];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Webhook endpoints</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Signed callbacks when a screening finishes. Every request carries an
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[11px]">X-Coral-Signature</code>
            header your receiver should verify.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />Add endpoint
        </Button>
      </div>

      {hooks.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : hooks.isError ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {(hooks.error as Error)?.message || "Couldn't load endpoints."}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No endpoints yet. Add one to receive screening results in your own systems.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((h) => (
            <article key={h.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground">{h.url}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {h.events.join(", ") || "No events"}
                    {!h.active && " · disabled after repeated failures"}
                  </p>
                  {/* A silently broken endpoint is the whole failure mode this
                      panel exists to surface. */}
                  {h.lastAttemptAt && (
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        h.lastStatus && h.lastStatus < 300
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive",
                      )}
                    >
                      Last delivery {h.lastStatus ? `responded ${h.lastStatus}` : "failed"}
                      {h.lastError ? ` — ${h.lastError}` : ""}
                      {h.failureCount > 0 ? ` · ${h.failureCount} consecutive failures` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => send.mutate(h.id)}
                    disabled={send.isPending}
                  >
                    {send.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      : <Send className="h-3.5 w-3.5" />}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => setConfirmDelete(h)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AddWebhookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false);
          refresh();
          setRevealed({ url: created.url, secret: created.secret });
        }}
      />

      {/* Shown once. The server never returns it again. */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Save your signing secret</DialogTitle>
            <DialogDescription>
              This is the only time it is shown. Use it to verify the
              <code className="mx-1">X-Coral-Signature</code> header on every delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3">
            <code className="block break-all font-mono text-xs">{revealed?.secret}</code>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (revealed) navigator.clipboard.writeText(revealed.secret);
                toast.success("Secret copied");
              }}
            >
              <Copy className="h-4 w-4" />Copy secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              Deliveries stop immediately. Adding it back issues a new signing secret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) remove.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AddWebhookDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: { url: string; secret: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const events = useQuery({
    queryKey: ["webhook-events"],
    queryFn: getWebhookEvents,
    enabled: open,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  // Everything is selected by default: an endpoint subscribed to nothing looks
  // connected and never fires, which is the hardest kind of bug to notice.
  useEffect(() => {
    if (events.data && selected.length === 0) setSelected(events.data);
  }, [events.data]);

  const create = useMutation({
    mutationFn: () => createWebhook(url.trim(), selected),
    onSuccess: (created) => {
      setUrl("");
      onCreated(created);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add a webhook endpoint</DialogTitle>
          <DialogDescription>
            We'll POST signed JSON here when the events you pick happen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className="text-sm font-medium" htmlFor="hook-url">Endpoint URL</label>
            <Input
              id="hook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/coral"
              className="mt-1.5 font-mono text-xs"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Must be HTTPS and publicly reachable.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Events</p>
            <div className="mt-1.5 space-y-2">
              {events.isLoading ? (
                <Skeleton className="h-8 rounded" />
              ) : (
                (events.data ?? []).map((ev) => (
                  <label key={ev} className="flex cursor-pointer items-center gap-2.5 text-xs">
                    <Checkbox
                      checked={selected.includes(ev)}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v === true ? [...s, ev] : s.filter((x) => x !== ev)))
                      }
                    />
                    <code className="text-muted-foreground">{ev}</code>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!url.trim().startsWith("https://") || selected.length === 0 || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Add endpoint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
