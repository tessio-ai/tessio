// SPDX-License-Identifier: AGPL-3.0-only

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryDevices, getDevice, linkDevice, unlinkDevice, deleteDevice, type DeviceQuery } from '../../api/devices';
import { listEnrollmentKeys, createEnrollmentKey, revokeEnrollmentKey } from '../../api/agent-keys';

export const useDevices = (q: DeviceQuery, opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: ['devices', q], queryFn: () => queryDevices(q), enabled: opts?.enabled ?? true });

export const useDevice = (id: string | null) =>
  useQuery({ queryKey: ['device', id], queryFn: () => getDevice(id as string), enabled: !!id });

export function useLinkDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => linkDevice(id, assetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device', id] }); qc.invalidateQueries({ queryKey: ['devices'] }); },
  });
}

export function useUnlinkDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlinkDevice(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device', id] }); qc.invalidateQueries({ queryKey: ['devices'] }); },
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteDevice(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }) });
}

export const useEnrollmentKeys = () => useQuery({ queryKey: ['enrollment-keys'], queryFn: listEnrollmentKeys });

export function useCreateEnrollmentKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (label?: string) => createEnrollmentKey(label), onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment-keys'] }) });
}

export function useRevokeEnrollmentKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => revokeEnrollmentKey(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment-keys'] }) });
}
