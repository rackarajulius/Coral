import { useState, useEffect, useMemo } from "react";
import { Role, permissionGroups, allUsers } from "@/data/admin/roles/roles";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, X, UserPlus, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

interface Props {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (role: Role) => void;
  onDelete: (id: string) => void;
}

export function RoleEditor({ role, open, onOpenChange, onSave, onDelete }: Props) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Role | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  useEffect(() => {
    if (role) {
      setDraft(JSON.parse(JSON.stringify(role)));
      setDirty(false);
    }
  }, [role]);

  const availableUsers = useMemo(() => {
    if (!draft) return [];
    const assignedIds = new Set(draft.assignedUsers.map((u) => u.id));
    return allUsers.filter((u) => !assignedIds.has(u.id));
  }, [draft]);

  if (!draft) return null;

  const update = (partial: Partial<Role>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const togglePermission = (perm: string) => {
    const has = draft.permissions.includes(perm);
    update({
      permissions: has
        ? draft.permissions.filter((p) => p !== perm)
        : [...draft.permissions, perm],
    });
  };

  const toggleGroup = (group: typeof permissionGroups[number]) => {
    const allChecked = group.permissions.every((p) => draft.permissions.includes(p));
    if (allChecked) {
      update({ permissions: draft.permissions.filter((p) => !group.permissions.includes(p)) });
    } else {
      const merged = new Set([...draft.permissions, ...group.permissions]);
      update({ permissions: Array.from(merged) });
    }
  };

  const addUser = (user: { id: string; name: string; email: string }) => {
    update({ assignedUsers: [...draft.assignedUsers, user] });
    setUserSearchOpen(false);
  };

  const removeUser = (userId: string) => {
    update({ assignedUsers: draft.assignedUsers.filter((u) => u.id !== userId) });
  };

  const handleSave = () => {
    onSave(draft);
    setDirty(false);
    toast({ title: "Role saved", description: `"${draft.name}" has been updated.` });
  };

  const handleClose = (openState: boolean) => {
    if (!openState && dirty) {
      setConfirmExit(true);
      return;
    }
    onOpenChange(openState);
  };

  const handleDeleteConfirm = () => {
    onDelete(draft.id);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetTitle className="sr-only">Edit Role</SheetTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="space-y-1 min-w-0 flex-1">
              <Input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Role name"
              />
              <Input
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                className="text-sm text-muted-foreground border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Description"
              />
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button variant="default" onClick={handleSave} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-6">

              {/* Permissions Matrix */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Permissions</h3>
                <div className="space-y-3">
                  {permissionGroups.map((group) => {
                    const allChecked = group.permissions.every((p) => draft.permissions.includes(p));
                    const someChecked = group.permissions.some((p) => draft.permissions.includes(p));
                    return (
                      <div key={group.group} className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allChecked ? true : someChecked ? "indeterminate" : false}
                            onCheckedChange={() => toggleGroup(group)}
                            id={`group-${group.group}`}
                          />
                          <Label htmlFor={`group-${group.group}`} className="text-sm font-medium cursor-pointer">
                            {group.group}
                          </Label>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {group.permissions.filter((p) => draft.permissions.includes(p)).length}/{group.permissions.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          {group.permissions.map((perm) => (
                            <div key={perm} className="flex items-center gap-2">
                              <Checkbox
                                checked={draft.permissions.includes(perm)}
                                onCheckedChange={() => togglePermission(perm)}
                                id={`perm-${perm}`}
                              />
                              <Label htmlFor={`perm-${perm}`} className="text-xs text-muted-foreground cursor-pointer font-normal">
                                {perm}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Assigned Users */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Assigned Users</h3>
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <UserPlus className="h-3.5 w-3.5" />
                        Add User
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-64" align="end">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {availableUsers.map((user) => (
                              <CommandItem key={user.id} onSelect={() => addUser(user)}>
                                <div>
                                  <p className="text-sm font-medium">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {draft.assignedUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">No users assigned to this role.</p>
                )}

                <div className="space-y-1.5">
                  {draft.assignedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeUser(user.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Footer actions */}
              <div className="flex items-center justify-between">
                <Button onClick={() => navigate("/admin/audit-logs")} variant="default" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Audit Log
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Role
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirm exit */}
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmExit(false); setDirty(false); onOpenChange(false); }}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{draft.name}" and unassign all users. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
