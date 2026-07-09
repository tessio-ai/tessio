// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser, importUsers, type UserRow, type ImportUserInput } from '../../api/users';
import { listTeams, createTeam, renameTeam, updateTeam, deleteTeam, type UpdateTeamInput } from '../../api/teams';
import { getOrg, updateOrg } from '../../api/org';
import { getPortalSettings, updatePortalSettings, type UpdatePortalSettingsInput } from '../../api/portal';
import { listTeamMembers, addTeamMember, removeTeamMember } from '../../api/team-members';
import { listTeamSchemas, addTeamSchema, removeTeamSchema } from '../../api/team-schemas';
import { getAiSettings, updateAiSettings, testAiSettings, type UpdateAiSettingsInput } from '../../api/ai';
import { listSecrets, createSecret, replaceSecret, deleteSecret } from '../../api/secrets';
import { getEmailSettings, putEmailSettings, testSmtp, type UpdateEmailSettingsInput } from '../../api/email';
import { getSlackSettings, putSlackSettings, testSlack, type UpdateSlackSettingsInput } from '../../api/slack';
import { getNotificationPrefs, putNotificationPrefs, type NotificationPrefs } from '../../api/notifications';
import { getSlaSettings, putSlaSettings, type UpdateSlaSettingsInput } from '../../api/sla';
import { getCsatSettings, putCsatSettings, type UpdateCsatSettingsInput } from '../../api/csat';
import { getEntitlements } from '../../api/entitlements';

export const useOrg = () => useQuery({ queryKey: ['org'], queryFn: getOrg });
export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name: string }) => updateOrg(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org'] }),
  });
}

export const usePortalSettings = () => useQuery({ queryKey: ['portal-settings'], queryFn: getPortalSettings });
export function useUpdatePortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdatePortalSettingsInput) => updatePortalSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-settings'] }),
  });
}

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: listUsers });
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; name: string; role: UserRow['role']; password: string }) => createUser(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useImportUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (users: ImportUserInput[]) => importUsers(users),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; role?: UserRow['role']; status?: UserRow['status'] }) => updateUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export const useTeams = () => useQuery({ queryKey: ['teams'], queryFn: listTeams });
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
export function useRenameTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTeam(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTeamInput }) => updateTeam(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export const useTeamMembers = (teamId: string) =>
  useQuery({ queryKey: ['team-members', teamId], queryFn: () => listTeamMembers(teamId), enabled: !!teamId });

export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addTeamMember(teamId, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-members', teamId] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
}

export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-members', teamId] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
}

export const useTeamSchemas = (teamId: string) =>
  useQuery({ queryKey: ['team-schemas', teamId], queryFn: () => listTeamSchemas(teamId), enabled: !!teamId });

export function useAddTeamSchema(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schemaId: string) => addTeamSchema(teamId, schemaId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-schemas', teamId] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
}

export function useRemoveTeamSchema(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schemaId: string) => removeTeamSchema(teamId, schemaId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-schemas', teamId] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
}

export const useAiSettings = () => useQuery({ queryKey: ['ai-settings'], queryFn: getAiSettings });

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateAiSettingsInput) => updateAiSettings(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-settings'] });
      // The assistant's name/icon render across the whole app — refresh them too.
      void qc.invalidateQueries({ queryKey: ['bot-identity'] });
    },
  });
}

export function useTestAiSettings() {
  return useMutation({ mutationFn: () => testAiSettings() });
}

export const useEmailSettings = () => useQuery({ queryKey: ['email-settings'], queryFn: getEmailSettings });

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateEmailSettingsInput) => putEmailSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-settings'] }),
  });
}

export function useTestSmtp() {
  return useMutation({ mutationFn: () => testSmtp() });
}

export const useSlackSettings = () => useQuery({ queryKey: ['slack-settings'], queryFn: getSlackSettings });

export function useUpdateSlackSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateSlackSettingsInput) => putSlackSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slack-settings'] }),
  });
}

export function useTestSlack() {
  return useMutation({ mutationFn: () => testSlack() });
}

export const useNotificationPrefs = () => useQuery({ queryKey: ['notification-prefs'], queryFn: getNotificationPrefs });

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => putNotificationPrefs(prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
}

export const useSlaSettings = () => useQuery({ queryKey: ['sla-settings'], queryFn: getSlaSettings });

export function useUpdateSlaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSlaSettingsInput) => putSlaSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sla-settings'] }),
  });
}

export const useCsatSettings = () => useQuery({ queryKey: ['csat-settings'], queryFn: getCsatSettings });

export function useUpdateCsatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCsatSettingsInput) => putCsatSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csat-settings'] }),
  });
}

// SSO settings live in the commercial ee/web package; the hooks moved with them.
// Edition/feature entitlements (used to gate enterprise UI) are core:
export const useEntitlements = () => useQuery({ queryKey: ['entitlements'], queryFn: getEntitlements });

export const useSecrets = () => useQuery({ queryKey: ['secrets'], queryFn: listSecrets });

export function useCreateSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => createSecret(name, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['secrets'] }),
  });
}

export function useReplaceSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) => replaceSecret(name, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['secrets'] }),
  });
}

export function useDeleteSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteSecret(name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['secrets'] }),
  });
}
