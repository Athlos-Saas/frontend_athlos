import { supabase } from '@/lib/supabase';
import type { OrgUserRole } from '@/lib/backendApi';

export interface PermissionSettingRow {
  permission_key: string;
  role: OrgUserRole;
  allowed: boolean;
}

export interface NavAccessSettingRow {
  nav_key: string;
  role: OrgUserRole;
  allowed: boolean;
}

export async function fetchPermissionSettings(orgId: string): Promise<PermissionSettingRow[]> {
  const { data, error } = await supabase
    .from('permission_settings')
    .select('permission_key, role, allowed')
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertPermissionSetting(
  orgId: string,
  permissionKey: string,
  role: OrgUserRole,
  allowed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('permission_settings')
    .upsert(
      { org_id: orgId, permission_key: permissionKey, role, allowed, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,permission_key,role' },
    );
  if (error) throw new Error(error.message);
}

export async function fetchNavAccessSettings(orgId: string): Promise<NavAccessSettingRow[]> {
  const { data, error } = await supabase
    .from('nav_access_settings')
    .select('nav_key, role, allowed')
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertNavAccessSetting(
  orgId: string,
  navKey: string,
  role: OrgUserRole,
  allowed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('nav_access_settings')
    .upsert(
      { org_id: orgId, nav_key: navKey, role, allowed, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,nav_key,role' },
    );
  if (error) throw new Error(error.message);
}
