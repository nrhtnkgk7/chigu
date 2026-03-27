import { useState, useEffect } from "react";

/* ── Supabase ── */
const SB_URL = "https://thukxeznpnwfqtoehyvc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRodWt4ZXpucG53ZnF0b2VoeXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzk1NTMsImV4cCI6MjA4ODQxNTU1M30._ZqXyb1slx-8WNmebptkeTNJdv-aUlJGRAwJZdsFkqo";
const sbBase = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` };

async function sbLoad() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/curry?id=eq.main`, { headers: sbBase });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d[0] ? d[0].data : null;
  } catch (e) { return null; }
}

async function sbSave(data) {
  const patch = await fetch(`${SB_URL}/rest/v1/curry?id=eq.main`, {
    method: "PATCH",
    headers: { ...sbBase, "Prefer": "return=representation" },
    body: JSON.stringify({ data }),
  });
  if (!patch.ok) {
    const msg = await patch.text().catch(() => "");
    throw new Error(`更新失敗(${patch.status}): ${msg}`);
  }
  const patched = await patch.json();
  if (!patched || patched.length === 0) {
    const post = await fetch(`${SB_URL}/rest/v1/curry`, {
      method: "POST",
      headers: { ...sbBase, "Prefer": "return=minimal" },
      body: JSON.stringify({ id: "main", data }),
    });
    if (!post.ok) {
      const msg = await post.text().catch(() => "");
      throw new Error(`登録失敗(${post.status}): ${msg}`);
    }
  }
}

const defaultIngredient = () => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  name: "", capacity: "", unit: "g", price: "", actualUse: "", note: "",
});

function calcIngredient(ing) {
  const capacity  = parseFloat(ing.capacity)  || 0;
  const price     = parseFloat(ing.price)     || 0;
  const actualUse = parseFloat(ing.actualUse) || 0;
  if (capacity <= 0 || actualUse <= 0) return { needed: 0, purchaseCost: 0, actualCost: 0, leftover: 0, leftoverCost: 0 };
  const needed      = Math.ceil(actualUse / capacity);
  const purchaseCost = needed * price;
  const actualCost  = Math.round(price * (actualUse / capacity));
  const leftover    = Math.round(capacity * needed - actualUse);
  const leftoverCost = Math.round(price * (leftover / capacity));
  return { needed, purchaseCost, actualCost, leftover, leftoverCost };
}

