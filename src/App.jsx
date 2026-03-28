import React, { useMemo, useRef, useState } from "react";

const SYMBOLS = [
  { id: "gpo", short: "GPO", label: "General Power Outlet" },
  { id: "dbl_gpo", short: "2GPO", label: "Double GPO" },
  { id: "switch", short: "SW", label: "Switch" },
  { id: "dimmer", short: "DIM", label: "Dimmer" },
  { id: "downlight", short: "DL", label: "Downlight" },
  { id: "pendant", short: "P", label: "Pendant" },
  { id: "data", short: "DATA", label: "Data Point" },
  { id: "tv", short: "TV", label: "TV Point" },
  { id: "smoke", short: "SA", label: "Smoke Alarm" }
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function downloadFile(name, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function hitItem(item, x, y) {
  if (item.type === "symbol") return Math.hypot(item.x - x, item.y - y) < 24;
  if (item.type === "note") return x >= item.x - 8 && x <= item.x + 220 && y >= item.y - 28 && y <= item.y + 8;
  if (item.type === "callout") return x >= item.x - 20 && x <= item.x + 260 && y >= item.y - 30 && y <= item.y + 20;
  return false;
}

export default function App() {
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);

  const [builderName, setBuilderName] = useState("R J Hill Homes");
  const [projectName, setProjectName] = useState("Electrical Review");
  const [clientName, setClientName] = useState("Client Name");
  const [revision, setRevision] = useState("Rev A");
  const [planImage, setPlanImage] = useState(null);

  const [mode, setMode] = useState("symbol");
  const [selectedSymbolId, setSelectedSymbolId] = useState("dbl_gpo");
  const [noteDraft, setNoteDraft] = useState("Check with client");
  const [calloutDraft, setCalloutDraft] = useState("Confirm before rough-in");
  const [siteNotes, setSiteNotes] = useState("Builder notes:\\n- Confirm feature lighting heights\\n- Check joinery coordination\\n- Review exterior lighting on site");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);

  const canvas = { width: 1600, height: 1000 };
  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const selectedSymbol = SYMBOLS.find((s) => s.id === selectedSymbolId) || SYMBOLS[0];
  const variations = useMemo(() => items.filter((item) => item.variation), [items]);
  const variationTotal = useMemo(() => variations.reduce((sum, item) => sum + Number(item.cost || 0), 0), [variations]);

  function getPoint(event) {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPlanClick(event) {
    const point = getPoint(event);

    if (mode === "select") {
      const found = [...items].reverse().find((item) => hitItem(item, point.x, point.y));
      setSelectedId(found ? found.id : null);
      return;
    }

    if (mode === "symbol") {
      const item = {
        id: uid(),
        type: "symbol",
        x: point.x,
        y: point.y,
        short: selectedSymbol.short,
        label: selectedSymbol.label,
        description: "",
        variation: false,
        cost: "",
        status: "pending"
      };
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
      return;
    }

    if (mode === "note") {
      const item = {
        id: uid(),
        type: "note",
        x: point.x,
        y: point.y,
        text: noteDraft,
        description: noteDraft,
        variation: false,
        cost: "",
        status: "pending"
      };
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
      return;
    }

    if (mode === "callout") {
      const number = items.filter((item) => item.type === "callout").length + 1;
      const item = {
        id: uid(),
        type: "callout",
        x: point.x,
        y: point.y,
        number,
        text: calloutDraft,
        description: calloutDraft,
        variation: true,
        cost: "",
        status: "pending"
      };
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
    }
  }

  function updateSelected(field, value) {
    if (!selectedId) return;
    setItems((prev) => prev.map((item) => (item.id === selectedId ? { ...item, [field]: value } : item)));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setItems((prev) => prev.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  function onUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPlanImage(e.target.result);
    reader.readAsDataURL(file);
  }

  function exportReview() {
    const data = {
      builderName,
      projectName,
      clientName,
      revision,
      siteNotes,
      items
    };
    downloadFile("electrical-review.json", JSON.stringify(data, null, 2), "application/json");
  }

  function printPack() {
    const rows = variations.length
      ? variations.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.label || item.text || item.type}</td>
          <td>${item.description || item.text || ""}</td>
          <td>$${item.cost || 0}</td>
          <td>${item.status || "pending"}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#6b7280;">No variations tagged</td></tr>`;

    const svgMarkup = svgRef.current ? new XMLSerializer().serializeToString(svgRef.current) : "";
    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${projectName} - Electrical Pack</title>
          <style>
            @page { size: A3 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #16202a; margin: 0; }
            .sheet { padding: 8mm; }
            .top { display:grid; grid-template-columns:1.4fr 1fr; gap:12px; margin-bottom:12px; }
            .box { border:2px solid #d9e1e8; border-radius:14px; overflow:hidden; background:white; }
            .head { background:#eef3f7; padding:10px 14px; font-weight:800; }
            .pad { padding:14px; }
            .brand { font-size:28px; font-weight:800; margin-bottom:8px; }
            .muted { color:#6b7280; }
            .layout { display:grid; grid-template-columns:1.6fr 0.9fr; gap:12px; }
            .legend { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px; }
            .legend div { border:1px solid #e5e7eb; border-radius:10px; padding:8px; }
            table { width:100%; border-collapse:collapse; font-size:11px; }
            th, td { padding:8px 6px; border-top:1px solid #e5e7eb; text-align:left; vertical-align:top; }
            th { background:#f8fafc; font-size:10px; text-transform:uppercase; }
            .sign { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:20px; }
            .line { border-top:1px solid #16202a; padding-top:6px; font-size:11px; }
            svg { width:100%; height:auto; display:block; background:white; }
            .notes { white-space:pre-wrap; line-height:1.5; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div class="box"><div class="pad"><div class="brand">${builderName}</div><div style="font-size:18px;font-weight:700;">${projectName}</div><div class="muted">Electrical review · client selections · site coordination</div></div></div>
              <div class="box"><div class="head">Project Details</div><div class="pad">
                <div><span class="muted">Client:</span> ${clientName}</div>
                <div><span class="muted">Revision:</span> ${revision}</div>
                <div><span class="muted">Date:</span> ${new Date().toLocaleDateString()}</div>
                <div><span class="muted">Variation Total:</span> $${variationTotal}</div>
              </div></div>
            </div>

            <div class="layout">
              <div class="box"><div class="head">Marked Up Plan</div><div class="pad">${svgMarkup}</div></div>
              <div style="display:grid; gap:12px;">
                <div class="box"><div class="head">Legend</div><div class="pad legend">
                  ${SYMBOLS.map(s => `<div><b>${s.short}</b><br>${s.label}</div>`).join("")}
                </div></div>
                <div class="box"><div class="head">Builder Notes</div><div class="pad notes">${siteNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>
              </div>
            </div>

            <div class="box" style="margin-top:12px;">
              <div class="head">Variation Schedule</div>
              <div class="pad">
                <table>
                  <thead><tr><th>#</th><th>Item</th><th>Description</th><th>Cost</th><th>Status</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
                <div class="sign">
                  <div class="line">Client signature</div>
                  <div class="line">Date</div>
                </div>
              </div>
            </div>
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function renderItem(item) {
    if (item.type === "symbol") {
      return (
        <g key={item.id}>
          <circle cx={item.x} cy={item.y} r="19" fill={item.variation ? "#1f6fb8" : "white"} stroke="#16202a" strokeWidth="2.8" />
          <text x={item.x} y={item.y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={item.variation ? "white" : "#16202a"}>{item.short}</text>
          {selectedId === item.id && <circle cx={item.x} cy={item.y} r="26" fill="none" stroke="#1f6fb8" strokeWidth="3" strokeDasharray="6 5" />}
        </g>
      );
    }
    if (item.type === "note") {
      return (
        <g key={item.id}>
          <text x={item.x} y={item.y} fontSize="20" fontWeight="700" fill="#16202a">{item.text}</text>
          {selectedId === item.id && <rect x={item.x - 8} y={item.y - 24} width="240" height="36" rx="8" fill="none" stroke="#1f6fb8" strokeWidth="2" strokeDasharray="6 5" />}
        </g>
      );
    }
    if (item.type === "callout") {
      return (
        <g key={item.id}>
          <circle cx={item.x} cy={item.y} r="18" fill="#1f6fb8" stroke="#16202a" strokeWidth="2.5" />
          <text x={item.x} y={item.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="white">{item.number}</text>
          <rect x={item.x + 24} y={item.y - 18} width="220" height="36" rx="10" fill="white" stroke="#1f6fb8" strokeWidth="2.5" />
          <text x={item.x + 36} y={item.y + 4} fontSize="12" fontWeight="700" fill="#16202a">{item.text}</text>
          {selectedId === item.id && <rect x={item.x - 8} y={item.y - 26} width="258" height="52" rx="10" fill="none" stroke="#1f6fb8" strokeWidth="2" strokeDasharray="6 5" />}
        </g>
      );
    }
    return null;
  }

  return (
    <div className="page">
      <div className="topbar card">
        <div>
          <div className="brand-eyebrow">R J Hill Homes</div>
          <h1>Electrical Markup Tool</h1>
          <p className="subtext">Built for iPad meetings, site reviews and client sign-off.</p>
        </div>
        <div className="top-actions">
          <button className="btn dark" onClick={() => fileInputRef.current?.click()}>Upload Plan</button>
          <button className="btn" onClick={exportReview}>Save Review</button>
          <button className="btn blue" onClick={printPack}>Print A3 Pack</button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files?.[0])} />
        </div>
      </div>

      <div className="layout-main">
        <aside className="side">
          <section className="card">
            <h2>Project</h2>
            <label>Builder<input value={builderName} onChange={(e) => setBuilderName(e.target.value)} /></label>
            <label>Project<input value={projectName} onChange={(e) => setProjectName(e.target.value)} /></label>
            <div className="two-col">
              <label>Client<input value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
              <label>Revision<input value={revision} onChange={(e) => setRevision(e.target.value)} /></label>
            </div>
          </section>

          <section className="card">
            <h2>Tools</h2>
            <div className="tool-grid">
              <button className={mode === "select" ? "tool active" : "tool"} onClick={() => setMode("select")}>Select</button>
              <button className={mode === "symbol" ? "tool active" : "tool"} onClick={() => setMode("symbol")}>Symbol</button>
              <button className={mode === "note" ? "tool active" : "tool"} onClick={() => setMode("note")}>Note</button>
              <button className={mode === "callout" ? "tool active" : "tool"} onClick={() => setMode("callout")}>Callout</button>
            </div>
            <div className="zoom-row">
              <span>Zoom</span>
              <div className="zoom-buttons">
                <button className="mini" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}>-</button>
                <span className="zoom-badge">{Math.round(zoom * 100)}%</span>
                <button className="mini" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}>+</button>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Symbols</h2>
            <div className="symbol-list">
              {SYMBOLS.map((symbol) => (
                <button key={symbol.id} className={selectedSymbolId === symbol.id ? "symbol-item active" : "symbol-item"} onClick={() => { setSelectedSymbolId(symbol.id); setMode("symbol"); }}>
                  <span className="symbol-short">{symbol.short}</span>
                  <span><strong>{symbol.label}</strong></span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="card workspace-card">
          <div className="workspace-head">
            <div>
              <h2>Plan Workspace</h2>
              <p className="subtext">Tap the plan to place symbols, notes or variation callouts.</p>
            </div>
            <div className="badge">${variationTotal} variations</div>
          </div>

          <div className="workspace-scroll">
            <div style={{ width: canvas.width * zoom, height: canvas.height * zoom }}>
              <svg ref={svgRef} viewBox={`0 0 ${canvas.width} ${canvas.height}`} className="workspace-canvas" style={{ width: canvas.width * zoom, height: canvas.height * zoom }} onPointerDown={onPlanClick}>
                {planImage ? (
                  <image href={planImage} x="0" y="0" width={canvas.width} height={canvas.height} preserveAspectRatio="xMidYMid meet" />
                ) : (
                  <>
                    <rect x="0" y="0" width={canvas.width} height={canvas.height} fill="#f8fafc" />
                    <defs>
                      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    <text x="50%" y="45%" textAnchor="middle" fontSize="34" fontWeight="800" fill="#334155">Upload a plan image to begin</text>
                    <text x="50%" y="50%" textAnchor="middle" fontSize="18" fill="#64748b">JPG or PNG works best for meetings and site reviews</text>
                  </>
                )}

                <rect x="18" y="18" width="390" height="88" rx="18" fill="white" stroke="#cbd5e1" />
                <text x="34" y="46" fontSize="18" fontWeight="800" fill="#16202a">{builderName}</text>
                <text x="34" y="70" fontSize="14" fontWeight="700" fill="#475569">{projectName}</text>
                <text x="34" y="91" fontSize="12" fill="#64748b">Client: {clientName} · {revision}</text>

                {items.map(renderItem)}
              </svg>
            </div>
          </div>
        </main>

        <aside className="side">
          <section className="card">
            <h2>Selected Item</h2>
            {selectedItem ? (
              <>
                <div className="pill-row">
                  <span className="pill">{selectedItem.label || selectedItem.text || selectedItem.type}</span>
                  <button className="btn small danger" onClick={deleteSelected}>Delete</button>
                </div>
                <label>Description<input value={selectedItem.description || ""} onChange={(e) => updateSelected("description", e.target.value)} /></label>
                {(selectedItem.type === "note" || selectedItem.type === "callout") && (
                  <label>Displayed text<input value={selectedItem.text || ""} onChange={(e) => updateSelected("text", e.target.value)} /></label>
                )}
                <label className="checkbox-row">
                  <input type="checkbox" checked={!!selectedItem.variation} onChange={(e) => updateSelected("variation", e.target.checked)} />
                  Mark as variation
                </label>
                <div className="two-col">
                  <label>Cost ($)<input value={selectedItem.cost || ""} onChange={(e) => updateSelected("cost", e.target.value)} /></label>
                  <label>Status
                    <select value={selectedItem.status || "pending"} onChange={(e) => updateSelected("status", e.target.value)}>
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </label>
                </div>
              </>
            ) : (
              <p className="empty-text">Use Select mode, then tap an item on the plan.</p>
            )}
          </section>

          <section className="card">
            <h2>Notes & Callouts</h2>
            <label>New note<input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} /></label>
            <label>New callout<input value={calloutDraft} onChange={(e) => setCalloutDraft(e.target.value)} /></label>
            <label>Site notes<textarea value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} rows={6} /></label>
          </section>

          <section className="card">
            <h2>Variation List</h2>
            <div className="variation-list">
              {variations.length ? variations.map((item, index) => (
                <button key={item.id} className="variation-item" onClick={() => setSelectedId(item.id)}>
                  <div className="variation-top">
                    <strong>{index + 1}. {item.label || item.text || item.type}</strong>
                    <span className={`status ${item.status || "pending"}`}>{item.status || "pending"}</span>
                  </div>
                  <small>{item.description || item.text || "No description yet"}</small>
                  <div className="price">${item.cost || 0}</div>
                </button>
              )) : <p className="empty-text">No variations tagged yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

