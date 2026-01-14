from __future__ import annotations

import datetime as dt
import json
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas


def _blocks_to_json(blocks: Iterable[schemas.Block]) -> str:
    return json.dumps([block.model_dump() for block in blocks], ensure_ascii=False)


def _blocks_from_json(raw: str) -> list[schemas.Block]:
    data = json.loads(raw) if raw else []
    return [schemas.Block(**item) for item in data]


def list_workout_days(db: Session, limit: int = 14) -> list[schemas.WorkoutDayOut]:
    rows = db.execute(select(models.WorkoutDay).order_by(models.WorkoutDay.date.desc()).limit(limit)).scalars()
    return [
        schemas.WorkoutDayOut(
            id=row.id,
            date=row.date,
            scenario_type=row.scenario_type,
            blocks=_blocks_from_json(row.blocks),
            comment=row.comment,
        )
        for row in rows
    ]


def get_workout_day(db: Session, day_id: int) -> schemas.WorkoutDayOut | None:
    row = db.get(models.WorkoutDay, day_id)
    if not row:
        return None
    return schemas.WorkoutDayOut(
        id=row.id,
        date=row.date,
        scenario_type=row.scenario_type,
        blocks=_blocks_from_json(row.blocks),
        comment=row.comment,
    )


def create_workout_day(db: Session, payload: schemas.WorkoutDayCreate) -> schemas.WorkoutDayOut:
    row = models.WorkoutDay(
        date=payload.date,
        scenario_type=payload.scenario_type,
        blocks=_blocks_to_json(payload.blocks),
        comment=payload.comment,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return get_workout_day(db, row.id)


def update_workout_day(db: Session, day_id: int, payload: schemas.WorkoutDayUpdate) -> schemas.WorkoutDayOut | None:
    row = db.get(models.WorkoutDay, day_id)
    if not row:
        return None
    if payload.scenario_type is not None:
        row.scenario_type = payload.scenario_type
    if payload.blocks is not None:
        row.blocks = _blocks_to_json(payload.blocks)
    if payload.comment is not None:
        row.comment = payload.comment
    db.commit()
    db.refresh(row)
    return get_workout_day(db, row.id)


def delete_workout_day(db: Session, day_id: int) -> bool:
    row = db.get(models.WorkoutDay, day_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def list_templates(db: Session) -> list[schemas.TemplateOut]:
    rows = db.execute(select(models.Template).order_by(models.Template.id.desc())).scalars()
    return [
        schemas.TemplateOut(
            id=row.id,
            name=row.name,
            scenario_type=row.scenario_type,
            blocks=_blocks_from_json(row.blocks),
        )
        for row in rows
    ]


def create_template(db: Session, payload: schemas.TemplateCreate) -> schemas.TemplateOut:
    row = models.Template(
        name=payload.name,
        scenario_type=payload.scenario_type,
        blocks=_blocks_to_json(payload.blocks),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.TemplateOut(
        id=row.id,
        name=row.name,
        scenario_type=row.scenario_type,
        blocks=_blocks_from_json(row.blocks),
    )


def search_workouts(db: Session, query: str) -> list[schemas.WorkoutDayOut]:
    rows = db.execute(
        select(models.WorkoutDay)
        .where(models.WorkoutDay.blocks.ilike(f"%{query}%"))
        .order_by(models.WorkoutDay.date.desc())
        .limit(50)
    ).scalars()
    return [
        schemas.WorkoutDayOut(
            id=row.id,
            date=row.date,
            scenario_type=row.scenario_type,
            blocks=_blocks_from_json(row.blocks),
            comment=row.comment,
        )
        for row in rows
    ]


def get_analytics(db: Session, days: int) -> schemas.AnalyticsOut:
    since = dt.date.today() - dt.timedelta(days=days - 1)
    rows = db.execute(select(models.WorkoutDay).where(models.WorkoutDay.date >= since)).scalars().all()
    training_days = len(rows)
    steps_values: list[int] = []
    last_weights: dict[str, float | None] = {"присед": None, "становая": None, "жим стоя": None}

    def _extract_steps(blocks: list[schemas.Block]) -> None:
        for block in blocks:
            if block.type == "activity" and "steps" in block.data:
                try:
                    steps_values.append(int(block.data.get("steps") or 0))
                except (TypeError, ValueError):
                    continue

    def _extract_last_weights(blocks: list[schemas.Block]) -> None:
        for block in blocks:
            if block.type != "strength":
                continue
            exercise = (block.data.get("exercise") or "").lower()
            sets = block.data.get("sets") or []
            for key in last_weights:
                if key in exercise:
                    for entry in sets:
                        weight = entry.get("weight")
                        if weight is None:
                            continue
                        try:
                            last_weights[key] = float(weight)
                        except (TypeError, ValueError):
                            continue

    for row in rows:
        blocks = _blocks_from_json(row.blocks)
        _extract_steps(blocks)
        _extract_last_weights(blocks)

    avg_steps = int(sum(steps_values) / len(steps_values)) if steps_values else None
    return schemas.AnalyticsOut(
        days=days,
        training_days=training_days,
        avg_steps=avg_steps,
        last_working_weights=last_weights,
    )
