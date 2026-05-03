from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime, timezone
import httpx
import os
import json
import csv
import io
import xml.etree.ElementTree as ET
import asyncio

app = FastAPI(title="Weather Intelligence API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://frontend:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.10:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ENV
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
MAPS_API_KEY = os.getenv("MAPS_API_KEY", "")

WEATHER_BASE = "https://api.openweathermap.org/data/2.5"
GEO_BASE = "https://api.openweathermap.org/geo/1.0"

# MongoDB
_db = None
def get_collection():
    global _db
    if _db is None:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI)
        _db = client["weather_app"]["weather_requests"]
    return _db


# ===========================
# MODELS
# ===========================
class WeatherRequest(BaseModel):
    location: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None

    @validator("start_date", "end_date", pre=True, always=True)
    def validate_dates(cls, v):
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("Date must be YYYY-MM-DD format")
        return v

    @validator("end_date")
    def validate_range(cls, v, values):
        start = values.get("start_date")
        if start and v and v < start:
            raise ValueError("end_date must be after start_date")
        return v


class WeatherUpdate(BaseModel):
    location: Optional[str] = None
    notes: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


def serialize_doc(doc):
    doc["_id"] = str(doc["_id"])
    return doc


# ===========================
# HELPERS
# ===========================
async def geocode_location(location: str):
    async with httpx.AsyncClient() as c:
        cleaned = location.replace("-", "").replace(" ", "")

        # ZIP code
        if cleaned.isdigit():
            r = await c.get(f"{GEO_BASE}/zip", params={"zip": location, "appid": WEATHER_API_KEY})
            if r.status_code == 200:
                d = r.json()
                return d["lat"], d["lon"], d.get("name", location), d.get("country", "")

        # Coordinates
        if "," in location:
            parts = location.split(",")
            if len(parts) == 2:
                try:
                    lat, lon = float(parts[0].strip()), float(parts[1].strip())
                    return lat, lon, f"{lat:.4f},{lon:.4f}", ""
                except ValueError:
                    pass

        # City name
        r = await c.get(f"{GEO_BASE}/direct", params={"q": location, "limit": 1, "appid": WEATHER_API_KEY})
        if r.status_code == 200 and r.json():
            d = r.json()[0]
            return d["lat"], d["lon"], d.get("name", location), d.get("country", "")

    raise HTTPException(status_code=404, detail=f"Location '{location}' not found.")


async def fetch_current(lat, lon):
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{WEATHER_BASE}/weather",
                        params={"lat": lat, "lon": lon, "appid": WEATHER_API_KEY, "units": "metric"})
        r.raise_for_status()
        return r.json()


async def fetch_forecast(lat, lon):
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{WEATHER_BASE}/forecast",
                        params={"lat": lat, "lon": lon, "appid": WEATHER_API_KEY, "units": "metric"})
        r.raise_for_status()
        return r.json()


async def fetch_youtube(city: str):
    if not YOUTUBE_API_KEY:
        return []

    async with httpx.AsyncClient(timeout=5.0) as c:  # Add timeout
        try:
            r = await c.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "q": f"{city} travel weather guide",
                    "key": YOUTUBE_API_KEY,
                    "part": "snippet",
                    "type": "video",
                    "maxResults": 3
                }
            )
            if r.status_code == 200:
                return [
                    {
                        "video_id": i["id"]["videoId"],
                        "title": i["snippet"]["title"],
                        "thumbnail": i["snippet"]["thumbnails"]["medium"]["url"],
                        "channel": i["snippet"]["channelTitle"]
                    }
                    for i in r.json().get("items", [])
                ]
        except (httpx.TimeoutException, httpx.ConnectError):
            pass  # Return empty list on timeout
    
    return []


