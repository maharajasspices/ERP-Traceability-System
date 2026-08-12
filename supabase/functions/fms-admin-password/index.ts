import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS allowlist
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (requestOrigin) {
    if (envOrigins.includes(requestOrigin)) return requestOrigin;
    if (
      requestOrigin.startsWith('http://localhost:') ||
      requestOrigin.startsWith('https://localhost:')
    ) {
      return requestOrigin;
    }
  }

  if (envOrigins.length === 1) return envOrigins[0];

  return '';
};

const createCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = createCorsHeaders(requestOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller with their JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client with service role for privileged operations (bypasses RLS)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is a system_admin (via service role, bypassing RLS)
    const { data: fmsUser, error: fmsError } = await adminClient
      .from('fms_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fmsError || !fmsUser || fmsUser.role !== 'system_admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - system admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { operation, target_user_id, new_password, email, name, role, is_active } = body;

    // List FMS users (only users in fms_users, joined with auth.users for email)
    if (operation === 'list_users') {
      // Use adminClient to bypass RLS (fms_has_role execution is revoked from authenticated)
      const { data: fmsUsers, error: fmsListError } = await adminClient
        .from('fms_users')
        .select('id, user_id, name, role, is_active, created_at, updated_at')
        .order('name', { ascending: true });

      if (fmsListError) {
        console.error('[fms-admin-password] List fms users error:', fmsListError);
        return new Response(
          JSON.stringify({ error: fmsListError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get emails from auth.users for each FMS user
      const { data: authUsers, error: authListError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (authListError) {
        console.error('[fms-admin-password] List auth users error:', authListError);
        return new Response(
          JSON.stringify({ error: authListError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const emailMap = new Map((authUsers.users || []).map((au: any) => [au.id, au.email]));

      const mergedUsers = (fmsUsers || []).map((fu: any) => ({
        id: fu.id,
        user_id: fu.user_id,
        name: fu.name,
        email: emailMap.get(fu.user_id) || '',
        role: fu.role,
        is_active: fu.is_active,
        created_at: fu.created_at,
        updated_at: fu.updated_at,
      }));

      return new Response(
        JSON.stringify({ success: true, users: mergedUsers }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add a new FMS user (create auth user + fms_users entry)
    if (operation === 'add_user') {
      if (!email || !name || !role) {
        return new Response(
          JSON.stringify({ error: 'email, name, and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!new_password || new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the auth user
      const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: new_password,
        email_confirm: true,
      });

      if (createError) {
        console.error('[fms-admin-password] Create user error:', createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add to fms_users (via adminClient to bypass RLS)
      const { error: fmsInsertError } = await adminClient
        .from('fms_users')
        .insert({
          user_id: newAuthUser.user.id,
          name,
          role,
          is_active: true,
        });

      if (fmsInsertError) {
        console.error('[fms-admin-password] Add fms user error:', fmsInsertError);
        // Rollback: delete the auth user if fms_users insert fails
        await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
        return new Response(
          JSON.stringify({ error: fmsInsertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log (via adminClient to bypass RLS)
      await adminClient.from('fms_audit_log').insert({
        user_id: user.id,
        action: 'admin_add_user',
        entity_type: 'fms_users',
        entity_id: newAuthUser.user.id,
        old_values: null,
        new_values: { email, name, role },
      });

      console.log(`[fms-admin-password] Admin ${user.email} added user ${email} with role ${role}`);
      return new Response(
        JSON.stringify({ success: true, message: 'User added successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'target_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update an FMS user (name, role, is_active)
    if (operation === 'update_user') {
      if (!name || !role) {
        return new Response(
          JSON.stringify({ error: 'name and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent admin from editing their own role/status
      if (target_user_id === user.id && (role !== 'system_admin' || is_active === false)) {
        return new Response(
          JSON.stringify({ error: 'You cannot change your own role or deactivate yourself' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update via adminClient to bypass RLS
      const { error: updateError } = await adminClient
        .from('fms_users')
        .update({
          name,
          role,
          is_active: is_active ?? true,
        })
        .eq('user_id', target_user_id);

      if (updateError) {
        console.error('[fms-admin-password] Update fms user error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log
      await adminClient.from('fms_audit_log').insert({
        user_id: user.id,
        action: 'admin_update_user',
        entity_type: 'fms_users',
        entity_id: target_user_id,
        old_values: null,
        new_values: { name, role, is_active: is_active ?? true },
      });

      console.log(`[fms-admin-password] Admin ${user.email} updated user ${target_user_id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'User updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete an FMS user (remove from fms_users + auth.users)
    if (operation === 'delete_user') {
      // Prevent admin from deleting themselves
      if (target_user_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'You cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete from fms_users first (via adminClient to bypass RLS)
      const { error: fmsDeleteError } = await adminClient
        .from('fms_users')
        .delete()
        .eq('user_id', target_user_id);

      if (fmsDeleteError) {
        console.error('[fms-admin-password] Delete fms user error:', fmsDeleteError);
        return new Response(
          JSON.stringify({ error: fmsDeleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete from auth.users
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target_user_id);

      if (authDeleteError) {
        console.error('[fms-admin-password] Delete auth user error:', authDeleteError);
        return new Response(
          JSON.stringify({ error: authDeleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log
      await adminClient.from('fms_audit_log').insert({
        user_id: user.id,
        action: 'admin_delete_user',
        entity_type: 'fms_users',
        entity_id: target_user_id,
        old_values: null,
        new_values: { action: 'user_deleted' },
      });

      console.log(`[fms-admin-password] Admin ${user.email} deleted user ${target_user_id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'reset_password') {
      const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '!Aa1';

      const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, {
        password: tempPassword,
      });

      if (updateError) {
        console.error('[fms-admin-password] Reset password error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Audit log without storing the password
      await adminClient.from('fms_audit_log').insert({
        user_id: user.id,
        action: 'admin_reset_password',
        entity_type: 'fms_users',
        entity_id: target_user_id,
        old_values: null,
        new_values: { action: 'password_reset_forced' },
      });

      console.log(`[fms-admin-password] Admin ${user.email} reset password for user ${target_user_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Password reset successfully',
          temporary_password: tempPassword,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (operation === 'set_password') {
      if (!new_password || new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'New password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (target_user_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'Use your profile settings to change your own password' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, {
        password: new_password,
      });

      if (updateError) {
        console.error('[fms-admin-password] Set password error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await adminClient.from('fms_audit_log').insert({
        user_id: user.id,
        action: 'admin_set_password',
        entity_type: 'fms_users',
        entity_id: target_user_id,
        old_values: null,
        new_values: { action: 'password_changed_by_admin' },
      });

      console.log(`[fms-admin-password] Admin ${user.email} set new password for user ${target_user_id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation. Use: list_users, add_user, update_user, delete_user, reset_password, or set_password' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fms-admin-password] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});