from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.orm import Session
from database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_by_id(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id, getattr(self.model, 'is_deleted', False) == False).first()

    def get_by_uid(self, db: Session, uid: str) -> Optional[ModelType]:
        uid_field = f"{self.model.__name__.lower()}_uid"
        if hasattr(self.model, uid_field):
            return db.query(self.model).filter(getattr(self.model, uid_field) == uid, getattr(self.model, 'is_deleted', False) == False).first()
        # Fallback if field name doesn't follow convention
        if hasattr(self.model, 'slot_uid'):
            return db.query(self.model).filter(self.model.slot_uid == uid, getattr(self.model, 'is_deleted', False) == False).first()
        return None

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        return db.query(self.model).filter(getattr(self.model, 'is_deleted', False) == False).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        obj_data = self.model(**obj_in)
        db.add(obj_data)
        db.commit()
        db.refresh(obj_data)
        return obj_data

    def update(self, db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def soft_delete(self, db: Session, id: Any) -> bool:
        obj = db.query(self.model).get(id)
        if obj and hasattr(obj, 'is_deleted'):
            obj.is_deleted = True
            db.commit()
            return True
        return False