def process_forecast(raw):
    daily = {}

    for item in raw["list"]:
        day = item["dt_txt"].split(" ")[0]

        if day not in daily:
            daily[day] = {
                "temps": [],
                "weather": item["weather"][0],
                "humidity": item["main"]["humidity"],
                "wind": item["wind"]["speed"],
                "pop": item.get("pop", 0)
            }

        daily[day]["temps"].append(item["main"]["temp"])

    result = []
    for day, d in list(daily.items())[:5]:
        result.append({
            "date": day,
            "temp_min": round(min(d["temps"]), 1),
            "temp_max": round(max(d["temps"]), 1),
            "weather": d["weather"],
            "humidity": d["humidity"],
            "wind_speed": round(d["wind"] * 3.6, 1),
            "precipitation_prob": round(d["pop"] * 100)
        })

    return result


# ===========================
# ROUTES
# ===========================
@app.get("/")
def root():
    return {"message": "Weather Intelligence API running 🚀"}


@app.get("/api/weather/full")
async def get_weather(location: str = Query(...)):
    lat, lon, city, country = await geocode_location(location)

    # Fetch data
    current_raw, forecast_raw, videos = await asyncio.gather(
        fetch_current(lat, lon),
        fetch_forecast(lat, lon),
        fetch_youtube(city)
    )

    forecast = process_forecast(forecast_raw)
    
    # Transform current weather data to match frontend expectations
    current_transformed = {
        "temperature": current_raw["main"]["temp"],
        "feels_like": current_raw["main"]["feels_like"],
        "temp_min": current_raw["main"]["temp_min"],
        "temp_max": current_raw["main"]["temp_max"],
        "humidity": current_raw["main"]["humidity"],
        "pressure": current_raw["main"]["pressure"],
        "visibility": current_raw.get("visibility", 10000) // 1000,  # Convert to km
        "wind_speed": round(current_raw["wind"]["speed"] * 3.6, 1),  # Convert to km/h
        "wind_deg": current_raw["wind"]["deg"],
        "weather": {
            "id": current_raw["weather"][0]["id"],
            "main": current_raw["weather"][0]["main"],
            "description": current_raw["weather"][0]["description"],
            "icon": current_raw["weather"][0]["icon"]
        },
        "clouds": current_raw["clouds"]["all"],
        "sunrise": current_raw["sys"]["sunrise"],
        "sunset": current_raw["sys"]["sunset"]
    }

    return {
        "city": city,
        "country": country,
        "lat": lat,
        "lon": lon,
        "current": current_transformed,  # Use transformed data
        "forecast": forecast,
        "videos": videos,
        "maps_api_key": MAPS_API_KEY if MAPS_API_KEY else ""
    }


@app.post("/api/records", status_code=201)
async def create_record(req: WeatherRequest):
    lat, lon, city, country = await geocode_location(req.location)
    current_raw = await fetch_current(lat, lon)
    
    # Use transformed weather snapshot
    weather_snapshot = {
        "temperature": current_raw["main"]["temp"],
        "humidity": current_raw["main"]["humidity"],
        "weather": current_raw["weather"][0]
    }

    now = datetime.now(timezone.utc).isoformat()

    record = {
        "location": req.location,
        "resolved_city": city,
        "country": country,
        "lat": lat,
        "lon": lon,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "notes": req.notes,
        "weather_snapshot": weather_snapshot,
        "created_at": now,
        "updated_at": now
    }

    result = get_collection().insert_one(record)
    record["_id"] = str(result.inserted_id)

    return record


@app.get("/api/records")
async def read_records():
    records = list(get_collection().find().sort("created_at", -1))
    return [serialize_doc(r) for r in records]


@app.delete("/api/records/{record_id}")
async def delete_record(record_id: str):
    from bson import ObjectId

    res = get_collection().delete_one({"_id": ObjectId(record_id)})

    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")

    return {"message": "Deleted"}


# ===========================
# EXPORT
# ===========================
@app.get("/api/export/csv")
async def export_csv():
    records = list(get_collection().find())

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["location", "resolved_city", "country"])
    writer.writeheader()

    for r in records:
        writer.writerow({
            "location": r.get("location"),
            "resolved_city": r.get("resolved_city"),
            "country": r.get("country")
        })

    output.seek(0)

    return StreamingResponse(output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=data.csv"})


# ===========================
# RUN
# ===========================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port=8000)