from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .db import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PHXBody Log")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def authorize_user(x_telegram_user_id: str | None = Header(default=None)) -> None:
    allowed_user_id = os.getenv("ALLOWED_TELEGRAM_USER_ID")
    if not allowed_user_id:
        return
    if not x_telegram_user_id or x_telegram_user_id != allowed_user_id:
        raise HTTPException(status_code=403, detail="Доступ запрещён")


@app.get("/")
async def index() -> Response:
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    return Response(content=html, media_type="text/html")


@app.get("/api/workout-days", response_model=list[schemas.WorkoutDayOut])
async def list_workouts(
    limit: int = 14,
    db: Session = Depends(get_db),
    _: None = Depends(authorize_user),
):
    return crud.list_workout_days(db, limit)


@app.get("/api/workout-days/{day_id}", response_model=schemas.WorkoutDayOut)
async def get_workout(day_id: int, db: Session = Depends(get_db), _: None = Depends(authorize_user)):
    workout = crud.get_workout_day(db, day_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Не найдено")
    return workout


@app.post("/api/workout-days", response_model=schemas.WorkoutDayOut)
async def create_workout(
    payload: schemas.WorkoutDayCreate,
    db: Session = Depends(get_db),
    _: None = Depends(authorize_user),
):
    return crud.create_workout_day(db, payload)


@app.put("/api/workout-days/{day_id}", response_model=schemas.WorkoutDayOut)
async def update_workout(
    day_id: int,
    payload: schemas.WorkoutDayUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(authorize_user),
):
    workout = crud.update_workout_day(db, day_id, payload)
    if not workout:
        raise HTTPException(status_code=404, detail="Не найдено")
    return workout


@app.delete("/api/workout-days/{day_id}")
async def delete_workout(day_id: int, db: Session = Depends(get_db), _: None = Depends(authorize_user)):
    if not crud.delete_workout_day(db, day_id):
        raise HTTPException(status_code=404, detail="Не найдено")
    return {"status": "ok"}


@app.get("/api/templates", response_model=list[schemas.TemplateOut])
async def list_templates(db: Session = Depends(get_db), _: None = Depends(authorize_user)):
    return crud.list_templates(db)


@app.post("/api/templates", response_model=schemas.TemplateOut)
async def create_template(
    payload: schemas.TemplateCreate,
    db: Session = Depends(get_db),
    _: None = Depends(authorize_user),
):
    return crud.create_template(db, payload)


@app.get("/api/search", response_model=list[schemas.WorkoutDayOut])
async def search(query: str, db: Session = Depends(get_db), _: None = Depends(authorize_user)):
    return crud.search_workouts(db, query)


@app.get("/api/analytics", response_model=schemas.AnalyticsOut)
async def analytics(days: int = 14, db: Session = Depends(get_db), _: None = Depends(authorize_user)):
    return crud.get_analytics(db, days)


@app.post("/api/telegram/theme")
async def update_theme(payload: dict, _: None = Depends(authorize_user)):
    (STATIC_DIR / "theme.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return {"status": "ok"}
