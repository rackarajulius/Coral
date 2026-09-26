import { Role } from "@/data/admin/roles/roles";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Copy, Trash2 } from "lucide-react";

interface Props {
  roles: Role[];
  onSelect: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onDelete: (id: string) => void;
}

export function RolesTable({ roles, onSelect, onDuplicate, onDelete }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Role Name</TableHead>
            <TableHead className="font-semibold">Users Assigned</TableHead>
            <TableHead className="font-semibold">Permissions Count</TableHead>
            <TableHead className="font-semibold">Last Updated</TableHead>
            <TableHead className="font-semibold w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow
              key={role.id}
              className="cursor-pointer transition-colors hover:bg-orange-100"
              onClick={() => onSelect(role)}
            >
              <TableCell>
                <div>
                  <span className="font-medium">{role.name}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs font-normal">
                  {role.assignedUsers.length} {role.assignedUsers.length === 1 ? "user" : "users"}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{role.permissions.length}</span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {role.lastUpdated}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => onDuplicate(role)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(role.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                No roles found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
