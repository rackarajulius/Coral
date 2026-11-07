import { create } from "zustand";
import {
  readViewingAs,
  rememberViewingAs,
  viewingAs,
  type CommunityView,
} from "@/components/community/shell/viewingAs";
import { useAuth } from "@/contexts/AuthContext";
import { onAfterSignOut } from "@/lib/signOutHooks";

interface ChosenViews {
  chosen: Record<string, CommunityView>;
  choose: (userId: string, view: CommunityView) => void;
}

/**
 * The switch is in the top bar and the nav follows it, so the choice is held
 * outside both. Only what was chosen this visit: what's stored is read below.
 */
const useChosenViews = create<ChosenViews>((set) => ({
  chosen: {},
  choose: (userId, view) => {
    rememberViewingAs(userId, view);
    set((state) => ({ chosen: { ...state.chosen, [userId]: view } }));
  },
}));

onAfterSignOut(() => useChosenViews.setState({ chosen: {} }));

/**
 * Which side of the community the signed-in person is looking from; null for
 * a visitor. `canSwitch` follows the provider area: an employer or admin
 * account can't open it, so a Freelancer view would be nothing but dead ends.
 */
export function useViewingAs() {
  const { user } = useAuth();
  const choose = useChosenViews((state) => state.choose);
  const chosen = useChosenViews((state) => (user ? state.chosen[user.id] : undefined));
  const canSwitch = user?.role === "JOB_SEEKER" || user?.role === "FREELANCER";
  const view: CommunityView | null = user
    ? viewingAs(chosen ?? readViewingAs(user.id), { canOfferServices: canSwitch, hasCompany: !!user.company })
    : null;

  return {
    view,
    canSwitch,
    choose: (next: CommunityView) => {
      if (user) choose(user.id, next);
    },
  };
}
