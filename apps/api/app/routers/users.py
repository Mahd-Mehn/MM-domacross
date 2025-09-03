from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.database import User as UserModel
from app.schemas.user import User, UserCreate
from app.deps.auth import get_current_user

router = APIRouter()

@router.post("/users", response_model=User)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = UserModel(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/users/{wallet_address}", response_model=User)
async def get_user(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
