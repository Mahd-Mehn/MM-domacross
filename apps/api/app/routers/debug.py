from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.services.doma_subgraph_service import doma_subgraph_service
from app.services.orderbook_snapshot_service import orderbook_snapshot_service

router = APIRouter()

@router.get("/debug/domain-data", tags=["Debug"])
async def get_domain_debug_data(domain_name: str, db: Session = Depends(get_db)):
    """
    Provides a consolidated debug view of a domain's data from various sources.
    """
    subgraph_details = None
    orderbook_data = None
    error_log = {}

    try:
        subgraph_details = await doma_subgraph_service.get_domain_details(domain_name)
    except Exception as e:
        error_log['subgraph_details'] = str(e)

    try:
        orderbook_data = await orderbook_snapshot_service.fetch_orderbook(domain_name)
    except Exception as e:
        error_log['orderbook_data'] = str(e)

    if not subgraph_details and not orderbook_data:
        raise HTTPException(status_code=404, detail="No data found for this domain.")

    return {
        "domain": domain_name,
        "subgraph_details": subgraph_details,
        "orderbook_data": orderbook_data,
        "errors": error_log
    }
