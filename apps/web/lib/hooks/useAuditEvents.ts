import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiJson, authHeader } from '../api';
import { AuditEventsPage, CompetitionSettlementEvent } from '../types/audit';

interface UseAuditEventsParams {
  entityType: string;
  entityId: number | string;
  eventTypes: string[]; // list of event type names
  limit?: number;
  enabled?: boolean;
}

export function useAuditEvents<TPayload = any>({ entityType, entityId, eventTypes, limit = 25, enabled = true }: UseAuditEventsParams) {
  const [cursor, setCursor] = useState<number | null>(null);
  const typesParam = encodeURIComponent(eventTypes.join(','));

  const query = useQuery<AuditEventsPage<TPayload>>({
    queryKey: ['audit-events', entityType, entityId, eventTypes.join(','), limit, cursor],
    enabled: enabled && !!entityId,
    queryFn: async () => {
      const cursorParam = cursor ? `&cursor_after_id=${cursor}` : '';
      return apiJson<AuditEventsPage<TPayload>>(`/api/v1/settlement/audit-events?entity_type=${entityType}&entity_id=${entityId}&event_type=${typesParam}&limit=${limit}${cursorParam}`, { headers: authHeader() });
    }
  });

  const loadMore = useCallback(() => {
    if (!query.data || !query.data.data.length) return;
    if (query.data.next_cursor) {
      setCursor(query.data.next_cursor);
    }
  }, [query.data]);

  const reset = useCallback(() => setCursor(null), []);

  return {
    events: (query.data?.data || []) as CompetitionSettlementEvent[],
    nextCursor: query.data?.next_cursor,
    isLoading: query.isFetching && !query.data,
    isFetching: query.isFetching,
    loadMore,
    reset,
    hasMore: !!query.data?.next_cursor,
  };
}
