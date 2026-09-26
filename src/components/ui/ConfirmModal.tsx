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

export type ConfirmModalVariant = "suspend" | "delete" | "ban" | "flag";

interface ConfirmModalProps {
  open: boolean;
  variant: ConfirmModalVariant;
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const getModalContent = (variant: ConfirmModalVariant, targetName: string) => {
  switch (variant) {
    case "suspend":
      return {
        title: "Suspend User",
        description: `Are you sure you want to suspend "${targetName}"? This will temporarily disable their account.`,
        confirmText: "Suspend",
        confirmVariant: "destructive" as const,
      };
    case "delete":
      return {
        title: "Delete User",
        description: `Are you sure you want to permanently delete "${targetName}"? This action cannot be undone.`,
        confirmText: "Delete",
        confirmVariant: "destructive" as const,
      };
    case "ban":
      return {
        title: "Ban User",
        description: `Are you sure you want to ban "${targetName}"? This will permanently block their access.`,
        confirmText: "Ban",
        confirmVariant: "destructive" as const,
      };
    case "flag":
      return {
        title: "Flag User",
        description: `Flag "${targetName}" for review? This marks the account for the moderation team to look into.`,
        confirmText: "Flag",
        confirmVariant: "default" as const,
      };
    default:
      return {
        title: "Confirm Action",
        description: `Are you sure you want to proceed with this action on "${targetName}"?`,
        confirmText: "Confirm",
        confirmVariant: "default" as const,
      };
  }
};

export const ConfirmModal = ({
  open,
  variant,
  targetName,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const content = getModalContent(variant, targetName);

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{content.title}</AlertDialogTitle>
          <AlertDialogDescription>{content.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={content.confirmVariant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {content.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};