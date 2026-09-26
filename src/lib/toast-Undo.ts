import { toast } from "sonner";

export const toastWithUndo = (message: string, undoAction: () => void) => {
  toast(message, {
    action: {
      label: "Undo",
      onClick: undoAction,
    },
  });
};