const UNITS = ["g", "kg", "ml", "L", "個", "枚", "本", "袋", "缶", "パック"];

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&display=swap');

  :root {
    --bg:        #fdf8f1;
    --surface:   #ffffff;
    --surface2:  #faf5ec;
    --border:    rgba(160,100,30,0.15);
    --border2:   rgba(160,100,30,0.25);
    --brown:     #2e1a08;
    --brown2:    #5a3412;
    --amber:     #c47c18;
    --amber-dim: rgba(196,124,24,0.12);
    --green:     #2a7a52;
    --green-dim: rgba(42,122,82,0.1);
    --muted:     #8a7060;
    --danger:    #c43030;
    --shadow-sm: 0 1px 4px rgba(80,40,0,0.07);
    --shadow-md: 0 3px 14px rgba(80,40,0,0.09);
    --r:         14px;
    --r-sm:      9px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--brown);
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Page fade-in ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .r-fade { animation: fadeUp 0.4s ease both; }
  .r-fade-1 { animation-delay: 0.05s; }
  .r-fade-2 { animation-delay: 0.10s; }
  .r-fade-3 { animation-delay: 0.15s; }
  .r-fade-4 { animation-delay: 0.20s; }

  /* ── Header ── */
  .r-header {
    position: sticky; top: 0; z-index: 200;
    height: 56px;
    padding: 0 18px;
    background: rgba(253,248,241,0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
  }
  .r-header-left { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
  .r-back {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 500;
    color: var(--muted);
    text-decoration: none;
    letter-spacing: 0.04em;
    transition: color 0.2s;
    white-space: nowrap;
  }
  .r-back:hover { color: var(--amber); }
  .r-back-arrow { font-size: 14px; line-height: 1; }

  .r-logo-wrap {}
  .r-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px; font-weight: 700;
    color: var(--brown2);
    letter-spacing: 0.03em;
    line-height: 1;
  }
  .r-logo-sub {
    font-size: 8px; font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-top: 1px;
    opacity: 0.7;
  }

  /* ── Save button ── */
  .r-save-btn {
    height: 36px;
    padding: 0 16px;
    border: none; border-radius: 18px;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    white-space: nowrap;
    background: var(--brown2);
    color: #fff;
    box-shadow: 0 2px 8px rgba(90,52,18,0.25);
    letter-spacing: 0.03em;
  }
  .r-save-btn:active { transform: scale(0.97); }
  .r-save-btn:disabled { background: #c0a880; box-shadow: none; cursor: not-allowed; }
  .r-save-btn.saving { background: var(--amber); }
  .r-save-btn.saved  { background: var(--green); box-shadow: 0 2px 8px rgba(42,122,82,0.3); }
  .r-save-btn.error  { background: var(--danger); }
  .r-error-msg {
    font-size: 10px; color: var(--danger);
    text-align: right; line-height: 1.3;
    max-width: 160px;
  }

  /* ── Main ── */
  .r-main {
    max-width: 680px;
    margin: 0 auto;
    padding: 28px 16px 100px;
  }

  /* ── Page title ── */
  .r-title-block { margin-bottom: 28px; }
  .r-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px; font-weight: 600;
    color: var(--brown);
    letter-spacing: 0.02em;
    line-height: 1.1;
  }
  .r-title-sub {
    font-size: 10px; font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-top: 5px;
    opacity: 0.75;
  }

  /* ── Section label ── */
  .r-section {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .r-section-text {
    font-size: 9px; font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.24em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .r-section-line {
    flex: 1; height: 1px;
    background: var(--border);
  }

  /* ── Summary grid ── */
  .r-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  @media (max-width: 500px) {
    .r-summary-grid {
      grid-template-columns: 1fr 1fr;
    }
    .r-summary-grid .r-sum-card:last-child {
      grid-column: 1 / -1;
    }
  }
  .r-sum-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 14px 16px 12px;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.2s;
  }
  .r-sum-card::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--amber), #e8a830);
    opacity: 0.6;
  }
  .r-sum-label {
    font-size: 8px; font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 7px;
    opacity: 0.8;
  }
  .r-sum-value {
    font-size: 20px; font-weight: 600;
    color: var(--brown);
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .r-sum-value .r-sum-actual {
    font-size: 14px; font-weight: 500;
    color: var(--muted);
    margin-left: 3px;
  }
  .r-sum-sub {
    font-size: 10px;
    color: var(--danger);
    margin-top: 5px;
    font-weight: 500;
    opacity: 0.8;
  }
  .r-sum-plain {
    font-size: 10px;
    color: var(--muted);
    margin-top: 5px;
    opacity: 0.75;
  }

  /* ── Servings row ── */
  .r-servings {
    display: flex; align-items: center; gap: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 14px 18px;
    margin-bottom: 24px;
    box-shadow: var(--shadow-sm);
  }
  .r-servings-label {
    flex: 1;
    font-size: 14px; font-weight: 500;
    color: var(--brown2);
  }
  .r-stepper {
    display: flex; align-items: center;
    border: 1.5px solid var(--border2);
    border-radius: 10px;
    overflow: hidden;
  }
  .r-step-btn {
    width: 44px; height: 44px;
    background: var(--amber-dim);
    border: none; color: var(--amber);
    font-size: 20px; line-height: 1;
    cursor: pointer;
    transition: background 0.15s;
    display: flex; align-items: center; justify-content: center;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }
  .r-step-btn:active { background: rgba(196,124,24,0.22); }
  .r-step-num {
    width: 52px; height: 44px;
    text-align: center;
    font-size: 18px; font-weight: 700;
    color: var(--brown);
    background: var(--surface);
    border: none;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
    outline: none;
    font-family: 'DM Sans', sans-serif;
    -webkit-appearance: none;
    appearance: none;
  }
  .r-servings-unit {
    font-size: 13px; color: var(--muted); font-weight: 400;
  }

  /* ── Ingredient cards ── */
  .r-ing-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }

  .r-ing-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--amber);
    border-radius: var(--r);
    padding: 16px 14px 14px;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .r-ing-card:focus-within {
    box-shadow: var(--shadow-md);
    border-color: rgba(160,100,30,0.3);
    border-left-color: var(--brown2);
  }

  /* Row 1: 材料名 + 削除 */
  .r-ing-row1 {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px;
  }
  .r-ing-name {
    flex: 1;
    height: 44px;
    padding: 0 12px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--brown);
    font-size: 16px; font-weight: 500;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    -webkit-appearance: none;
  }
  .r-ing-name:focus {
    border-color: var(--amber);
    background: #fff;
  }
  .r-ing-name::placeholder { color: rgba(140,100,40,0.3); font-weight: 300; }

  .r-del-btn {
    width: 36px; height: 36px;
    background: none;
    border: 1px solid rgba(180,60,40,0.2);
    border-radius: 8px;
    color: rgba(180,60,40,0.4);
    font-size: 16px; line-height: 1;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .r-del-btn:active { background: rgba(180,60,40,0.1); color: var(--danger); }

  /* Row 2: 入力グリッド */
  .r-ing-grid {
    display: grid;
    grid-template-columns: 1fr 80px 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  @media (max-width: 480px) {
    .r-ing-grid { grid-template-columns: 1fr 1fr; }
  }

  .r-field {}
  .r-field-label {
    display: block;
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.16em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 5px;
    opacity: 0.75;
  }
  .r-input {
    width: 100%; height: 44px;
    padding: 0 10px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--brown);
    font-size: 16px; font-weight: 400;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .r-input.num { text-align: right; }
  .r-input:focus { border-color: var(--amber); background: #fff; }
  .r-input::placeholder { color: rgba(140,100,40,0.28); font-weight: 300; }

  .r-select {
    width: 100%; height: 44px;
    padding: 0 8px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--brown);
    font-size: 16px; font-weight: 400;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
    text-align: center;
  }
  .r-select:focus { border-color: var(--amber); }

  /* ── Calc result box ── */
  .r-calc-box {
    background: linear-gradient(135deg, #fdf5e0 0%, #faf0d6 100%);
    border: 1px solid rgba(196,124,24,0.2);
    border-radius: var(--r-sm);
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  .r-calc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 16px;
  }
  .r-calc-item {}
  .r-calc-label {
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.14em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 3px;
    opacity: 0.8;
  }
  .r-calc-val {
    font-size: 16px; font-weight: 600;
    color: var(--brown2);
    line-height: 1.2;
  }
  .r-calc-val.green { color: var(--green); }
  .r-calc-val.muted { color: var(--muted); font-weight: 400; }
  .r-calc-val.danger { color: var(--danger); font-weight: 400; }

  /* ── Note + subtotal row ── */
  .r-ing-foot {
    display: flex; align-items: center; gap: 10px;
  }
  .r-note {
    flex: 1;
    height: 40px;
    padding: 0 10px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--brown);
    font-size: 14px; font-weight: 300;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    outline: none;
    -webkit-appearance: none;
  }
  .r-note::placeholder { color: rgba(140,100,40,0.28); font-size: 13px; }
  .r-subtotal {
    font-size: 13px; font-weight: 600;
    color: var(--amber);
    white-space: nowrap;
    letter-spacing: 0.02em;
  }

  /* ── Total row ── */
  .r-total-row {
    display: flex; align-items: baseline;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 2px 4px;
    margin-bottom: 12px;
  }
  .r-total-label {
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--muted); opacity: 0.75;
  }
  .r-total-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px; font-weight: 600;
    color: var(--brown);
    letter-spacing: -0.01em;
  }

  /* ── Add button ── */
  .r-add-btn {
    width: 100%; height: 48px;
    background: transparent;
    border: 1.5px dashed rgba(160,100,30,0.25);
    border-radius: var(--r);
    color: var(--muted);
    font-size: 13px; font-weight: 500;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    margin-bottom: 28px;
    -webkit-tap-highlight-color: transparent;
  }
  .r-add-btn:active {
    background: var(--amber-dim);
    color: var(--amber);
    border-color: var(--amber);
  }

  /* ── Divider ── */
  .r-divider {
    height: 1px;
    background: var(--border);
    margin: 24px 0;
  }

  /* ── Recipe textarea ── */
  .r-recipe {
    width: 100%;
    min-height: 180px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r);
    color: var(--brown);
    padding: 16px;
    font-size: 15px; font-weight: 300;
    font-family: 'DM Sans', 'Noto Sans JP', sans-serif;
    line-height: 1.85;
    outline: none; resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-shadow: var(--shadow-sm);
    -webkit-appearance: none;
  }
  .r-recipe:focus {
    border-color: var(--border2);
    box-shadow: var(--shadow-md);
  }
  .r-recipe::placeholder { color: rgba(140,100,40,0.25); }

  /* ── Loading ── */
  .r-loading {
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 14px;
    padding: 80px 20px;
    color: var(--muted);
    font-size: 13px; letter-spacing: 0.1em;
    opacity: 0.7;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .r-spinner {
    width: 28px; height: 28px;
    border: 2px solid var(--border);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
`;

/* ─────────────────────────────────────────
   COMPONENT
───────────────────────────────────────── */
export default function CurryCalculator() {
  const [ingredients, setIngredients] = useState([defaultIngredient()]);
  const [servings, setServings]       = useState(4);
  const [recipe, setRecipe]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [saveState, setSaveState]     = useState("idle");
  const [errorMsg, setErrorMsg]       = useState("");

  useEffect(() => {
    sbLoad().then(d => {
      if (d) {
        if (d.ingredients?.length > 0) setIngredients(d.ingredients);
        if (d.servings)                setServings(d.servings);
        if (d.recipe !== undefined)    setRecipe(d.recipe);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await sbSave({ ingredients, servings, recipe });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveState("error");
      setErrorMsg(e.message || "不明なエラー");
      setTimeout(() => { setSaveState("idle"); setErrorMsg(""); }, 5000);
    }
  };

  const updateIngredient = (id, field, value) =>
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  const addIngredient    = () => setIngredients(prev => [...prev, defaultIngredient()]);
  const removeIngredient = (id) => setIngredients(prev => prev.filter(i => i.id !== id));

  const totalCost             = ingredients.reduce((s, i) => s + calcIngredient(i).purchaseCost, 0);
  const totalActual           = ingredients.reduce((s, i) => s + calcIngredient(i).actualCost,   0);
  const totalLoss             = totalCost - totalActual;
  const costPerPerson         = servings > 0 ? Math.ceil(totalActual / servings)   : 0;
  const purchaseCostPerPerson = servings > 0 ? Math.ceil(totalCost   / servings)   : 0;
  const lossPerPerson         = purchaseCostPerPerson - costPerPerson;

  const capPerPersonStr = () => {
    const byUnit = {};
    ingredients.forEach(i => {
      if (!i.name || !i.actualUse) return;
      const u = i.unit || "g";
      const v = parseFloat(i.actualUse) || 0;
      if (v > 0) byUnit[u] = (byUnit[u] || 0) + v;
    });
    if (servings <= 0 || Object.keys(byUnit).length === 0) return "—";
    return Object.entries(byUnit).map(([u, v]) => `${(v / servings).toFixed(1)}${u}`).join(" + ");
  };

  const saveLabel =
    saveState === "saving" ? "保存中…" :
    saveState === "saved"  ? "✓ 保存済み" :
    saveState === "error"  ? "⚠ エラー" : "保存";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* ── Header ── */}
      <header className="r-header">
        <div className="r-header-left">
          <a href="/" className="r-back">
            <span className="r-back-arrow">←</span>
            <span>案件管理</span>
          </a>
          <div className="r-logo-wrap">
            <div className="r-logo">chigu</div>
            <div className="r-logo-sub">Recipe Studio</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
          <button
            className={`r-save-btn ${saveState}`}
            onClick={handleSave}
            disabled={saveState === "saving" || loading}
          >{saveLabel}</button>
          {errorMsg && <div className="r-error-msg">{errorMsg}</div>}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="r-main">
        {loading ? (
          <div className="r-loading">
            <div className="r-spinner" />
            <span>読み込み中</span>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="r-title-block r-fade">
              <h1 className="r-title">Curry Recipe</h1>
              <div className="r-title-sub">Cost Calculator & Recipe Notes</div>
            </div>

            {/* Summary */}
            <div className="r-summary-grid r-fade r-fade-1">
              <div className="r-sum-card">
                <div className="r-sum-label">Total Cost</div>
                <div className="r-sum-value">
                  ¥{totalCost.toLocaleString()}
                  <span className="r-sum-actual">(実 ¥{totalActual.toLocaleString()})</span>
                </div>
                {totalLoss > 0
                  ? <div className="r-sum-sub">(損 ¥{totalLoss.toLocaleString()})</div>
                  : <div className="r-sum-plain">材料費合計</div>
                }
              </div>
              <div className="r-sum-card">
                <div className="r-sum-label">Cost / Person</div>
                <div className="r-sum-value">
                  ¥{purchaseCostPerPerson.toLocaleString()}
                  <span className="r-sum-actual">(実 ¥{costPerPerson.toLocaleString()})</span>
                </div>
                {lossPerPerson > 0
                  ? <div className="r-sum-sub">(損 ¥{lossPerPerson.toLocaleString()})</div>
                  : <div className="r-sum-plain">1人あたり原価</div>
                }
              </div>
              <div className="r-sum-card">
                <div className="r-sum-label">Amount / Person</div>
                <div className="r-sum-value" style={{ fontSize: capPerPersonStr().length > 9 ? 15 : 20 }}>
                  {capPerPersonStr()}
                </div>
                <div className="r-sum-plain">1人あたりの量</div>
              </div>
            </div>

            {/* Servings */}
            <div className="r-fade r-fade-2">
              <div className="r-section" style={{ marginBottom: 12 }}>
                <span className="r-section-text">人数設定</span>
                <div className="r-section-line" />
              </div>
              <div className="r-servings">
                <span className="r-servings-label">作る人数</span>
                <div className="r-stepper">
                  <button className="r-step-btn" onClick={() => setServings(s => Math.max(1, s - 1))}>−</button>
                  <input
                    className="r-step-num"
                    type="number" min="1"
                    value={servings}
                    onChange={e => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button className="r-step-btn" onClick={() => setServings(s => s + 1)}>＋</button>
                </div>
                <span className="r-servings-unit">人分</span>
              </div>
            </div>

            {/* Ingredients */}
            <div className="r-fade r-fade-3" style={{ marginTop: 24 }}>
              <div className="r-section" style={{ marginBottom: 12 }}>
                <span className="r-section-text">購入材料</span>
                <div className="r-section-line" />
              </div>

              <div className="r-ing-list">
                {ingredients.map((ing) => {
                  const c = calcIngredient(ing);
                  return (
                    <div className="r-ing-card" key={ing.id}>

                      {/* 材料名 + 削除 */}
                      <div className="r-ing-row1">
                        <input
                          className="r-ing-name"
                          placeholder="材料名（例：ココナッツ缶）"
                          value={ing.name}
                          onChange={e => updateIngredient(ing.id, "name", e.target.value)}
                        />
                        <button className="r-del-btn" onClick={() => removeIngredient(ing.id)}>×</button>
                      </div>

                      {/* 入力グリッド */}
                      <div className="r-ing-grid">
                        <div className="r-field">
                          <label className="r-field-label">販売容量</label>
                          <input className="r-input num" type="number" min="0" placeholder="235"
                            value={ing.capacity} onChange={e => updateIngredient(ing.id, "capacity", e.target.value)} />
                        </div>
                        <div className="r-field">
                          <label className="r-field-label">単位</label>
                          <select className="r-select" value={ing.unit}
                            onChange={e => updateIngredient(ing.id, "unit", e.target.value)}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="r-field">
                          <label className="r-field-label">1個の値段（円）</label>
                          <input className="r-input num" type="number" min="0" placeholder="200"
                            value={ing.price} onChange={e => updateIngredient(ing.id, "price", e.target.value)} />
                        </div>
                        <div className="r-field">
                          <label className="r-field-label">実際に使う量</label>
                          <input className="r-input num" type="number" min="0" placeholder="200"
                            value={ing.actualUse} onChange={e => updateIngredient(ing.id, "actualUse", e.target.value)} />
                        </div>
                      </div>

                      {/* 計算結果 */}
                      {c.needed > 0 && (
                        <div className="r-calc-box">
                          <div className="r-calc-grid">
                            <div className="r-calc-item">
                              <div className="r-calc-label">必要購入数</div>
                              <div className="r-calc-val green">{c.needed} 個</div>
                            </div>
                            <div className="r-calc-item">
                              <div className="r-calc-label">購入原価</div>
                              <div className="r-calc-val">¥{c.purchaseCost.toLocaleString()}</div>
                            </div>
                            <div className="r-calc-item">
                              <div className="r-calc-label">実原価</div>
                              <div className="r-calc-val green">¥{c.actualCost.toLocaleString()}</div>
                            </div>
                            <div className="r-calc-item">
                              <div className="r-calc-label">余り量 / 余り原価</div>
                              <div className="r-calc-val muted">
                                {c.leftover}{ing.unit}
                                <span className="r-calc-val danger" style={{marginLeft:6,fontSize:13}}>
                                  ¥{c.leftoverCost.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 備考 + 小計 */}
                      <div className="r-ing-foot">
                        <input className="r-note" placeholder="備考（産地・ブランドなど）"
                          value={ing.note} onChange={e => updateIngredient(ing.id, "note", e.target.value)} />
                        {c.needed > 0 &&
                          <div className="r-subtotal">¥{c.purchaseCost.toLocaleString()}</div>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 合計 */}
              <div className="r-total-row">
                <span className="r-total-label">Total</span>
                <span className="r-total-value">¥{totalCost.toLocaleString()}</span>
              </div>

              <button className="r-add-btn" onClick={addIngredient}>＋ 材料を追加</button>
            </div>

            {/* Recipe */}
            <div className="r-fade r-fade-4">
              <div className="r-divider" />
              <div className="r-section" style={{ marginBottom: 12 }}>
                <span className="r-section-text">レシピ手順</span>
                <div className="r-section-line" />
              </div>
              <textarea
                className="r-recipe"
                placeholder="レシピの手順、コツ、メモなどを自由に記入..."
                value={recipe}
                onChange={e => setRecipe(e.target.value)}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
