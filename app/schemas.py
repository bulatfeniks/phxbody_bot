from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import BaseModel, Field


class Block(BaseModel):
    type: str
    data: dict[str, Any] = Field(default_factory=dict)


class WorkoutDayBase(BaseModel):
    date: dt.date
    scenario_type: str
    blocks: list[Block]
    comment: str = ""


class WorkoutDayCreate(WorkoutDayBase):
    pass


class WorkoutDayUpdate(BaseModel):
    scenario_type: str | None = None
    blocks: list[Block] | None = None
    comment: str | None = None


class WorkoutDayOut(WorkoutDayBase):
    id: int


class TemplateBase(BaseModel):
    name: str
    scenario_type: str
    blocks: list[Block]


class TemplateCreate(TemplateBase):
    pass


class TemplateOut(TemplateBase):
    id: int


class AnalyticsOut(BaseModel):
    days: int
    training_days: int
    avg_steps: int | None = None
    last_working_weights: dict[str, float | None]
