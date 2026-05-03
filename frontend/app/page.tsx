"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Wind, Droplets, Eye, Thermometer, Gauge, Cloud,
  Search, MapPin, Database, Download, Trash2, Edit3,
  Save, X, ChevronDown, RefreshCw, Sun, Sunrise, Sunset,
  AlertCircle, CheckCircle, Youtube, Map, Clock, Calendar
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeatherData {
  city: string; country: string; lat: number; lon: number;
  current: {
    temperature: number; feels_like: number; temp_min: number; temp_max: number;
    humidity: number; pressure: number; visibility: number;
    wind_speed: number; wind_deg: number;
    weather: { id: number; main: string; description: string; icon: string };
    clouds: number; sunrise: number; sunset: number;
  };
  forecast: ForecastDay[];
  videos: Video[];
  maps_api_key: string;
}

interface ForecastDay {
  date: string; temp_min: number; temp_max: number;
  weather: { id: number; main: string; description: string; icon: string };
  humidity: number; wind_speed: number; precipitation_prob: number;
}

interface Video {
  video_id: string; title: string; thumbnail: string; channel: string;
}

interface Record {
  _id: string; location: string; resolved_city: string; country: string;
  lat: number; lon: number; start_date?: string; end_date?: string;
  notes?: string; weather_snapshot?: any; created_at: string; updated_at: string;
}

// ── Weather Icon Map ───────────────────────────────────────────────────────────
function getWeatherEmoji(id: number): string {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 400) return "🌧️";
  if (id >= 500 && id < 600) return "🌧️";
  if (id === 511) return "❄️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return "☀️";
  if (id === 801) return "🌤️";
  if (id === 802) return "⛅";
  if (id >= 803) return "☁️";
  return "🌡️";
}

function getSkyClass(id: number): string {
  if (id >= 200 && id < 300) return "sky-storm";
  if (id >= 300 && id < 600) return "sky-rain";
  if (id >= 600 && id < 700) return "sky-snow";
  if (id >= 700 && id < 800) return "sky-mist";
  if (id === 800) return "sky-clear";
  if (id <= 802) return "sky-day";
  return "sky-clouds";
}

