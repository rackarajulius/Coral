import { useState, useEffect } from "react";
import { ShieldCheck, BadgeCheck, Clock, ShieldAlert, FileText, ExternalLink, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  reviewVerification,
  getVerificationDocumentUrl,
  type AdminVerification,
  type VerificationStatus,
  type VerificationType,
} from "@/lib/api/verifications";
import { useVerificationsList, useVerificationActions } from "@/hooks/admin/useAdminVerifications";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";

const STATUS_TABS: { key: VerificationStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const TYPE_OPTIONS: { value: VerificationType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "IDENTITY", label: "Identity" },
  { value: "WORK_ELIGIBILITY", label: "Work eligibility" },
  { value: "EXPERIENCE", label: "Experience" },
  { value: "EDUCATION", label: "Education" },
];

const TYPE_LABEL: Record<VerificationType, string> = {
  IDENTITY: "Identity",
  WORK_ELIGIBILITY: "Work eligibility",
  EXPERIENCE: "Experience",
  EDUCATION: "Education",
};

const StatusBadge = ({ status }: { status: VerificationStatus }) => {
  if (status === "APPROVED") {
    return (
      <Badge variant="default" className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <BadgeCheck className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge variant="default" className="gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        <ShieldAlert className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
};

const displayName = (u: AdminVerification["user"]) =>
  u.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

const initials = (u: AdminVerification["user"]) => {
  const name = displayName(u);
  return name.slice(0, 2).toUpperCase();
};

export default function Verifications() {
  const [statusTab, setStatusTab] = useState<VerificationStatus | "ALL">("PENDING");
  const [typeFilter, setTypeFilter] = useState<VerificationType | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { invalidateVerifications } = useVerificationActions();
  const { data: listData, isLoading } = useVerificationsList({
    page,
    limit,
    status: statusTab,
    type: typeFilter,
  });

  const items = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = listData?.meta?.totalPages ?? 1;

  // Reject flow
  const [rejecting, setRejecting] = useState<AdminVerification | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  const handleApprove = async (v: AdminVerification) => {
    setActioningId(v.id);
    try {
      await reviewVerification(v.id, { status: "APPROVED" });
      toast.success(`Approved ${TYPE_LABEL[v.type].toLowerCase()} verification for ${displayName(v.user)}`);
      invalidateVerifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActioningId(null);
    }
  };

  const handleViewDocument = async (v: AdminVerification) => {
    setViewingDocId(v.id);
    try {
      const url = await getVerificationDocumentUrl(v.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    } finally {
      setViewingDocId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejecting) return;
    setActioningId(rejecting.id);
    try {
      await reviewVerification(rejecting.id, {
        status: "REJECTED",
        reviewerNote: rejectNote.trim() || undefined,
      });
      toast.success(`Rejected verification for ${displayName(rejecting.user)}`);
      setRejecting(null);
      setRejectNote("");
      invalidateVerifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            Verifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve identity, work eligibility, experience, and education requests.
          </p>
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => { setTypeFilter(v as VerificationType | "ALL"); setPage(1); }}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Status tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/40 w-fit">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setStatusTab(key); setPage(1); }}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all ${
              statusTab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead>Requester</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
                <TableHead className="hidden lg:table-cell">Document</TableHead>
                <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-muted animate-pulse rounded-full" />
                        <div className="space-y-1">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                          <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                    <TableCell><div className="h-8 w-24 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No {statusTab === "ALL" ? "" : statusTab.toLowerCase()} verification requests.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((v) => {
                  const busy = actioningId === v.id;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            {v.user.avatarUrl && <AvatarImage src={v.user.avatarUrl} alt={displayName(v.user)} />}
                            <AvatarFallback className="text-xs">{initials(v.user)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{displayName(v.user)}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">{TYPE_LABEL[v.type]}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[220px]">
                        <p className="text-sm text-muted-foreground truncate" title={v.note ?? undefined}>
                          {v.note || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {v.documentUrl ? (
                          <button
                            onClick={() => handleViewDocument(v)}
                            disabled={viewingDocId === v.id}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-60"
                          >
                            {viewingDocId === v.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            View
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell><StatusBadge status={v.status} /></TableCell>
                      <TableCell className="text-right">
                        {v.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="h-8 rounded-full bg-green-600 hover:bg-green-700 text-white gap-1"
                              disabled={busy}
                              onClick={() => handleApprove(v)}
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1"
                              disabled={busy}
                              onClick={() => { setRejecting(v); setRejectNote(""); }}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {v.reviewedAt
                              ? `Reviewed ${new Date(v.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <AdminPagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          label="requests"
        />
      </div>

      {/* Reject confirmation with reviewer note */}
      <AlertDialog open={!!rejecting} onOpenChange={(open) => { if (!open) { setRejecting(null); setRejectNote(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject verification</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting && (
                <>Rejecting the {TYPE_LABEL[rejecting.type].toLowerCase()} request for{" "}
                <span className="font-medium text-foreground">{displayName(rejecting.user)}</span>.
                Add a note explaining why — the requester will see it.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value.slice(0, 2000))}
            placeholder="Reason for rejection (optional but recommended)…"
            rows={4}
          />
          <AlertDialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setRejecting(null); setRejectNote(""); }}>
              Cancel
            </Button>
            <Button
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!!actioningId}
              onClick={handleConfirmReject}
            >
              Reject request
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
