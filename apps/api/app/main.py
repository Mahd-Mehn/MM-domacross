from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, auth, competitions, users, portfolio
import logging
from typing import List
import asyncio
from app.services.blockchain_service import blockchain_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DomaCross API", version="0.1.0")

# WebSocket connections
websocket_connections: List[WebSocket] = []

# Basic CORS for local dev web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(competitions.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        websocket_connections.remove(websocket)

@app.get("/")
def root():
    logger.info("Root endpoint accessed")
    return {"service": "domacross-api", "status": "ok"}
