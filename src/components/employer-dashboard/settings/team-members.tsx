import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, MoreHorizontal, Loader2, Send, Pause, Play, Trash2, Check, Clock, ShieldAlert, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SectionCard, Field } from "./shared";
import JoinLinkCard from "./JoinLinkCard";
import {
  ASSIGNABLE_ROLES, ROLE_LABELS, approveMember, getTeam, inviteMember, reactivateMember,
  removeMember, revokeInvitation, setMemberRole, suspendMember,
  type CompanyRole, type TeamMember,
} from "@/lib/api/companyTeam";

const statusStyle = (s: string) =>
  s === "ACTIVE" ? "bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]"
  : s === "PENDING" ? "bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))]"
  : "bg-[hsl(var(--status-rejected))]/10 text-[hsl(var(--status-rejected))]";

const statusLabel = (s: string) =>
  s === "ACTIVE" ? "Active" : s === "PENDING" ? "Awaiting approval" : "Suspended";

export default function TeamMembers() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<TeamMember | null>(null);

  const team = useQuery({ queryKey: ["company-team"], queryFn: getTeam, retry: false });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["company-team"] });

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => invalidate(),
    // Server messages here are the lock-out rules ("only owner can…", "this is
    // the company's only owner") — worth showing verbatim rather than replacing
    // with something generic.
    onError: (e) => toast.error((e as Error).message),
  });

  if (team.isLoading) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }
  if (team.isError || !team.data) {
    return (
      <SectionCard title="Team members" description="Who has access to this company.">
        <p className="py-8 text-center text-sm text-muted-foreground">
          {(team.error as Error)?.message || "Couldn't load your team."}
        </p>
      </SectionCard>
    );
  }

  const { members, invitations, canManage, myRole } = team.data;
  const needle = q.trim().toLowerCase();
  const filtered = members.filter(
    (m) => !needle || m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle),
  );
  const pending = filtered.filter((m) => m.status === "PENDING");
  const seated = filtered.filter((m) => m.status !== "PENDING");

  return (
    <div className="space-y-6">
      {/* Requests come first: someone is waiting, and until they're approved
          they hold no access at all. */}
      {pending.length > 0 && (
        <SectionCard
          title="Requests to join"
          description="They signed up with an email address on your domain. A matching domain is not proof they work here — approve only people you recognise."
        >
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <RoleSelect
                      value={m.role}
                      myRole={myRole}
                      onChange={(role) => act.mutate(() => approveMember(m.id, role))}
                      className="w-40"
                    />
                    <Button size="sm" onClick={() => act.mutate(() => approveMember(m.id))} disabled={act.isPending}>
                      <Check className="h-3.5 w-3.5" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => act.mutate(() => removeMember(m.id))}
                      disabled={act.isPending}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs">Awaiting an owner</Badge>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {canManage && <JoinLinkCard />}

      <SectionCard
        title="Team members"
        description="Everyone who can see this company's jobs, candidates and messages."
        action={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                className="h-9 w-48 pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4" />Invite
              </Button>
            )}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {seated.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={m} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {m.name}
                        {m.isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {canManage && !m.isSelf && m.role !== "OWNER" ? (
                    <RoleSelect
                      value={m.role}
                      myRole={myRole}
                      onChange={(role) => act.mutate(() => setMemberRole(m.id, role))}
                      className="w-44"
                    />
                  ) : (
                    <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", statusStyle(m.status))}>
                    {statusLabel(m.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {/* Owners and your own row have no actions — the server
                      refuses both, so offering them would only produce errors. */}
                  {canManage && !m.isSelf && m.role !== "OWNER" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.status === "SUSPENDED" ? (
                          <DropdownMenuItem onClick={() => act.mutate(() => reactivateMember(m.id))}>
                            <Play className="h-4 w-4" />Reactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setSuspendTarget(m)}>
                            <Pause className="h-4 w-4" />Suspend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setRemoveTarget(m)}>
                          <Trash2 className="h-4 w-4" />Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {seated.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  {needle ? "No one matches that search." : "You're the only person here."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {invitations.length > 0 && (
        <SectionCard title="Pending invitations" description="Sent but not yet accepted.">
          <div className="space-y-2">
            {invitations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABELS[i.role]} ·{" "}
                    {i.expired
                      ? "Expired — send a new invitation"
                      : `Expires ${new Date(i.expiresAt).toLocaleDateString()}`}
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => act.mutate(() => revokeInvitation(i.id))}
                    disabled={act.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <InviteDialog
        open={inviteOpen}
        myRole={myRole}
        onClose={() => setInviteOpen(false)}
        onSent={() => { setInviteOpen(false); invalidate(); }}
      />

      <AlertDialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspendTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They keep their account but lose all access to this company until you reactivate them.
              Their jobs, messages and interviews stay with the company.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (suspendTarget) act.mutate(() => suspendMember(suspendTarget.id)); setSuspendTarget(null); }}
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access immediately. Everything they did for the company — jobs posted,
              candidate threads, interviews — stays with the company.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (removeTarget) act.mutate(() => removeMember(removeTarget.id)); setRemoveTarget(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MemberAvatar({ member }: { member: TeamMember }) {
  const initials = member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Avatar className="h-9 w-9 shrink-0">
      {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
      <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

/** Owner is offered only to owners — the server refuses it from anyone else. */
function RoleSelect({
  value, myRole, onChange, className,
}: {
  value: CompanyRole;
  myRole: CompanyRole;
  onChange: (role: CompanyRole) => void;
  className?: string;
}) {
  const options: CompanyRole[] = myRole === "OWNER" ? ["OWNER", ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CompanyRole)}>
      <SelectTrigger className={cn("h-9", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InviteDialog({
  open, myRole, onClose, onSent,
}: { open: boolean; myRole: CompanyRole; onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("RECRUITER");

  const send = useMutation({
    mutationFn: () => inviteMember(email.trim(), role),
    onSuccess: () => {
      toast.success("Invitation sent", { description: `${email.trim()} has 7 days to accept.` });
      setEmail("");
      setRole("RECRUITER");
      onSent();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Invite someone to your team</DialogTitle>
          <DialogDescription>
            They'll be able to see this company's jobs, candidates and messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Email address">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              autoFocus
            />
          </Field>
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(myRole === "OWNER" ? (["OWNER", ...ASSIGNABLE_ROLES] as CompanyRole[]) : ASSIGNABLE_ROLES).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Anyone you add can read applications and CVs sent to this company. Add only people who
            should see candidate personal data.
          </p>
          <p className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              They'll get a link that expires in 7 days. Only this address can use it — forwarding
              it to someone else won't let them in.
            </span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={!email.trim().includes("@") || send.isPending}>
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <Send className="h-4 w-4" />Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
