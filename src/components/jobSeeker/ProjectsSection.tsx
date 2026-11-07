import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploadField } from "@/components/media/MediaUploadField";
import { ProjectList } from "@/components/jobSeeker/ProjectList";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { getMyMarketplaceRecords, marketplaceStatusLabel } from "@/lib/api/marketplace";
import {
  createProject,
  deleteProject,
  listMyProjects,
  MY_PROJECTS_KEY,
  updateProject,
  type OwnProject,
  type ProjectInput,
} from "@/lib/api/profileProjects";

/** The server's limits. */
const PROJECT_MAX_PICTURES = 8;
const MAX_SKILLS = 10;

interface Draft {
  title: string;
  description: string;
  startMonth: string;
  endMonth: string;
  current: boolean;
  skills: string;
  projectUrl: string;
  mediaUrls: string[];
  /** "none", "job:<id>" or "service:<id>". */
  where: string;
}

function toDraft(project: OwnProject | null): Draft {
  return {
    title: project?.title ?? "",
    description: project?.description ?? "",
    startMonth: project?.startMonth ?? "",
    endMonth: project?.endMonth ?? "",
    current: project?.current ?? false,
    skills: project?.skills.join(", ") ?? "",
    projectUrl: project?.projectUrl ?? "",
    mediaUrls: project?.mediaUrls ?? [],
    where: project?.experienceId ? `job:${project.experienceId}` : project?.serviceListingId ? `service:${project.serviceListingId}` : "none",
  };
}

function toInput(draft: Draft): ProjectInput {
  const [kind, id] = draft.where.split(":");
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    startMonth: draft.startMonth || null,
    endMonth: draft.current ? null : draft.endMonth || null,
    current: draft.current,
    skills: draft.skills.split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, MAX_SKILLS),
    projectUrl: draft.projectUrl.trim() || null,
    mediaUrls: draft.mediaUrls,
    experienceId: kind === "job" ? id : null,
    serviceListingId: kind === "service" ? id : null,
  };
}

