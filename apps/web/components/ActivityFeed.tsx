"use client";
import { useEventFeed } from '../lib/events/store';

function format(ev: any){
  switch(ev.type){
    case 'listing_created': return `Listing ${ev.domain} @ ${ev.price}`;
    case 'listing_filled': return `Filled ${ev.domain} @ ${ev.price}`;
    case 'listing_cancelled': return `Cancelled listing ${ev.domain}`;
    case 'offer_created': return `Offer ${ev.price} on ${ev.domain}`;
    case 'offer_accepted': return `Offer accepted ${ev.domain}`;
    case 'offer_cancelled': return `Offer cancelled ${ev.domain}`;
  case 'valuation_update': return `Valuation ${ev.domain} => ${ev.value}${ev.change_pct?` (${ev.change_pct>0?'+':''}${ev.change_pct.toFixed(2)}%)`:''}`;
  case 'leaderboard_delta': return `Leaderboard delta ${ev.address || ev.user || ''} ${ev.delta || ev.score || ''}`;
    default: return ev.type;
  }
}

export function ActivityFeed(){
  const events = useEventFeed(25);
  return (
    <div className="text-xs space-y-2 max-h-80 overflow-auto pr-1">
      {events.length===0 && <div className="text-slate-500 py-6 text-center">No events yet.</div>}
      {events.map((e,i)=>(
        <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-200/40 dark:border-slate-700/40 pb-1 last:border-none">
          <span className="truncate text-slate-700 dark:text-slate-300">{format(e)}</span>
          {e.seq && <span className="text-[10px] text-slate-400">#{e.seq}</span>}
        </div>
      ))}
    </div>
  );
}
