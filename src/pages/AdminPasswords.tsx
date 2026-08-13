import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, KeyRound, RotateCcw, Eye, EyeOff, Copy, Check, Lock, User as UserIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FMSAdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const roleLabels: Record<string, string> = {
  system_admin: 'System Admin',
  production_supervisor: 'Production Supervisor',
  production_operator: 'Production Operator',
  stores_operator: 'Stores Operator',
  dispatch_user: 'Dispatch User',
  qa_viewer: 'QA Viewer',
};

const roleOptions = Object.keys(roleLabels);

const AdminPasswords: React.FC = () => {
  const { user, fmsUser } = useFMSAuth();
  const isAdmin = fmsUser?.role === 'system_admin';

  const [users, setUsers] = useState<FMSAdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Set password dialog state
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FMSAdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset password dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUser, setResetUser] = useState<FMSAdminUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Add user dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('production_operator');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit user dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<FMSAdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editing, setEditing] = useState(false);

  // Delete user dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<FMSAdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const callFunction = async (payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Your session has expired. Please sign in again.');
      return null;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fms-admin-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }
    return result;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const result = await callFunction({ operation: 'list_users' });
      if (result) {
        setUsers(result.users || []);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toast.error(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const openSetDialog = (u: FMSAdminUser) => {
    if (u.user_id === user?.id) {
      toast.error('Use "Change Password" in your profile to change your own password.');
      return;
    }
    setSelectedUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSetDialogOpen(true);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser || !newPassword) {
      toast.error('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      await callFunction({
        operation: 'set_password',
        target_user_id: selectedUser.user_id,
        new_password: newPassword,
      });
      toast.success(`Password updated for ${selectedUser.name}.`);
      setSetDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Set password error:', err);
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  const openResetDialog = (u: FMSAdminUser) => {
    if (u.user_id === user?.id) {
      toast.error('Use "Forgot Password" or profile settings to reset your own password.');
      return;
    }
    setResetUser(u);
    setTempPassword(null);
    setCopied(false);
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;

    setResetting(true);

    try {
      const result = await callFunction({
        operation: 'reset_password',
        target_user_id: resetUser.user_id,
      });
      setTempPassword(result.temporary_password);
      toast.success('Password reset successfully.');
    } catch (err: any) {
      console.error('Reset password error:', err);
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const copyTempPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Temporary password copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
      toast.error('Failed to copy password.');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserEmail || !newUserName || !newUserPassword) {
      toast.error('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setAdding(true);

    try {
      await callFunction({
        operation: 'add_user',
        email: newUserEmail.toLowerCase(),
        name: newUserName,
        role: newUserRole,
        new_password: newUserPassword,
      });
      toast.success(`User ${newUserName} added successfully.`);
      setAddDialogOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('production_operator');
      setNewUserPassword('');
      fetchUsers();
    } catch (err: any) {
      console.error('Add user error:', err);
      toast.error(err.message || 'Failed to add user.');
    } finally {
      setAdding(false);
    }
  };

  const openEditDialog = (u: FMSAdminUser) => {
    setEditUser(u);
    setEditName(u.name);
    setEditRole(u.role || 'production_operator');
    setEditActive(u.is_active);
    setEditDialogOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editUser || !editName || !editRole) {
      toast.error('Please fill in all fields.');
      return;
    }

    setEditing(true);

    try {
      await callFunction({
        operation: 'update_user',
        target_user_id: editUser.user_id,
        name: editName,
        role: editRole,
        is_active: editActive,
      });
      toast.success(`User ${editName} updated successfully.`);
      setEditDialogOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Edit user error:', err);
      toast.error(err.message || 'Failed to update user.');
    } finally {
      setEditing(false);
    }
  };

  const openDeleteDialog = (u: FMSAdminUser) => {
    if (u.user_id === user?.id) {
      toast.error('You cannot delete your own account.');
      return;
    }
    setDeleteUser(u);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setDeleting(true);

    try {
      await callFunction({
        operation: 'delete_user',
        target_user_id: deleteUser.user_id,
      });
      toast.success(`User ${deleteUser.name} deleted successfully.`);
      setDeleteDialogOpen(false);
      setDeleteUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Delete user error:', err);
      toast.error(err.message || 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  // Guard: Only system admin can see this page - redirect everyone else away
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit, delete users and manage their passwords. Passwords are stored as secure hashes and cannot be
            viewed directly - you can set or reset them on behalf of users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-warning">Security Note</p>
          <p className="mt-1">
            Passwords are encrypted using one-way hashing, so existing passwords can never be retrieved or displayed.
            You can set a new password for a user or generate a temporary password that must be shared with the user securely.
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-border bg-card shadow-card">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium text-muted-foreground">User</th>
                  <th className="p-3 font-medium text-muted-foreground">Role</th>
                  <th className="p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email || 'No email on file'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {u.role ? (
                        <Badge variant="secondary">{roleLabels[u.role] || u.role}</Badge>
                      ) : (
                        <Badge variant="outline">No FMS Access</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={u.is_active ? 'default' : 'secondary'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(u)}
                          title="Edit user details"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSetDialog(u)}
                          disabled={!u.is_active}
                          title={u.user_id === user?.id ? 'Use profile settings for your own password' : 'Set a new password for this user'}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResetDialog(u)}
                          disabled={!u.is_active}
                          title={u.user_id === user?.id ? 'Use profile settings for your own password' : 'Generate a temporary password'}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(u)}
                          disabled={u.user_id === user?.id}
                          title={u.user_id === user?.id ? 'You cannot delete your own account' : 'Delete this user'}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No users found. Click "Add User" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with FMS access. The user can sign in immediately with the password you set.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name</Label>
              <Input
                id="add-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-role">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger id="add-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-password">Password</Label>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Initial password"
                  minLength={6}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for <strong className="text-foreground">{editUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="edit-active">Account Status</Label>
                <p className="text-xs text-muted-foreground">Deactivated users cannot sign in</p>
              </div>
              <input
                id="edit-active"
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!deleting) setDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong className="text-foreground">{deleteUser?.name}</strong> ({deleteUser?.email})
              from the system. They will no longer be able to sign in. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set Password Dialog */}
      <Dialog open={setDialogOpen} onOpenChange={setSetDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong className="text-foreground">{selectedUser?.name}</strong>.
              The user will need to sign in with this new password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={(open) => {
        if (!resetting) setResetDialogOpen(open);
      }}>
        <AlertDialogContent>
          {tempPassword ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Password Reset Successful</AlertDialogTitle>
                <AlertDialogDescription>
                  A temporary password has been generated for <strong className="text-foreground">{resetUser?.name}</strong>.
                  Copy and share this password securely. The user can change it after signing in.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <code className="break-all font-mono text-sm font-bold text-foreground">{tempPassword}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyTempPassword}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setResetDialogOpen(false)}>
                  Done
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Password</AlertDialogTitle>
                <AlertDialogDescription>
                  This will generate a temporary password for <strong className="text-foreground">{resetUser?.name}</strong>.
                  Their current password will no longer work. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleResetPassword();
                  }}
                  disabled={resetting}
                >
                  {resetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPasswords;