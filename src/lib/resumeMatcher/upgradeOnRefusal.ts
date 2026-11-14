import { isEntitlementError } from "@/lib/api/entitlementError";
import type { UpgradePrompt } from "@/stores/upgradePromptStore";

/**
 * The limit can be reached between loading the page and pressing the button;
 * a refusal then closes the dialog and explains, rather than showing an error.
 */
export function upgradeOnRefusal(error: Error, onClose: () => void, showUpgrade: (prompt: UpgradePrompt) => void) {
  if (!isEntitlementError(error)) return;
  onClose();
  showUpgrade({ code: error.code, metric: error.metric, tier: error.tier, resetsAt: error.resetsAt, message: error.message });
}
