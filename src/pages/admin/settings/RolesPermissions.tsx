import { useState, useMemo } from "react";
import { RolesTable } from "@/components/adminDashboard/settings/roles/RolesTable";
import { RoleEditor } from "@/components/adminDashboard/settings/roles/RoleEditor";
import { Role, mockRoles } from "@/data/admin/roles/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

export default function RolesPermissions() {
 
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [roles, search]);

  const handleSelect = (role: Role) => {
    setSelectedRole({ ...role, assignedUsers: [...role.assignedUsers], permissions: [...role.permissions] });
    setEditorOpen(true);
  };

  const handleCreateNew = () => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      name: "New Role",
      description: "",
      permissions: [],
      assignedUsers: [],
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    setSelectedRole(newRole);
    setEditorOpen(true);
  };

  const handleDuplicate = (role: Role) => {
    const dup: Role = {
      ...role,
      id: crypto.randomUUID(),
      name: `${role.name} (Copy)`,
      assignedUsers: [],
      permissions: [...role.permissions],
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    setRoles((prev) => [...prev, dup]);
    toast({ title: "Role duplicated", description: `"${dup.name}" has been created.` });
  };

  const handleSave = (updated: Role) => {
    setRoles((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      if (exists) return prev.map((r) => (r.id === updated.id ? { ...updated, lastUpdated: new Date().toISOString().split("T")[0] } : r));
      return [...prev, { ...updated, lastUpdated: new Date().toISOString().split("T")[0] }];
    });
    setEditorOpen(false);
    setSelectedRole(null);
  };

  const handleDelete = (id: string) => {
    const name = roles.find((r) => r.id === id)?.name;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Role deleted", description: `"${name}" has been removed.` });
  };

  const handleTableDeleteConfirm = () => {
    if (!deleteId) return;
    handleDelete(deleteId);
    setDeleteId(null);
  };

  return (
    <>
      <div className="space-y-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Roles & Permissions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage admin access and permissions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64  border-border"
              />
            </div>
            <Button size="sm" variant="default" onClick={handleCreateNew} className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </div>
        </div>

         <Separator className="mb-6" />

        <RolesTable
          roles={filtered}
          onSelect={handleSelect}
          onDuplicate={handleDuplicate}
          onDelete={(id) => setDeleteId(id)}
        />
      </div>

      <RoleEditor
        role={selectedRole}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The role will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTableDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
