"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface DisputeBannerProps {
	apiBase?: string; // e.g. http://localhost:8000
	domain: string;
	className?: string;
}

type DisputeState = {
	status: 'none' | 'open' | 'quorum' | 'resolved' | 'rejected';
	disputeId?: number;
	votes?: number;
	threshold?: number;
	finalStatus?: string;
};

export const DisputeBanner: React.FC<DisputeBannerProps> = ({ apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000', domain, className }) => {
	const wsUrl = useMemo(() => apiBase.replace(/^http/, 'ws') + '/ws', [apiBase]);
	const { events, subscribe, connected } = useWebSocket(wsUrl, { events: ['dispute_quorum','dispute_resolved'] });
	const [state, setState] = useState<DisputeState>({ status: 'none' });

	useEffect(() => {
		// Only subscribe once when WebSocket is connected
		if (connected) {
			subscribe(['dispute_quorum','dispute_resolved']);
		}
	}, [connected]); // Remove subscribe from dependencies to avoid re-subscription

	useEffect(() => {
		const relevant = events.filter(e => e.domain === domain && (e.type === 'dispute_quorum' || e.type === 'dispute_resolved'));
		if (!relevant.length) return;
		const latest = relevant[relevant.length - 1];
		if (latest.type === 'dispute_quorum') {
			setState({ status: 'quorum', disputeId: latest.dispute_id, votes: latest.votes, threshold: latest.threshold });
		} else if (latest.type === 'dispute_resolved') {
			setState({ status: 'resolved', disputeId: latest.dispute_id, finalStatus: latest.final_status });
		}
	}, [events, domain]);

	if (state.status === 'none') return null;

	let bg = 'bg-yellow-100 text-yellow-800 border-yellow-300';
	let text = '';
	if (state.status === 'quorum') {
		text = `Valuation dispute reached quorum for ${domain} (votes ${state.votes}/${state.threshold}). Valuations clamped until resolution.`;
	} else if (state.status === 'resolved') {
		const fin = state.finalStatus?.toLowerCase();
		if (fin === 'resolved') {
			bg = 'bg-green-100 text-green-800 border-green-300';
			text = `Dispute resolved for ${domain}. Valuations will resume normal updates.`;
		} else if (fin === 'rejected') {
			bg = 'bg-red-100 text-red-800 border-red-300';
			text = `Dispute rejected for ${domain}.`;
		} else {
			bg = 'bg-gray-100 text-gray-800 border-gray-300';
			text = `Dispute closed for ${domain}.`;
		}
	}

	return (
		<div className={`border rounded px-3 py-2 text-sm font-medium flex items-center gap-2 shadow-sm ${bg} ${className || ''}`}> 
			<span>⚠️</span>
			<span>{text}</span>
		</div>
	);
};

export default DisputeBanner;
