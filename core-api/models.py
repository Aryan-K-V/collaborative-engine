from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    documents = relationship("DocumentMeta", back_populates="owner")

class DocumentMeta(Base):
    __tablename__ = "documents_meta"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="Ready for sync")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("User", back_populates="documents")