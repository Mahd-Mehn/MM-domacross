from typing import Callable, Optional, List, TYPE_CHECKING
import json, asyncio
if TYPE_CHECKING:
    from fastapi import WebSocket

websocket_connections: List["WebSocket"] = []  # active websocket connections
connection_filters: dict[int, set[str]] = {}    # id(ws) -> allowed event types

def set_connection_filter(ws: "WebSocket", events: list[str] | None):
    if events:
        connection_filters[id(ws)] = set(events)
    else:
        connection_filters.pop(id(ws), None)

async def broadcast_event(payload: dict):
    etype = payload.get("type")
    dead = []
    data = json.dumps(payload)
    for ws in list(websocket_connections):
        try:
            filt = connection_filters.get(id(ws))
            if etype and filt and etype not in filt:
                continue
            await ws.send_text(data)
        except Exception:
            dead.append(ws)
    for d in dead:
        try:
            websocket_connections.remove(d)
            connection_filters.pop(id(d), None)
        except ValueError:
            pass

def get_sync_broadcast() -> Optional[Callable[[dict], None]]:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return None
    def sync_send(payload: dict):
        try:
            # If loop is running (e.g. inside FastAPI lifespan), schedule task.
            if loop.is_running():
                loop.create_task(broadcast_event(payload))
            else:  # execute immediately (test / sync context)
                loop.run_until_complete(broadcast_event(payload))
        except Exception:
            pass
    return sync_send

__all__ = [
    'websocket_connections', 'set_connection_filter', 'broadcast_event', 'get_sync_broadcast'
]
