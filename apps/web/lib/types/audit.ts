export interface BaseAuditEvent<T = any> {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: number;
  payload?: T;
  created_at?: string;
}

// Competition settlement submit payload
export interface CompetitionSettlementSubmitPayload {
  tx_hash: string;
  total_amount?: string | null;
  distribution?: { address: string; amount: string }[];
  distribution_count?: number;
}

// Competition settlement verified payload
export interface CompetitionSettlementVerifiedPayload {
  tx_hash: string;
  block?: number;
  total_amount?: string | null;
  distribution?: { address: string; amount: string }[];
  reward_rows_marked?: number;
}

export type CompetitionSettlementEvent =
  | BaseAuditEvent<CompetitionSettlementSubmitPayload>
  | BaseAuditEvent<CompetitionSettlementVerifiedPayload>;

export interface AuditEventsPage<T = any> {
  data: BaseAuditEvent<T>[];
  next_cursor?: number | null;
  limit: number;
}
