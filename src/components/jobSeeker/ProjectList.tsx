import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Calendar, ExternalLink, Pencil, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/marketplace/ListingGallery";
import { projectPeriod, type PublicProject } from "@/lib/api/profileProjects";

/** Longer than this, a description starts folded. */
const FOLD_AT = 280;

function ProjectItem({ project, onEdit, currentServiceId }: {
  project: PublicProject;
  onEdit?: (project: PublicProject) => void;
  currentServiceId?: string;
}) {
  const [unfolded, setUnfolded] = useState(false);
  const period = projectPeriod(project);
  const where = project.associatedWith;
  const long = project.description.length > FOLD_AT;

  return (
    <li className="space-y-2 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-foreground">{project.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {period && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{period}</span>}
            {where?.kind === "job" && (
              <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{where.title} at {where.company}</span>
            )}
            {/* Not on that service's own page, where it would only point back. */}
            {where?.kind === "service" && where.id !== currentServiceId && (
              <Link to={`/services/${where.id}?source=profile`} className="inline-flex items-center gap-1 text-link hover:underline">
                <Store className="h-3.5 w-3.5" aria-hidden="true" />{where.title}
              </Link>
            )}
          </div>
        </div>
        {onEdit && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onEdit(project)} aria-label={`Edit ${project.title}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {project.description && (
        <div>
          <p className={`whitespace-pre-line break-words text-sm leading-6 text-muted-foreground ${long && !unfolded ? "line-clamp-3" : ""}`}>{project.description}</p>
          {long && (
            <button type="button" onClick={() => setUnfolded((value) => !value)} className="mt-1 text-xs font-medium text-link hover:underline">
              {unfolded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {project.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.skills.map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>)}
        </div>
      )}

      <MediaGallery mediaUrls={project.mediaUrls} compact />

      {project.link && (
        <a href={project.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View project<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

/**
 * Projects, as the person described them: on their profile, their provider
 * page and the service a project was done as. `onEdit` is for the owner's
 * own page.
 */
export function ProjectList({ projects, onEdit, currentServiceId }: {
  projects: PublicProject[];
  onEdit?: (project: PublicProject) => void;
  /** On a service's page: its id, so its projects don't link back to it. */
  currentServiceId?: string;
}) {
  return (
    <ul>
      {projects.map((project) => <ProjectItem key={project.id} project={project} onEdit={onEdit} currentServiceId={currentServiceId} />)}
    </ul>
  );
}

export default ProjectList;
