import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, authHeader } from '../api';

export interface IncentiveScheduleSummary {
  id: number; name: string; start_time: string; end_time: string; epoch_duration_minutes: number; base_emission_per_epoch: string;
}

export function useIncentiveSchedules() {
  return useQuery({
    queryKey: ['incentive-schedules'],
    queryFn: () => apiJson<any[]>('/api/v1/incentives/schedules', { headers: authHeader() })
  });
}

export function useIncentiveSchedule(scheduleId?: number | string) {
  return useQuery({
    queryKey: ['incentive-schedule', scheduleId],
    enabled: !!scheduleId,
    queryFn: () => apiJson<any>(`/api/v1/incentives/schedules/${scheduleId}`, { headers: authHeader() })
  });
}

export function useCurrentIncentiveEpoch(scheduleId?: number | string) {
  return useQuery({
    queryKey: ['incentive-schedule-current', scheduleId],
    enabled: !!scheduleId,
    refetchInterval: 60_000,
    queryFn: () => apiJson<any>(`/api/v1/incentives/schedules/${scheduleId}/current`, { headers: authHeader() })
  });
}

export function useEpochPoints(scheduleId?: number | string, epochIndex?: number) {
  return useQuery({
    queryKey: ['incentive-epoch-points', scheduleId, epochIndex],
    enabled: scheduleId !== undefined && epochIndex !== undefined,
    queryFn: () => apiJson<any>(`/api/v1/incentives/schedules/${scheduleId}/epochs/${epochIndex}/points`, { headers: authHeader() })
  });
}

export function useFinalizeIncentiveEpoch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { scheduleId: number; epochIndex: number }) => {
      return apiJson(`/api/v1/incentives/schedules/${p.scheduleId}/epochs/${p.epochIndex}/finalize`, { method: 'POST', headers: authHeader() });
    },
    onSuccess: (_d, p) => {
      qc.invalidateQueries({ queryKey: ['incentive-schedule', p.scheduleId] });
      qc.invalidateQueries({ queryKey: ['incentive-schedule-current', p.scheduleId] });
      qc.invalidateQueries({ queryKey: ['incentive-epoch-points', p.scheduleId, p.epochIndex] });
    }
  });
}
