/**
 * The browser tab the community lives in.
 *
 * The main site's nav opens the community here rather than in the tab you
 * were using, so the job search you were in stays where you left it. A name
 * rather than "_blank" means a second click goes back to the community tab
 * that is already open instead of piling up new ones.
 *
 * Same origin, so no `rel="noopener"`: there is no other site to protect the
 * opener from, and leaving the opener in place is what lets the name be
 * found again.
 */
export const COMMUNITY_TAB = "coral-community";

/**
 * Names the current tab as the community's.
 *
 * For a tab that arrived some other way (a bookmark, a shared link, a
 * notification), so the main site's next "Community" click lands here too.
 */
export function claimCommunityTab() {
  try {
    if (window.name !== COMMUNITY_TAB) window.name = COMMUNITY_TAB;
  } catch {
    // A sandboxed frame can refuse; the tab simply stays unnamed.
  }
}
