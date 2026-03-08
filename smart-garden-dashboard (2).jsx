import { useState, useEffect } from "react";

const data = {
  garden: { name: "Vườn Eden", zone: "Hà Nội · Tầng Thượng", lastSync: "vừa xong" },
  sensors: { temp: 28.4, humidity: 72, soil: 65, light: 84, co2: 412, ph: 6.8 },
  plant: {
    name: "Cà Chua Bi", icon: "🍅", variety: "Cherry Tomato F1",
    health: 94, water: 70, stage: "Ra Trái", days: 42, totalDays: 90,
    height: 62, nextHarvest: "16 ngày",
    notes: "Phát triển tốt, cần bón phân thêm tuần tới.",
    timeline: [
      { label: "Gieo", day: 0, done: true },
      { label: "Nảy Mầm", day: 7, done: true },
      { label: "Ra Lá", day: 18, done: true },
      { label: "Ra Hoa", day: 30, done: true },
      { label: "Ra Trái", day: 42, done: true },
      { label: "Thu Hoạch", day: 58, done: false },
    ]
  },
  soil: {
    type: "Giá Thể Xơ Dừa", ph: 6.8, ec: 1.4, temp: 24.1,
    nitrogen: 78, phosphorus: 62, potassium: 85,
    texture: "Thoáng · Thoát Nước Tốt", origin: "Bến Tre",
    lastFertilized: "3 ngày trước"
  },
  weather: {
    current: { temp: 31, feel: 34, desc: "Có Mây Rải Rác", icon: "⛅", wind: 12, uv: 6, rain: 40 },
    forecast: [
      { day: "Hôm nay", icon: "⛅", hi: 31, lo: 24, rain: 40, suitable: true },
      { day: "Thứ 7",   icon: "🌧️", hi: 28, lo: 22, rain: 80, suitable: false },
      { day: "CN",       icon: "🌤️", hi: 33, lo: 25, rain: 10, suitable: true },
      { day: "T2",       icon: "☀️", hi: 35, lo: 26, rain: 5,  suitable: true },
      { day: "T3",       icon: "🌤️", hi: 32, lo: 25, rain: 15, suitable: true },
      { day: "T4",       icon: "⛈️", hi: 27, lo: 21, rain: 90, suitable: false },
      { day: "T5",       icon: "🌤️", hi: 30, lo: 23, rain: 20, suitable: true },
    ],
    tip: "Hôm nay phù hợp để tưới sáng sớm. Mưa dự kiến lúc 16:00 — bỏ qua tưới chiều."
  },
  waterLog: [18, 24, 22, 31, 19, 27, 25, 30, 22, 18, 26, 23, 28, 20],
  alerts: [
    { type: "info",    msg: "Mưa lúc 16:00 hôm nay" },
    { type: "success", msg: "Tưới sáng xong · 3.2L" },
    { type: "warn",    msg: "Cần tưới trước 14:30" },
  ],
  irrigation: { nextWater: "14:30", lastWater: "06:15", totalToday: "3.2L", schedule: "2 lần/ngày" }
};

