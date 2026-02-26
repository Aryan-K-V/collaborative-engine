from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
import database
import models

# Initialize FastAPI and create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Collab Engine Core API")

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/users/", status_code=status.HTTP_201_CREATED)
def create_user(username: str, db: Session = Depends(get_db)):
    # In a real app, hash passwords and handle schemas via Pydantic
    db_user = models.User(username=username)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/documents/")
def create_document_metadata(title: str, owner_id: int, db: Session = Depends(get_db)):
    """Creates ACID-compliant metadata before handing off live editing to Mongo/WS"""
    db_doc = models.DocumentMeta(title=title, owner_id=owner_id)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return {"doc_id": db_doc.id, "title": db_doc.title, "status": "Ready for sync"}