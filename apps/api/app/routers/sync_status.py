"""
Sync Status API - Provides information about background sync schedules
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from typing import Dict, Any

router = APIRouter(tags=["Sync Status"])

# Track last sync times (in production, this would be in Redis or database)
last_sync_times: Dict[str, datetime] = {}

@router.get("/sync/status")
async def get_sync_status() -> Dict[str, Any]:
    """
    Get current sync status and schedule information
    Returns when the next sync will occur for each service
    """
    now = datetime.now(timezone.utc)
    sync_interval_hours = 6  # 4 times per day
    
    return {
        "sync_schedule": {
            "frequency": "4 times per day",
            "interval_hours": sync_interval_hours,
            "sync_times": ["00:00 UTC", "06:00 UTC", "12:00 UTC", "18:00 UTC"]
        },
        "services": {
            "fractional_tokens": {
                "name": "Fractional Tokens Sync",
                "description": "Syncs domain tokens from Doma Subgraph",
                "interval_hours": sync_interval_hours,
                "last_sync": last_sync_times.get("fractional_tokens"),
                "status": "active"
            },
            "doma_rank_oracle": {
                "name": "DomaRank Valuations",
                "description": "Updates AI-powered domain valuations",
                "interval_hours": sync_interval_hours,
                "last_sync": last_sync_times.get("doma_rank"),
                "status": "active"
            },
            "orderbook_snapshots": {
                "name": "Orderbook Snapshots",
                "description": "Captures marketplace orderbook state",
                "interval_hours": sync_interval_hours,
                "last_sync": last_sync_times.get("orderbook"),
                "status": "active"
            },
            "nav_calculations": {
                "name": "NAV Calculations",
                "description": "Portfolio net asset value updates",
                "interval_hours": sync_interval_hours,
                "last_sync": last_sync_times.get("nav"),
                "status": "active"
            }
        },
        "next_sync_estimate": {
            "hours_remaining": sync_interval_hours - (now.hour % sync_interval_hours),
            "next_sync_time": f"{((now.hour // sync_interval_hours) + 1) * sync_interval_hours:02d}:00 UTC"
        },
        "info": {
            "message": "Data syncs automatically 4 times daily to optimize performance and reduce API costs",
            "manual_sync_available": True,
            "manual_sync_endpoint": "/api/v1/doma/fractional/sync"
        }
    }

@router.post("/sync/trigger/{service}")
async def trigger_manual_sync(service: str) -> Dict[str, Any]:
    """
    Trigger a manual sync for a specific service (admin only in production)
    """
    valid_services = ["fractional_tokens", "doma_rank", "orderbook", "nav"]
    
    if service not in valid_services:
        return {
            "success": False,
            "error": f"Invalid service. Must be one of: {', '.join(valid_services)}"
        }
    
    # In production, this would trigger the actual sync
    # For now, just update the last sync time
    last_sync_times[service] = datetime.now(timezone.utc)
    
    return {
        "success": True,
        "service": service,
        "message": f"Manual sync triggered for {service}",
        "triggered_at": last_sync_times[service].isoformat()
    }