const Ring = ({ value, max = 100, size = 72, stroke = 6, color, bg = "#1a2e1a" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / max) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 5px ${color}99)` }}/>
    </svg>
  );
};

export default function Dashboard() {
  const [time, setTime] = useState(new Date());
  const [irrigating, setIrrigating] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = d => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = d => d.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" });
  const healthColor = v => v >= 90 ? "#4ade80" : v >= 75 ? "#facc15" : "#f87171";
  const progress = Math.round((data.plant.days / data.plant.totalDays) * 100);

  return (
    <div style={{
      minHeight: "100vh", background: "#050c06",
      fontFamily: "'DM Sans', sans-serif", color: "#c8e6c9",
      backgroundImage: `
        radial-gradient(ellipse 70% 50% at 15% 10%, #0d2b1077 0%, transparent 55%),
        radial-gradient(ellipse 50% 70% at 85% 85%, #0a1f0a55 0%, transparent 55%)
      `
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:wght@500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #2d5a2d; border-radius: 2px; }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 #4ade8033; } 50% { box-shadow: 0 0 0 10px #4ade8000; } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        .card { background: linear-gradient(145deg,#0f200f 0%,#090f09 100%); border: 1px solid #1c3820; border-radius: 18px; padding: 20px; position: relative; overflow: hidden; transition: border-color .3s; }
        .card::after { content:''; position:absolute; inset:0; border-radius:18px; background:linear-gradient(135deg,#4ade8007 0%,transparent 40%); pointer-events:none; }
        .card:hover { border-color:#2a5230; }
        .btn { cursor:pointer; border:none; border-radius:12px; font-family:inherit; font-weight:600; transition:all .2s; }
        .btn-primary { background:linear-gradient(135deg,#166534,#14532d); color:#4ade80; border:1px solid #1e6035; padding:12px 22px; font-size:13px; }
        .btn-primary:hover { background:linear-gradient(135deg,#15803d,#166534); box-shadow:0 0 24px #4ade8033; }
        .btn-active { background:linear-gradient(135deg,#22c55e,#16a34a)!important; color:#052e16!important; box-shadow:0 0 28px #4ade8055!important; animation:pulse-glow 2s infinite; }
        .mono { font-family:'DM Mono',monospace; }
        .serif { font-family:'Cormorant Garamond',serif; }
        .label { font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:#3d6e3d; font-weight:600; }
        .bar-track { height:5px; border-radius:3px; background:#152415; overflow:hidden; }
        .bar-fill { height:100%; border-radius:3px; transition:width 1.2s ease; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom:"1px solid #162a18", padding:"14px 26px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(to bottom,#091409,transparent)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#1a472a,#0d2b16)", border:"1px solid #22c55e33", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🌿</div>
          <div>
            <div className="serif" style={{ fontSize:21, fontWeight:700, color:"#e8f5e9" }}>{data.garden.name}</div>
            <div className="label" style={{ marginTop:1 }}>{data.garden.zone} · Đồng bộ {data.garden.lastSync}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {data.alerts.map((a,i) => (
            <div key={i} style={{ padding:"5px 11px", borderRadius:20, fontSize:11, fontWeight:500,
              background: a.type==="warn"?"#2d1a0066":a.type==="info"?"#001a2d66":"#002d0a66",
              border:`1px solid ${a.type==="warn"?"#78350f":a.type==="info"?"#075985":"#14532d"}`,
              color: a.type==="warn"?"#fbbf24":a.type==="info"?"#38bdf8":"#4ade80" }}>
              {a.type==="warn"?"⚠ ":a.type==="info"?"ℹ ":"✓ "}{a.msg}
            </div>
          ))}
          <div style={{ textAlign:"right", marginLeft:8 }}>
            <div className="mono" style={{ fontSize:20, fontWeight:500, color:"#4ade80", letterSpacing:".04em" }}>{fmt(time)}</div>
            <div style={{ fontSize:11, color:"#3d6e3d" }}>{fmtDate(time)}</div>
          </div>
        </div>
      </div>

      <div style={{ padding:"20px 26px 28px", display:"grid", gridTemplateColumns:"1fr 1fr 320px", gap:18 }}>

        {/* ─── COL 1: WEATHER HERO + MINI SENSORS ─── */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

          {/* WEATHER HERO */}
          <div className="card" style={{ padding:0, border:"1px solid #1e4028" }}>
            {/* Current */}
            <div style={{ padding:"22px 22px 18px", background:"linear-gradient(140deg,#0a2414 0%,#061610 50%,#050e07 100%)", position:"relative" }}>
              <div style={{ position:"absolute", top:-30, right:-30, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,#22c55e09 0%,transparent 70%)", pointerEvents:"none" }}/>
              <div className="label" style={{ marginBottom:12 }}>☁ Thời Tiết Hôm Nay · Hà Nội</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:3 }}>
                    <div className="serif" style={{ fontSize:72, fontWeight:700, color:"#e8f5e9", lineHeight:1 }}>{data.weather.current.temp}</div>
                    <div style={{ fontSize:22, color:"#4a7c4a", marginTop:12 }}>°C</div>
                  </div>
                  <div style={{ fontSize:14, color:"#6aaa6a", marginTop:3 }}>{data.weather.current.desc}</div>
                  <div style={{ fontSize:12, color:"#3d6e3d", marginTop:2 }}>Cảm giác như {data.weather.current.feel}°C</div>
                </div>
                <div style={{ fontSize:76 }}>{data.weather.current.icon}</div>
              </div>
              <div style={{ display:"flex", gap:0, marginTop:18, borderTop:"1px solid #1a3220", paddingTop:14 }}>
                {[
                  { icon:"💨", label:"Gió",      val:`${data.weather.current.wind} km/h` },
                  { icon:"🌧", label:"Mưa",      val:`${data.weather.current.rain}%` },
                  { icon:"☀️", label:"UV Index", val:`${data.weather.current.uv}/10` },
                  { icon:"💧", label:"Độ Ẩm",    val:`${data.sensors.humidity}%` },
                ].map((m,i) => (
                  <div key={i} style={{ flex:1, textAlign:"center", borderRight:i<3?"1px solid #1a3220":"none" }}>
                    <div style={{ fontSize:15, marginBottom:3 }}>{m.icon}</div>
                    <div className="mono" style={{ fontSize:13, fontWeight:600, color:"#c8e6c9" }}>{m.val}</div>
                    <div style={{ fontSize:9, color:"#3d6e3d", marginTop:1 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-day strip */}
            <div style={{ padding:"14px 18px", background:"#07120a" }}>
              <div className="label" style={{ marginBottom:10 }}>Dự Báo 7 Ngày</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
                {data.weather.forecast.map((w,i) => (
                  <div key={i} style={{ textAlign:"center", padding:"10px 3px 8px", borderRadius:12,
                    background:i===0?"#0d2b14":"#0a1409",
                    border:`1px solid ${i===0?"#1e5030":"#121f14"}` }}>
                    <div style={{ fontSize:9, color:i===0?"#4ade80":"#3d6e3d", fontWeight:600, marginBottom:4, letterSpacing:".04em" }}>{w.day}</div>
                    <div style={{ fontSize:18, marginBottom:4 }}>{w.icon}</div>
                    <div className="mono" style={{ fontSize:11, color:"#e8f5e9", fontWeight:600 }}>{w.hi}°</div>
                    <div className="mono" style={{ fontSize:9, color:"#3d6e3d" }}>{w.lo}°</div>
                    <div style={{ marginTop:5, height:3, borderRadius:2, background:"#152415", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${w.rain}%`, background:w.rain>60?"#3b82f6":"#1e5030", borderRadius:2 }}/>
                    </div>
                    <div style={{ fontSize:8, color:w.rain>60?"#60a5fa":"#2d5a2d", marginTop:3 }}>{w.rain}%</div>
                    <div style={{ fontSize:8, color:w.suitable?"#4ade80":"#f87171", marginTop:2 }}>{w.suitable?"✓":"✗"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div style={{ padding:"12px 18px 14px", background:"#060e08", borderTop:"1px solid #121f14", display:"flex", gap:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>🌱</span>
              <div style={{ fontSize:12, color:"#6aaa6a", lineHeight:1.6 }}>
                <span style={{ fontWeight:700, color:"#4ade80" }}>Gợi ý hôm nay: </span>{data.weather.tip}
              </div>
            </div>
          </div>

          {/* SENSORS ROW */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { label:"Nhiệt Độ", value:data.sensors.temp, unit:"°C",  icon:"🌡", color:"#f87171", max:50 },
              { label:"Ánh Sáng", value:data.sensors.light, unit:"%",  icon:"☀️", color:"#fbbf24", max:100 },
              { label:"CO₂",      value:data.sensors.co2,  unit:"ppm", icon:"🍃", color:"#a78bfa", max:1000 },
            ].map((s,i) => (
              <div key={i} className="card" style={{ padding:16, textAlign:"center" }}>
                <div style={{ fontSize:18, marginBottom:8 }}>{s.icon}</div>
                <div className="label" style={{ marginBottom:10, fontSize:9.5 }}>{s.label}</div>
                <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                  <Ring value={s.value} max={s.max} size={64} stroke={5} color={s.color}/>
                  <div style={{ position:"absolute", textAlign:"center" }}>
                    <div className="mono" style={{ fontSize:13, fontWeight:600, color:s.color, lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:8, color:"#3d6e3d" }}>{s.unit}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── COL 2: PLANT + SOIL ─── */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

          {/* PLANT PROFILE */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
              <div style={{ width:58, height:58, borderRadius:16, background:"linear-gradient(135deg,#1a472a,#0d2b16)", border:"1px solid #22c55e33", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
                {data.plant.icon}
              </div>
              <div style={{ flex:1 }}>
                <div className="serif" style={{ fontSize:22, fontWeight:700, color:"#e8f5e9", lineHeight:1 }}>{data.plant.name}</div>
                <div style={{ fontSize:12, color:"#4a7c4a", marginTop:3 }}>{data.plant.variety}</div>
                <div style={{ display:"flex", gap:7, marginTop:6 }}>
                  <div style={{ padding:"2px 9px", borderRadius:10, fontSize:10, fontWeight:600, background:"#fb923c22", color:"#fb923c", border:"1px solid #fb923c44" }}>{data.plant.stage}</div>
                  <div style={{ padding:"2px 9px", borderRadius:10, fontSize:10, fontWeight:600, background:"#4ade8022", color:"#4ade80", border:"1px solid #4ade8044" }}>Ngày {data.plant.days}/{data.plant.totalDays}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div className="label" style={{ marginBottom:2 }}>Sức Khỏe</div>
                <div className="mono" style={{ fontSize:28, fontWeight:600, color:healthColor(data.plant.health) }}>{data.plant.health}%</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="label" style={{ marginBottom:12 }}>Hành Trình Phát Triển</div>
            <div style={{ position:"relative", marginBottom:20 }}>
              <div style={{ height:2, background:"#152415", borderRadius:1, position:"absolute", top:7, left:0, right:0 }}/>
              <div style={{ height:2, background:"linear-gradient(90deg,#4ade80,#22c55e)", borderRadius:1, position:"absolute", top:7, left:0, width:`${progress}%`, transition:"width 1.2s ease", boxShadow:"0 0 8px #4ade8066" }}/>
              <div style={{ display:"flex", justifyContent:"space-between", position:"relative" }}>
                {data.plant.timeline.map((t,i) => (
                  <div key={i} style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                    <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${t.done?"#4ade80":"#1e3d1e"}`, background:t.done?"#4ade80":"#090f09", boxShadow:t.done?"0 0 8px #4ade8077":"none", zIndex:1, transition:"all .5s" }}/>
                    <div style={{ fontSize:9, color:t.done?"#4ade80":"#2d5a2d", fontWeight:t.done?600:400, whiteSpace:"nowrap" }}>{t.label}</div>
                    <div style={{ fontSize:8, color:"#2d5a2d" }}>T{t.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
              {[
                { label:"Độ Ẩm Đất", val:`${data.plant.water}%`,       color:"#60a5fa", icon:"💧" },
                { label:"Chiều Cao",  val:`${data.plant.height}cm`,     color:"#4ade80", icon:"📏" },
                { label:"Thu Hoạch", val:data.plant.nextHarvest,        color:"#fb923c", icon:"🌾" },
              ].map((s,i) => (
                <div key={i} style={{ padding:"12px 10px", borderRadius:12, background:"#07120a", border:"1px solid #162515", textAlign:"center" }}>
                  <div style={{ fontSize:16, marginBottom:4 }}>{s.icon}</div>
                  <div className="mono" style={{ fontSize:15, fontWeight:600, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:"#3d6e3d", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:"10px 14px", borderRadius:10, background:"#07120a", border:"1px solid #1a3220", fontSize:12, color:"#6aaa6a", lineHeight:1.6 }}>
              📝 {data.plant.notes}
            </div>
          </div>

          {/* SOIL CARD */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div>
                <div className="serif" style={{ fontSize:18, fontWeight:700, color:"#e8f5e9" }}>Loại Đất</div>
                <div style={{ fontSize:12, color:"#4a7c4a", marginTop:2 }}>🌍 {data.soil.type} · {data.soil.origin}</div>
              </div>
              <div style={{ padding:"8px 14px", borderRadius:12, background:"#07120a", border:"1px solid #162515", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#3d6e3d", marginBottom:2 }}>NHIỆT ĐỘ ĐẤT</div>
                <div className="mono" style={{ fontSize:18, color:"#fb923c", fontWeight:600 }}>{data.soil.temp}°C</div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { label:"Độ pH",           val:data.soil.ph, unit:"pH",    ideal:"6.0–7.0", color:"#fb923c" },
                { label:"EC (Dinh Dưỡng)", val:data.soil.ec, unit:"mS/cm", ideal:"1.2–2.0", color:"#4ade80" },
              ].map((m,i) => (
                <div key={i} style={{ padding:"12px 14px", borderRadius:12, background:"#07120a", border:"1px solid #162515" }}>
                  <div className="label" style={{ marginBottom:6, fontSize:9.5 }}>{m.label}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                    <div className="mono" style={{ fontSize:22, fontWeight:600, color:m.color }}>{m.val}</div>
                    <div style={{ fontSize:11, color:"#3d6e3d" }}>{m.unit}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#4ade80", marginTop:4 }}>✓ Lý tưởng: {m.ideal}</div>
                </div>
              ))}
            </div>

            <div className="label" style={{ marginBottom:10 }}>Dinh Dưỡng NPK</div>
            {[
              { label:"Nitơ (N)",    val:data.soil.nitrogen,   color:"#4ade80" },
              { label:"Phốt Pho (P)",val:data.soil.phosphorus, color:"#60a5fa" },
              { label:"Kali (K)",    val:data.soil.potassium,  color:"#fb923c" },
            ].map((n,i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:"#6aaa6a" }}>{n.label}</span>
                  <span className="mono" style={{ fontSize:11, color:n.color }}>{n.val}%</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width:`${n.val}%`, background:`linear-gradient(90deg,${n.color}66,${n.color})`, boxShadow:`0 0 6px ${n.color}44` }}/>
                </div>
              </div>
            ))}

            <div style={{ marginTop:12, fontSize:11, color:"#3d6e3d" }}>
              Đặc tính: <span style={{ color:"#6aaa6a" }}>{data.soil.texture}</span>
              <span style={{ margin:"0 6px" }}>·</span>
              Bón lần cuối: <span style={{ color:"#6aaa6a" }}>{data.soil.lastFertilized}</span>
            </div>
          </div>
        </div>

        {/* ─── COL 3: IRRIGATION + SOIL SENSORS + SYSTEM ─── */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

          {/* IRRIGATION */}
          <div className="card">
            <div className="serif" style={{ fontSize:18, fontWeight:700, color:"#e8f5e9", marginBottom:2 }}>Tưới Nước</div>
            <div className="label" style={{ marginBottom:14 }}>Điều Khiển · {data.irrigation.schedule}</div>

            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                <Ring value={data.plant.water} max={100} size={116} stroke={8} color="#60a5fa"/>
                <div style={{ position:"absolute", textAlign:"center" }}>
                  <div style={{ fontSize:24 }}>💧</div>
                  <div className="mono" style={{ fontSize:18, fontWeight:600, color:"#60a5fa", lineHeight:1.2 }}>{data.plant.water}%</div>
                  <div style={{ fontSize:9, color:"#3d6e3d" }}>Độ Ẩm Đất</div>
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {[
                { label:"Tưới Gần Nhất", val:data.irrigation.lastWater, icon:"✅" },
                { label:"Tưới Kế Tiếp",  val:data.irrigation.nextWater, icon:"⏰" },
                { label:"Hôm Nay",        val:data.irrigation.totalToday, icon:"📊" },
                { label:"Lịch Trình",     val:data.irrigation.schedule,   icon:"📅" },
              ].map((s,i) => (
                <div key={i} style={{ padding:"9px 11px", borderRadius:10, background:"#07120a", border:"1px solid #162515" }}>
                  <div style={{ fontSize:11, marginBottom:2 }}>{s.icon} <span style={{ color:"#3d6e3d", fontSize:9.5 }}>{s.label}</span></div>
                  <div className="mono" style={{ fontSize:13, color:"#c8e6c9", fontWeight:600 }}>{s.val}</div>
                </div>
              ))}
            </div>

            <button className={`btn btn-primary${irrigating?" btn-active":""}`}
              style={{ width:"100%", padding:"13px", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
              onClick={() => setIrrigating(!irrigating)}>
              <span style={{ fontSize:16 }}>💧</span>
              {irrigating ? "Đang Tưới..." : "Tưới Ngay"}
            </button>

            <div style={{ marginTop:10, padding:"11px 13px", background:"#07120a", borderRadius:12, border:"1px solid #162515", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, color:"#c8e6c9", fontWeight:600 }}>Tự Động</div>
                <div style={{ fontSize:10, color:"#3d6e3d" }}>Theo lịch & cảm biến</div>
              </div>
              <div style={{ width:42, height:24, borderRadius:12, position:"relative", cursor:"pointer",
                background:autoMode?"#166534":"#1a2e1a", border:`1px solid ${autoMode?"#22c55e44":"#1e3d1e"}`,
                transition:"background .2s" }} onClick={() => setAutoMode(!autoMode)}>
                <div style={{ position:"absolute", top:3, left:autoMode?21:3, width:18, height:18, borderRadius:"50%",
                  background:autoMode?"#4ade80":"#2d5a2d", boxShadow:autoMode?"0 0 8px #4ade80":"none", transition:"all .2s" }}/>
              </div>
            </div>
          </div>

          {/* SOIL SENSORS */}
          <div className="card">
            <div className="serif" style={{ fontSize:18, fontWeight:700, color:"#e8f5e9", marginBottom:2 }}>Cảm Biến Đất</div>
            <div className="label" style={{ marginBottom:12 }}>Đo Lường Thời Gian Thực</div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {[
                { label:"Độ Ẩm Đất",    val:data.sensors.soil, unit:"%",   color:"#4ade80", icon:"💧", max:100 },
                { label:"Độ pH",         val:data.sensors.ph,   unit:"pH",  color:"#fb923c", icon:"⚗️", max:14 },
                { label:"Nhiệt Độ Đất",  val:data.soil.temp,    unit:"°C",  color:"#f87171", icon:"🌡", max:50 },
              ].map((s,i) => (
                <div key={i} style={{ padding:"11px 13px", borderRadius:12, background:"#07120a", border:"1px solid #162515", display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:17 }}>{s.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:"#3d6e3d", marginBottom:5 }}>{s.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width:`${(s.val/s.max)*100}%`, background:`linear-gradient(90deg,${s.color}55,${s.color})` }}/>
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize:15, fontWeight:600, color:s.color, whiteSpace:"nowrap" }}>
                    {s.val}<span style={{ fontSize:9, color:"#3d6e3d" }}> {s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SYSTEM */}
          <div className="card">
            <div className="serif" style={{ fontSize:18, fontWeight:700, color:"#e8f5e9", marginBottom:2 }}>Hệ Thống</div>
            <div className="label" style={{ marginBottom:12 }}>Trạng Thái Thiết Bị</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { name:"Bơm Nước",    icon:"⚙️", status:"online", val:"2.4 bar" },
                { name:"Cảm Biến × 3",icon:"📡", status:"online", val:"3/3" },
                { name:"Camera",      icon:"📷", status:"warn",   val:"1/2" },
                { name:"Solar Panel", icon:"🔋", status:"online", val:"94%" },
              ].map((d,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, background:"#07120a", border:"1px solid #162515" }}>
                  <span style={{ fontSize:15 }}>{d.icon}</span>
                  <div style={{ flex:1, fontSize:12, color:"#c8e6c9", fontWeight:500 }}>{d.name}</div>
                  <div className="mono" style={{ fontSize:11, color:"#3d6e3d" }}>{d.val}</div>
                  <div style={{ width:6, height:6, borderRadius:"50%",
                    background:d.status==="online"?"#4ade80":"#fbbf24",
                    boxShadow:`0 0 5px ${d.status==="online"?"#4ade80":"#fbbf24"}`,
                    animation:d.status==="online"?"none":"blink 1.5s infinite" }}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
