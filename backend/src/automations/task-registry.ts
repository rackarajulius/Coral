import { ScheduledTaskType, TaskCadence } from '@prisma/client';

/**
 * What each task is, and what it defaults to.
 *
 * The template gallery renders from this list, so the UI cannot offer a task
 * nothing implements — the same reason the role matrix is generated from the
 * enforced capability map rather than a copy kept in the frontend.
 */
export interface TaskDefinition {
  type: ScheduledTaskType;
  label: string;
  description: string;
  /** lucide icon name; the client maps it to a component. */
  icon: string;
  defaults: { cadence: TaskCadence; hourLocal: number; weekday: number | null };
  /** Where the notification should take you. */
  link: string;
  /**
   * Several may run at once, each watching a different thing. The singleton
   * kinds answer one question about the whole company; this one is per-search.
   */
  allowMultiple?: boolean;
  /** What must be chosen before the task can exist. */
  requiresTarget?: 'shortlist';
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    type: ScheduledTaskType.STALE_APPLICATIONS,
    label: 'Applications waiting too long',
    description:
      'Tells you when someone has been waiting more than a week for a reply. Being left without an answer is what candidates remember.',
    icon: 'Inbox',
    defaults: { cadence: TaskCadence.WEEKDAYS, hourLocal: 9, weekday: null },
    link: '/employers/candidates',
  },
  {
    type: ScheduledTaskType.INTERVIEWS_WITHOUT_OUTCOME,
    label: 'Interviews with no outcome',
    description:
      'Flags interviews that happened but were never marked up, so a candidate is not left in limbo and your pipeline stays honest.',
    icon: 'ClipboardCheck',
    defaults: { cadence: TaskCadence.WEEKLY, hourLocal: 16, weekday: 5 },
    link: '/employers/candidates',
  },
  {
    type: ScheduledTaskType.WEEKLY_SUMMARY,
    label: 'Weekly hiring summary',
    description:
      'A Friday round-up of what happened this week: jobs posted, applications received, interviews held.',
    icon: 'BarChart3',
    defaults: { cadence: TaskCadence.WEEKLY, hourLocal: 16, weekday: 5 },
    link: '/employers/analytics',
  },
  {
    type: ScheduledTaskType.SAVED_SEARCH_MATCHES,
    label: 'New matches for a saved search',
    description:
      'Re-runs one of your saved searches and tells you when someone new turns up. Only counts candidates who have opted in to being found.',
    icon: 'UserSearch',
    defaults: { cadence: TaskCadence.WEEKLY, hourLocal: 9, weekday: 1 },
    link: '/employers/hiring',
    allowMultiple: true,
    requiresTarget: 'shortlist',
  },
];

export function definitionFor(type: ScheduledTaskType): TaskDefinition {
  const found = TASK_DEFINITIONS.find((d) => d.type === type);
  if (!found) throw new Error(`No definition for scheduled task type ${type}`);
  return found;
}