// ── Wind Direction ─────────────────────────────────────────────────────────────
function windDir(deg: number): string {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ── Format Date ───────────────────────────────────────────────────────────────
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color = "#4fd1c7" }: any) {
  return (
    <div className="stat-card">
      <div style={{ color, marginBottom: 8, opacity: 0.8 }}><Icon size={16} /></div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
        {value}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function WeatherApp() {
  const [tab, setTab] = useState<"weather" | "records" | "export">("weather");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [locating, setLocating] = useState(false);

  // Records state
  const [records, setRecords] = useState<Record[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveForm, setSaveForm] = useState({ location: "", start_date: "", end_date: "", notes: "" });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // ── Fetch weather ─────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async (location: string) => {
    if (!location.trim()) return;
    setLoading(true);
    setError("");
    setWeatherData(null);
    try {
      const { data } = await axios.get(`${API}/api/weather/full`, { params: { location } });
      setWeatherData(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to fetch weather data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── GPS location ──────────────────────────────────────────────────────────
  const fetchByGPS = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported by your browser"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
        setQuery(loc);
        fetchWeather(loc);
        setLocating(false);
      },
      (err) => {
        setError(`GPS error: ${err.message}`);
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) fetchWeather(query.trim());
  };

  // ── Records CRUD ──────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/records`);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "records" || tab === "export") fetchRecords();
  }, [tab, fetchRecords]);

  useEffect(() => {
    if (weatherData) setSaveForm(f => ({ ...f, location: weatherData.city }));
  }, [weatherData]);

  const handleSave = async () => {
    setSaveError(""); setSaveSuccess("");
    if (!saveForm.location.trim()) { setSaveError("Location is required"); return; }
    if (saveForm.start_date && saveForm.end_date && saveForm.start_date > saveForm.end_date) {
      setSaveError("End date must be after start date"); return;
    }
    try {
      await axios.post(`${API}/api/records`, saveForm);
      setSaveSuccess("Record saved successfully!");
      setShowSaveForm(false);
      setSaveForm({ location: weatherData?.city || "", start_date: "", end_date: "", notes: "" });
      if (tab === "records") fetchRecords();
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail || "Failed to save record");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    try {
      await axios.delete(`${API}/api/records/${id}`);
      setRecords(r => r.filter(x => x._id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Delete failed");
    }
  };

  const handleEditStart = (r: Record) => {
    setEditId(r._id);
    setEditForm({ location: r.location, notes: r.notes || "", start_date: r.start_date || "", end_date: r.end_date || "" });
  };

  const handleEditSave = async (id: string) => {
    try {
      const { data } = await axios.put(`${API}/api/records/${id}`, editForm);
      setRecords(r => r.map(x => x._id === id ? data : x));
      setEditId(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Update failed");
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format: string) => {
    try {
      const res = await axios.get(`${API}/api/export/${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `weather_records.${format === "markdown" ? "md" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Make sure the backend is running.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const skyClass = weatherData?.current?.weather?.id ? getSkyClass(weatherData.current.weather.id) : "";

  return (
    <div className={`min-h-screen transition-all duration-1000 ${skyClass}`} style={{ fontFamily: "var(--font-body)" }}>
      {/* Ambient particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: Math.random() * 200 + 100,
            height: Math.random() * 200 + 100,
            borderRadius: "50%",
            background: i % 3 === 0 ? "rgba(79,209,199,0.03)" : i % 3 === 1 ? "rgba(240,147,251,0.03)" : "rgba(255,255,255,0.02)",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            filter: "blur(40px)",
            animation: `float ${5 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "clamp(24px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
                Weather<span style={{ color: "#4fd1c7" }}>IQ</span>
              </h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                INTELLIGENCE PLATFORM · BY JOSEPH ADEABAH · PM ACCELERATOR
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["weather", "records", "export"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`btn-ghost ${tab === t ? "tab-active" : ""}`}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                  {t === "weather" ? "🌤 Weather" : t === "records" ? "🗄 Records" : "📤 Export"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* PM Accelerator Badge */}
        <div className="glass" style={{ padding: "10px 16px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, borderRadius: 10 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block" }}>BUILT FOR</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#4fd1c7" }}>Product Manager Accelerator</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>— AI Engineer Intern Technical Assessment</span>
          </div>
          <a href="https://www.linkedin.com/school/pmaccelerator/posts/?feedView=all" target="_blank" rel="noopener"
            style={{ marginLeft: "auto", fontSize: 11, color: "#4fd1c7", fontFamily: "var(--font-mono)", textDecoration: "none" }}>
            LinkedIn ↗
          </a>
        </div>

        {/* ── WEATHER TAB ── */}
        {tab === "weather" && (
          <div>
            {/* Search bar */}
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  className="weather-input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="City, ZIP code, GPS coordinates, landmark..."
                  style={{ width: "100%", padding: "14px 14px 14px 42px", fontSize: 15 }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading || !query.trim()}
                style={{ padding: "14px 24px", fontSize: 15 }}>
                {loading ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : "Search"}
              </button>
              <button type="button" onClick={fetchByGPS} className="btn-ghost" disabled={locating}
                style={{ padding: "14px 16px" }} title="Use my location">
                <MapPin size={16} style={{ color: locating ? "#4fd1c7" : undefined }} />
              </button>
            </form>

            {/* Error */}
            {error && (
              <div className="error-box fade-up" style={{ marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertCircle size={18} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <strong style={{ display: "block", marginBottom: 4 }}>Could not load weather</strong>
                  <span style={{ fontSize: 14 }}>{error}</span>
                </div>
              </div>
            )}

            {/* Loading shimmer */}
            {loading && (
              <div className="fade-up">
                <div className="shimmer" style={{ height: 200, marginBottom: 16 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
                  {[...Array(6)].map((_, i) => <div key={i} className="shimmer" style={{ height: 80 }} />)}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="shimmer" style={{ flex: 1, height: 120 }} />)}
                </div>
              </div>
            )}

            {/* Weather display */}
            {weatherData && !loading && (
              <div className="fade-up">
                {/* Main card */}
                <div className="glass" style={{ padding: "32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", right: -20, top: -20, fontSize: 140, opacity: 0.08, lineHeight: 1, userSelect: "none" }}>
                    {getWeatherEmoji(weatherData.current?.weather?.id || 800)}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <MapPin size={14} style={{ color: "#4fd1c7" }} />
                        <span style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {weatherData?.lat?.toFixed(2)}°N, {weatherData?.lon?.toFixed(2)}°E
                        </span>
                      </div>
                      <h2 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {weatherData?.city}
                        <span style={{ fontSize: "0.4em", color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>{weatherData?.country}</span>
                      </h2>
                      <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 8, textTransform: "capitalize" }}>
                        {getWeatherEmoji(weatherData.current?.weather?.id || 800)} {weatherData.current?.weather?.description}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "clamp(56px, 8vw, 96px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: "#4fd1c7" }}>
                        {weatherData.current?.temperature}°
                        <span style={{ fontSize: "0.3em", color: "var(--text-muted)", fontWeight: 400 }}>C</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        Feels like {weatherData.current?.feels_like}° · {weatherData.current?.temp_min}° / {weatherData.current?.temp_max}°
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 24 }}>
                    <StatCard icon={Droplets} label="Humidity" value={weatherData.current?.humidity ?? 0} unit="%" color="#60a5fa" />
                    <StatCard icon={Wind} label="Wind" value={`${weatherData.current?.wind_speed ?? 0} ${windDir(weatherData.current?.wind_deg ?? 0)}`} unit="km/h" color="#a78bfa" />
                    <StatCard icon={Eye} label="Visibility" value={weatherData.current?.visibility ?? 0} unit="km" color="#34d399" />
                    <StatCard icon={Gauge} label="Pressure" value={weatherData.current?.pressure ?? 0} unit="hPa" color="#fb923c" />
                    <StatCard icon={Cloud} label="Cloud Cover" value={weatherData.current?.clouds ?? 0} unit="%" color="#94a3b8" />
                    <StatCard icon={Thermometer} label="Feels Like" value={weatherData.current?.feels_like ?? 0} unit="°C" color="#f472b6" />
                  </div>

                  {/* Sun times */}
                  <div style={{ display: "flex", gap: 20, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                      <Sunrise size={14} style={{ color: "#fbbf24" }} />
                      <span style={{ fontFamily: "var(--font-mono)" }}>{fmtTime(weatherData.current?.sunrise ?? 0)}</span>
                      <span>sunrise</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                      <Sunset size={14} style={{ color: "#f97316" }} />
                      <span style={{ fontFamily: "var(--font-mono)" }}>{fmtTime(weatherData.current?.sunset ?? 0)}</span>
                      <span>sunset</span>
                    </div>
                  </div>
                </div>

                {/* 5-day forecast */}
                <div className="glass" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
                    5-Day Forecast
                  </h3>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {weatherData?.forecast?.map((day, i) => (
                      <div key={day?.date || i} className="forecast-card" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                          {fmtDate(day?.date || "")}
                        </div>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{getWeatherEmoji(day?.weather?.id || 800)}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize", marginBottom: 12 }}>
                          {day?.weather?.description}
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                          <span style={{ color: "#f97316" }}>{day?.temp_max}°</span>
                          <span style={{ color: "var(--text-muted)" }}>/</span>
                          <span style={{ color: "#60a5fa" }}>{day?.temp_min}°</span>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11, color: "#60a5fa", fontFamily: "var(--font-mono)" }}>
                            💧 {day?.humidity}%
                          </div>
                          <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "var(--font-mono)" }}>
                            🌂 {day?.precipitation_prob}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save & Map row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {/* Save to DB */}
                  <div className="glass" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
                      💾 Save Record
                    </h3>
                    {!showSaveForm ? (
                      <button className="btn-primary" onClick={() => setShowSaveForm(true)}
                        style={{ padding: "10px 20px", fontSize: 14, width: "100%" }}>
                        Save this weather snapshot →
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <input className="weather-input" placeholder="Location name" value={saveForm.location}
                          onChange={e => setSaveForm(f => ({ ...f, location: e.target.value }))}
                          style={{ padding: "10px 14px", fontSize: 13, width: "100%" }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <input className="weather-input" type="date" value={saveForm.start_date}
                            onChange={e => setSaveForm(f => ({ ...f, start_date: e.target.value }))}
                            style={{ flex: 1, padding: "10px 14px", fontSize: 13 }} />
                          <input className="weather-input" type="date" value={saveForm.end_date}
                            onChange={e => setSaveForm(f => ({ ...f, end_date: e.target.value }))}
                            style={{ flex: 1, padding: "10px 14px", fontSize: 13 }} />
                        </div>
                        <textarea className="weather-input" placeholder="Notes (optional)" value={saveForm.notes}
                          onChange={e => setSaveForm(f => ({ ...f, notes: e.target.value }))}
                          style={{ padding: "10px 14px", fontSize: 13, width: "100%", resize: "none", height: 60 }} />
                        {saveError && <div style={{ fontSize: 12, color: "#f87171" }}>{saveError}</div>}
                        {saveSuccess && <div style={{ fontSize: 12, color: "#4ade80" }}>{saveSuccess}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-primary" onClick={handleSave} style={{ flex: 1, padding: "10px", fontSize: 13 }}>Save</button>
                          <button className="btn-ghost" onClick={() => setShowSaveForm(false)} style={{ padding: "10px 14px", fontSize: 13 }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Map */}
                  <div className="glass" style={{ padding: 20, minHeight: 200 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
                      🗺️ Location Map
                    </h3>
                    {weatherData?.maps_api_key ? (
                      <iframe
                        width="100%" height="200"
                        style={{ borderRadius: 8, border: "none" }}
                        src={`https://www.google.com/maps/embed/v1/place?key=${weatherData.maps_api_key}&q=${encodeURIComponent(weatherData.city + ", " + weatherData.country)}&zoom=10`}
                        allowFullScreen />
                    ) : (
                      <a href={`https://www.openstreetmap.org/?mlat=${weatherData?.lat}&mlon=${weatherData?.lon}#map=10/${weatherData?.lat}/${weatherData?.lon}`}
                        target="_blank" rel="noopener"
                        className="btn-ghost"
                        style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "20px", width: "100%", textDecoration: "none", marginTop: 8 }}>
                        <Map size={16} style={{ color: "#4fd1c7" }} />
                        <span style={{ fontSize: 14 }}>View on OpenStreetMap ↗</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* YouTube Videos */}
                {weatherData?.videos?.length > 0 && (
                  <div className="glass" style={{ padding: 24, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
                      📺 Explore {weatherData?.city}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                      {weatherData.videos.map(v => (
                        <a key={v?.video_id} href={`https://youtube.com/watch?v=${v?.video_id}`} target="_blank" rel="noopener"
                          style={{ textDecoration: "none" }}>
                          <div className="stat-card" style={{ overflow: "hidden", padding: 0 }}>
                            <img src={v?.thumbnail} alt={v?.title} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                            <div style={{ padding: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {v?.title}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{v?.channel}</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Smart insights */}
                {weatherData && <WeatherInsights data={weatherData} />}
              </div>
            )}

            {/* Empty state */}
            {!weatherData && !loading && !error && (
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: 80, marginBottom: 24, animation: "float 5s ease-in-out infinite" }}>🌤️</div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Search any location</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 15, maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                  Enter a city, ZIP code, GPS coordinates, or a landmark. Or use your current GPS location.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                  {["Accra, Ghana", "New York, NY", "Tokyo, Japan", "35.6762,139.6503"].map(s => (
                    <button key={s} className="btn-ghost" onClick={() => { setQuery(s); fetchWeather(s); }}
                      style={{ padding: "8px 16px", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === "records" && (
          <RecordsTab
            records={records}
            loading={recordsLoading}
            editId={editId}
            editForm={editForm}
            setEditForm={setEditForm}
            onRefresh={fetchRecords}
            onDelete={handleDelete}
            onEditStart={handleEditStart}
            onEditSave={handleEditSave}
            onEditCancel={() => setEditId(null)}
          />
        )}

        {/* ── EXPORT TAB ── */}
        {tab === "export" && (
          <ExportTab records={records} onExport={handleExport} />
        )}
      </div>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", borderTop: "1px solid rgba(255,255,255,0.04)", position: "relative", zIndex: 1, marginTop: 40 }}>
        <div>WeatherIQ · Built by JOSEPH ADEABAH · PM Accelerator AI Engineer Intern Assessment</div>
        <div style={{ marginTop: 4 }}>Powered by OpenWeatherMap · FastAPI · Next.js · MongoDB</div>
      </footer>
    </div>
  );
}

// ── Smart Insights Component ──────────────────────────────────────────────────
function WeatherInsights({ data }: { data: WeatherData }) {
  const { current, city } = data;
  const insights: { icon: string; text: string; color: string }[] = [];

  if (current?.humidity && current.humidity > 80) insights.push({ icon: "💧", text: "High humidity — it may feel stickier than the temperature shows.", color: "#60a5fa" });
  if (current?.wind_speed && current.wind_speed > 40) insights.push({ icon: "💨", text: "Strong winds today. Secure loose items and drive cautiously.", color: "#a78bfa" });
  if (current?.visibility && current.visibility < 2) insights.push({ icon: "🌫️", text: "Low visibility. Consider delaying travel or flying plans.", color: "#94a3b8" });
  if (current?.temperature && current.temperature > 35) insights.push({ icon: "🥵", text: "Extreme heat. Stay hydrated and avoid prolonged sun exposure.", color: "#f97316" });
  if (current?.temperature && current.temperature < 0) insights.push({ icon: "🥶", text: "Below freezing. Watch for ice on roads and walkways.", color: "#38bdf8" });
  if (current?.pressure && current.pressure < 1000) insights.push({ icon: "⚠️", text: "Low pressure system — weather may deteriorate soon.", color: "#fbbf24" });
  if (data?.forecast?.[0]?.precipitation_prob && data.forecast[0].precipitation_prob > 70) insights.push({ icon: "🌂", text: `High rain probability tomorrow (${data.forecast[0].precipitation_prob}%). Pack an umbrella.`, color: "#60a5fa" });

  if (insights.length === 0) return null;
  return (
    <div className="glass" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
        🧠 Smart Insights
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, borderLeft: `3px solid ${ins.color}` }}>
            <span style={{ fontSize: 18 }}>{ins.icon}</span>
            <span style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Records Tab Component ─────────────────────────────────────────────────────
function RecordsTab({ records, loading, editId, editForm, setEditForm, onRefresh, onDelete, onEditStart, onEditSave, onEditCancel }: any) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Weather Records</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>All saved weather snapshots from the database</p>
        </div>
        <button className="btn-ghost" onClick={onRefresh} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="shimmer" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : records?.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗄️</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No records yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Search for a location and save a weather snapshot to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {records?.map((r: any) => (
            <div key={r?._id} className="glass" style={{ padding: 16 }}>
              {editId === r?._id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input className="weather-input" value={editForm?.location || ""} onChange={e => setEditForm((f: any) => ({ ...f, location: e.target.value }))}
                      placeholder="Location" style={{ padding: "10px 14px", fontSize: 13 }} />
                    <input className="weather-input" value={editForm?.notes || ""} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes" style={{ padding: "10px 14px", fontSize: 13 }} />
                    <input className="weather-input" type="date" value={editForm?.start_date || ""} onChange={e => setEditForm((f: any) => ({ ...f, start_date: e.target.value }))}
                      style={{ padding: "10px 14px", fontSize: 13 }} />
                    <input className="weather-input" type="date" value={editForm?.end_date || ""} onChange={e => setEditForm((f: any) => ({ ...f, end_date: e.target.value }))}
                      style={{ padding: "10px 14px", fontSize: 13 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => onEditSave(r?._id)} style={{ padding: "8px 20px", fontSize: 13 }}>
                      <Save size={13} style={{ display: "inline", marginRight: 4 }} /> Save
                    </button>
                    <button className="btn-ghost" onClick={onEditCancel} style={{ padding: "8px 16px", fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{r?.resolved_city}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r?.country}</span>
                      {r?.weather_snapshot && (
                        <span style={{ fontSize: 11, color: "#4fd1c7", fontFamily: "var(--font-mono)", background: "rgba(79,209,199,0.1)", padding: "2px 8px", borderRadius: 6 }}>
                          {r.weather_snapshot?.temperature}°C
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>📍 {r?.location}</span>
                      {r?.start_date && <span>📅 {r.start_date}{r.end_date ? ` → ${r.end_date}` : ""}</span>}
                      {r?.notes && <span>📝 {r.notes}</span>}
                      <span style={{ opacity: 0.6 }}>{r?.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" onClick={() => onEditStart(r)} style={{ padding: "8px 12px", fontSize: 12 }}>
                      <Edit3 size={12} />
                    </button>
                    <button className="btn-danger" onClick={() => onDelete(r?._id)} style={{ padding: "8px 12px" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Export Tab Component ──────────────────────────────────────────────────────
function ExportTab({ records, onExport }: any) {
  const formats = [
    { id: "json", label: "JSON", icon: "{ }", desc: "JavaScript Object Notation — great for APIs and data exchange", color: "#f59e0b" },
    { id: "csv", label: "CSV", icon: "≡", desc: "Comma Separated Values — open in Excel or Google Sheets", color: "#10b981" },
    { id: "xml", label: "XML", icon: "</>", desc: "Extensible Markup Language — structured, human-readable", color: "#3b82f6" },
    { id: "markdown", label: "Markdown", icon: "M↓", desc: "Markdown file — readable as plain text or rendered docs", color: "#8b5cf6" },
  ];
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Export Data</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          Download all {records?.length || 0} record{records?.length !== 1 ? "s" : ""} from the database
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {formats.map(f => (
          <div key={f.id} className="glass" style={{ padding: 24, cursor: "pointer" }} onClick={() => onExport(f.id)}>
            <div style={{ fontSize: 28, fontFamily: "var(--font-mono)", color: f.color, marginBottom: 12, fontWeight: 700 }}>{f.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{f.label}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>{f.desc}</p>
            <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13, width: "100%", background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)` }}>
              <Download size={12} style={{ display: "inline", marginRight: 6 }} /> Download .{f.id === "markdown" ? "md" : f.id}
            </button>
          </div>
        ))}
      </div>

      {records?.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", marginTop: 20 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Save some weather records first before exporting.</p>
        </div>
      )}
    </div>
  );
}