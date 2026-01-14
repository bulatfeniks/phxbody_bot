from __future__ import annotations

from sqlalchemy import Column, Date, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WorkoutDay(Base):
    __tablename__ = "workout_days"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    scenario_type = Column(String(32), nullable=False)
    blocks = Column(Text, nullable=False)
    comment = Column(Text, default="", nullable=False)


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    scenario_type = Column(String(32), nullable=False)
    blocks = Column(Text, nullable=False)