/** The project editor: what it is, when, where, with what, and pictures of it. */
function ProjectDialog({ project, open, onOpenChange }: { project: OwnProject | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [draft, setDraft] = useState<Draft>(() => toDraft(project));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // Their own services, drafts too, as they offer them themselves: a company's aren't theirs to link.
  const services = useQuery({
    queryKey: ["marketplace", "service", "mine-for-projects", user?.id],
    queryFn: ({ signal }) => getMyMarketplaceRecords("service", 1, user!, signal),
    enabled: open && !!user?.id,
    staleTime: 60_000,
  });
  const serviceList = (services.data?.data ?? []).filter((service) => !service.company);
  const jobs = profile.experiences.filter((job) => job.serverId);
  // A linked service beyond the first page of their list still has to show as chosen.
  const linkedHidden = services.isSuccess && project?.serviceListingId && !serviceList.some((service) => service.id === project.serviceListingId)
    ? project.serviceListingId : null;

  const endBeforeStart = !draft.current && !!draft.startMonth && !!draft.endMonth && draft.endMonth < draft.startMonth;
  const tooManySkills = draft.skills.split(",").filter((skill) => skill.trim()).length > MAX_SKILLS;

  const done = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: MY_PROJECTS_KEY });
    toast.success(message);
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: () => (project ? updateProject(project.id, toInput(draft)) : createProject(toInput(draft))),
    onSuccess: () => done(project ? "Project saved" : "Project added"),
    onError: (error) => toast.error((error as Error).message),
  });
  const remove = useMutation({
    mutationFn: () => deleteProject(project!.id),
    onSuccess: () => done("Project deleted"),
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{project ? "Edit project" : "Add a project"}</DialogTitle>
            <DialogDescription>Something you made or worked on. It shows on your profile, and on your provider page if you have one.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="project-title">Name</Label>
              <Input id="project-title" value={draft.title} maxLength={120} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Livestock tracking system" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">What it was</Label>
              <Textarea id="project-description" rows={4} maxLength={2000} value={draft.description} onChange={(e) => update("description", e.target.value)} placeholder="The problem, what you did, and how it turned out." />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-start">Started</Label>
                <Input id="project-start" type="month" value={draft.startMonth} onChange={(e) => update("startMonth", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-end">Finished</Label>
                <Input id="project-end" type="month" value={draft.current ? "" : draft.endMonth} disabled={draft.current} onChange={(e) => update("endMonth", e.target.value)} aria-invalid={endBeforeStart} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="project-current" checked={draft.current} onCheckedChange={(checked) => update("current", checked === true)} />
              <Label htmlFor="project-current" className="font-normal">I'm still working on this</Label>
            </div>
            {endBeforeStart && <p className="text-xs text-destructive" role="alert">It can't finish before it started.</p>}

            <div className="space-y-1.5">
              <Label htmlFor="project-where">Done in</Label>
              <Select value={draft.where} onValueChange={(value) => update("where", value)}>
                <SelectTrigger id="project-where"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {jobs.map((job) => <SelectItem key={job.serverId} value={`job:${job.serverId}`}>{job.title} at {job.company}</SelectItem>)}
                  {serviceList.map((service) => (
                    <SelectItem key={service.id} value={`service:${service.id}`}>
                      Service: {service.title || "Untitled draft"}{service.status !== "published" ? ` (${marketplaceStatusLabel(service.status).toLowerCase()})` : ""}
                    </SelectItem>
                  ))}
                  {linkedHidden && (
                    <SelectItem value={`service:${linkedHidden}`}>
                      Service: {project?.associatedWith?.kind === "service" ? project.associatedWith.title : "one of yours"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">One of your jobs, or a service you offer. A linked service shows this project on its page while it's published.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-skills">Skills used</Label>
              <Input id="project-skills" value={draft.skills} onChange={(e) => update("skills", e.target.value)} placeholder="e.g. React, IoT, C++" aria-invalid={tooManySkills} />
              <p className={`text-xs ${tooManySkills ? "text-destructive" : "text-muted-foreground"}`}>Separate with commas. Up to {MAX_SKILLS}.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-link">Link</Label>
              <Input id="project-link" value={draft.projectUrl} maxLength={2048} onChange={(e) => update("projectUrl", e.target.value)} placeholder="e.g. github.com/you/project" />
            </div>

            <div className="space-y-1.5">
              <Label>Pictures and video</Label>
              <MediaUploadField value={draft.mediaUrls} onChange={(next) => update("mediaUrls", next)} maxPictures={PROJECT_MAX_PICTURES} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {project ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !draft.title.trim() || endBeforeStart || tooManySkills}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>It comes off your profile, your provider page and any service it was linked to.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Projects on your own profile: add, edit, and see them as visitors do. */
const ProjectsSection = () => {
  const projects = useQuery({ queryKey: MY_PROJECTS_KEY, queryFn: listMyProjects, staleTime: 60_000 });
  const [editing, setEditing] = useState<OwnProject | null>(null);
  const [open, setOpen] = useState(false);
  // A fresh editor each time it opens, so a cancelled edit leaves nothing behind.
  const [session, setSession] = useState(0);
  const list = projects.data ?? [];

  const openEditor = (project: OwnProject | null) => {
    setEditing(project);
    setSession((value) => value + 1);
    setOpen(true);
  };

  return (
    <section className="bg-card rounded-lg border border-border p-5" aria-labelledby="projects-heading">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="projects-heading" className="text-lg font-semibold text-foreground">Projects</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(null)} aria-label="Add a project">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {projects.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading projects…</p>}
      {projects.isError && (
        <p className="text-sm text-muted-foreground">
          Couldn't load your projects.{" "}
          <button type="button" onClick={() => void projects.refetch()} className="text-link hover:underline">Try again</button>
        </p>
      )}
      {projects.isSuccess && list.length === 0 && (
        <div className="py-6 text-center">
          <FolderKanban className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="mb-4 text-sm text-muted-foreground">Show what you've built: when, with which skills, with pictures and a short video.</p>
          <Button variant="outline" onClick={() => openEditor(null)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Add a project</Button>
        </div>
      )}
      {list.length > 0 && <ProjectList projects={list} onEdit={(project) => openEditor(project as OwnProject)} />}

      {open && <ProjectDialog key={session} project={editing} open={open} onOpenChange={setOpen} />}
    </section>
  );
};

export default ProjectsSection;
