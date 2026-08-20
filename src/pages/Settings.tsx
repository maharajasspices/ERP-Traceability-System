import React, { useState, useEffect } from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Settings as SettingsIcon, Users, Bell, Database, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SystemSettings {
  lot_prefix: string;
  batch_prefix: string;
  retention_days: number;
  expiry_warning_days: number;
  require_coa: boolean;
  auto_lot_numbering: boolean;
  company_name: string;
  company_address: string;
  print_logo_url: string;
}

const defaultSettings: SystemSettings = {
  lot_prefix: 'LOT',
  batch_prefix: 'PB',
  retention_days: 365,
  expiry_warning_days: 30,
  require_coa: true,
  auto_lot_numbering: true,
  company_name: '',
  company_address: '',
  print_logo_url: '',
};

// Roles a non-admin (production supervisor) is allowed to assign
const LIMITED_ROLES = ['production_operator', 'stores_operator', 'dispatch_user'] as const;

const Settings: React.FC = () => {
  const { isAdmin, fmsUser, user } = useFMSAuth();
  const isSupervisor = fmsUser?.role === 'production_supervisor';
  const canEdit = isAdmin || isSupervisor;

  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('production_operator');
  const [fmsUsers, setFmsUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    if (canEdit) {
      fetchUsers();
      fetchInvitations();
    }
  }, [canEdit]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('fms_settings').select('*');
      if (data && data.length > 0) {
        const map: Record<string, any> = {};
        data.forEach((item: any) => { map[item.setting_key] = item.setting_value; });
        setSettings(prev => ({ ...prev, ...map }));
      }
    } catch (error) { console.error(error); }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('fms_users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('[Settings] Failed to fetch users:', error.message);
      toast.error('Failed to load users: ' + error.message);
      return;
    }
    if (data) setFmsUsers(data);
  };

  const fetchInvitations = async () => {
    const { data, error } = await (supabase as any)
      .from('fms_user_invitations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Settings] Failed to fetch invitations:', error.message);
      return;
    }
    if (data) setInvitations(data);
  };

  const saveSettings = async () => {
    if (!canEdit) { toast.error('Insufficient permissions'); return; }
    setLoading(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from('fms_settings').upsert({
          setting_key: key,
          setting_value: value,
          updated_by: user?.id,
        }, { onConflict: 'setting_key' });
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const availableRoles = isAdmin
    ? ['system_admin', 'production_supervisor', 'production_operator', 'stores_operator', 'dispatch_user']
    : [...LIMITED_ROLES];

  const roleLabel = (r: string) => ({
    system_admin: 'System Admin',
    production_supervisor: 'Production Supervisor',
    production_operator: 'Production Operator',
    stores_operator: 'Stores Operator',
    dispatch_user: 'Dispatch User',
  } as Record<string, string>)[r] || r;

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) { toast.error('Please enter email and name'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) { toast.error('Please enter a valid email address'); return; }
    if (!isAdmin && !LIMITED_ROLES.includes(newUserRole as any)) {
      toast.error('You can only assign Operator, Stores, or Dispatch roles');
      return;
    }
    try {
      const { data: existing } = await (supabase as any)
        .from('fms_user_invitations')
        .select('id, status')
        .eq('email', newUserEmail.toLowerCase())
        .maybeSingle();
      if (existing && existing.status === 'pending') {
        toast.error('An invitation has already been sent to this email');
        return;
      }
      const { error } = await (supabase as any)
        .from('fms_user_invitations')
        .upsert({
          email: newUserEmail.toLowerCase(),
          name: newUserName,
          role: newUserRole,
          invited_by: user?.id,
          status: 'pending',
        }, { onConflict: 'email' });
      if (error) throw error;
      toast.success(`Invitation created for ${newUserName}`);
      setUserDialogOpen(false);
      setNewUserEmail(''); setNewUserName(''); setNewUserRole('production_operator');
      fetchUsers(); fetchInvitations();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to create invitation');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!isAdmin && !LIMITED_ROLES.includes(newRole as any)) {
      toast.error('You can only assign Operator, Stores, or Dispatch roles'); return;
    }
    try {
      const { error } = await supabase.from('fms_users').update({ role: newRole as any }).eq('id', userId);
      if (error) throw error;
      toast.success('User role updated'); fetchUsers();
    } catch (error) { console.error(error); toast.error('Failed to update user role'); }
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('fms_users').update({ is_active: !isActive }).eq('id', userId);
      if (error) throw error;
      toast.success(`User ${isActive ? 'deactivated' : 'activated'}`); fetchUsers();
    } catch (error) { console.error(error); toast.error('Failed to update user status'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <p className="text-muted-foreground">System configuration and preferences</p>

      {!canEdit && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-warning">
            Elevated access required to modify settings. You are logged in as:{' '}
            <strong className="capitalize">{fmsUser?.role?.replace('_', ' ')}</strong>
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Management */}
        <div className="module-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">User Management</h3>
              <p className="text-sm text-muted-foreground">Manage roles & permissions</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {isAdmin
              ? 'Configure all user roles.'
              : 'Add and manage Production Operator, Stores Operator, and Dispatch User accounts.'}
          </p>
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="mt-4" disabled={!canEdit}>
                {canEdit ? 'Manage Users' : 'No Access'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>User Management</DialogTitle></DialogHeader>

              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Add New User</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableRoles.map(r => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddUser}>Add User</Button>
                    </div>
                  </div>
                </div>

                {invitations.filter(i => i.status === 'pending').length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <h4 className="font-medium p-3 bg-muted/50">Pending Invitations</h4>
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Role</th>
                          <th className="p-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.filter(i => i.status === 'pending').map((inv) => (
                          <tr key={inv.id} className="border-t">
                            <td className="p-2">{inv.email}</td>
                            <td className="p-2">{inv.name}</td>
                            <td className="p-2 capitalize">{inv.role?.replace('_', ' ')}</td>
                            <td className="p-2">
                              <span className="px-2 py-1 rounded text-xs bg-warning/20 text-warning">Pending Signup</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <h4 className="font-medium p-3 bg-muted/50">Active Users</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Role</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fmsUsers.map((u) => {
                        const canEditThisUser = isAdmin || LIMITED_ROLES.includes(u.role);
                        return (
                          <tr key={u.id} className="border-t">
                            <td className="p-2">{u.name}</td>
                            <td className="p-2">
                              {canEditThisUser ? (
                                <Select value={u.role} onValueChange={(val) => handleUpdateUserRole(u.id, val)}>
                                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {availableRoles.map(r => (
                                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="capitalize text-sm">{roleLabel(u.role)}</span>
                              )}
                            </td>
                            <td className="p-2">
                              <span className={u.is_active ? 'badge-active' : 'badge-inactive'}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-2">
                              {canEditThisUser && (
                                <Button variant="ghost" size="sm" onClick={() => handleToggleUserActive(u.id, u.is_active)}>
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {fmsUsers.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* System Settings */}
        <div className="module-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">System Settings</h3>
              <p className="text-sm text-muted-foreground">Configure defaults</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Lot Number Prefix</Label>
                <Input value={settings.lot_prefix} onChange={(e) => setSettings(p => ({ ...p, lot_prefix: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Batch Number Prefix</Label>
                <Input value={settings.batch_prefix} onChange={(e) => setSettings(p => ({ ...p, batch_prefix: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Retention Sample Days</Label>
                <Input type="number" value={settings.retention_days} onChange={(e) => setSettings(p => ({ ...p, retention_days: parseInt(e.target.value) || 365 }))} disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Warning Days</Label>
                <Input type="number" value={settings.expiry_warning_days} onChange={(e) => setSettings(p => ({ ...p, expiry_warning_days: parseInt(e.target.value) || 30 }))} disabled={!canEdit} />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label>Require COA/COC on Receipt</Label>
              <Switch checked={settings.require_coa} onCheckedChange={(c) => setSettings(p => ({ ...p, require_coa: c }))} disabled={!canEdit} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label>Auto Lot Numbering</Label>
              <Switch checked={settings.auto_lot_numbering} onCheckedChange={(c) => setSettings(p => ({ ...p, auto_lot_numbering: c }))} disabled={!canEdit} />
            </div>

            <Button onClick={saveSettings} disabled={!canEdit || loading} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Company Information */}
        <div className="module-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Database className="h-5 w-5 text-info" />
            </div>
            <div>
              <h3 className="font-semibold">Company Information</h3>
              <p className="text-sm text-muted-foreground">Business details</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={settings.company_name} onChange={(e) => setSettings(p => ({ ...p, company_name: e.target.value }))} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={settings.company_address} onChange={(e) => setSettings(p => ({ ...p, company_address: e.target.value }))} disabled={!canEdit} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Print Logo URL</Label>
              <div className="flex gap-2 items-center">
                <Input value={settings.print_logo_url} onChange={(e) => setSettings(p => ({ ...p, print_logo_url: e.target.value }))} disabled={!canEdit} placeholder="/images/print-logo.png" />
                {settings.print_logo_url && (
                  <img src={settings.print_logo_url} alt="Logo preview" className="h-10 w-10 object-contain border rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Logo shown on printed batch sheets and documents</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="module-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">Alert settings</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Configure alerts for low stock, expiring materials, and production milestones.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label>Low Stock Alerts</Label>
              <Switch defaultChecked disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label>Expiry Warnings</Label>
              <Switch defaultChecked disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label>Production Milestones</Label>
              <Switch defaultChecked disabled={!canEdit} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
