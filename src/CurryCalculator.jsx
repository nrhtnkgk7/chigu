import { useState, useEffect } from "react";

/* ── Supabase ── */
const SB_URL = "https://thukhxeznpnwfqtoehyvc.supabase.co";
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
  // DELETE → INSERT でupsert（最も確実）
  await fetch(`${SB_URL}/rest/v1/curry?id=eq.main`, {
    method: "DELETE",
    headers: sbBase,
  });
  const r = await fetch(`${SB_URL}/rest/v1/curry`, {
    method: "POST",
    headers: { ...sbBase, "Prefer": "return=minimal" },
    body: JSON.stringify({ id: "main", data }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "不明なエラー");
    throw new Error(msg);
  }
}

const defaultIngredient = () => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  name: "",
  capacity: "",
  unit: "g",
  price: "",
  quantity: "1",
  note: "",
});

const UNITS = ["g", "kg", "ml", "L", "個", "枚", "本", "袋", "缶", "パック"];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Playfair+Display:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #faf7f2;
    color: #3a2e1e;
    font-family: 'Noto Sans JP', sans-serif;
    min-height: 100vh;
  }

  .curry-app { min-height: 100vh; background: #faf7f2; }

  /* ── Header ── */
  .c-header {
    border-bottom: 1px solid rgba(180,120,40,0.2);
    padding: 0 20px;
    background: rgba(250,247,242,0.97);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }
  .c-header-left { display: flex; align-items: center; gap: 20px; }
  .c-back {
    color: rgba(160,110,40,0.75);
    font-size: 12px;
    text-decoration: none;
    letter-spacing: 0.06em;
    font-weight: 500;
    transition: color 0.2s;
  }
  .c-back:hover { color: #a06820; }
  .c-logo {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    color: #7a4e10;
    letter-spacing: 0.04em;
    line-height: 1;
  }
  .c-logo-sub {
    font-size: 9px;
    color: rgba(140,90,30,0.5);
    letter-spacing: 0.16em;
    font-weight: 300;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* ── Save Button ── */
  .btn-save {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: #7a4e10;
    color: #fff;
    border: none;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Noto Sans JP', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .btn-save:hover { background: #5c3a0a; }
  .btn-save:disabled { background: #c8a878; cursor: not-allowed; }
  .btn-save.saving { background: #a06820; }
  .btn-save.saved { background: #2a8a5a; }
  .btn-save.error { background: #d04440; }

  /* ── Main ── */
  .c-main { max-width: 720px; margin: 0 auto; padding: 32px 16px 80px; }

  .c-page-title { margin-bottom: 32px; }
  .c-page-title h1 {
    font-family: 'Playfair Display', serif;
    font-size: 26px;
    font-weight: 400;
    color: #4a3010;
    letter-spacing: 0.04em;
  }
  .c-subtitle {
    font-size: 11px;
    color: rgba(140,100,40,0.6);
    letter-spacing: 0.14em;
    margin-top: 4px;
    font-weight: 300;
  }

  /* ── Section label ── */
  .c-section-label {
    font-size: 10px;
    letter-spacing: 0.2em;
    color: rgba(140,100,40,0.65);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .c-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(180,120,40,0.2);
  }

  /* ── Summary Cards ── */
  .c-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 28px;
  }
  @media (max-width: 480px) {
    .c-summary-grid { grid-template-columns: 1fr 1fr; }
    .c-summary-grid .c-summary-card:last-child { grid-column: 1 / -1; }
  }
  .c-summary-card {
    background: #fff;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 12px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 6px rgba(120,70,10,0.06);
  }
  .c-summary-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #c8882a, #e8a838, #c8882a);
  }
  .sl { font-size: 9px; letter-spacing: 0.18em; color: rgba(140,100,40,0.6); font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
  .sv { font-size: 22px; font-weight: 700; color: #3a2010; line-height: 1; }
  .ss { font-size: 11px; color: rgba(120,80,30,0.5); margin-top: 5px; }

  /* ── Servings ── */
  .c-servings-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    background: #fff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    margin-bottom: 28px;
    box-shadow: 0 1px 6px rgba(120,70,10,0.06);
  }
  .c-servings-label { font-size: 13px; color: #4a3010; font-weight: 500; flex: 1; }
  .c-stepper { display: flex; align-items: center; border: 1px solid rgba(180,120,40,0.3); border-radius: 8px; overflow: hidden; }
  .c-step-btn {
    width: 38px; height: 38px;
    background: rgba(200,136,42,0.1);
    border: none; color: #a06820; font-size: 20px;
    cursor: pointer; transition: background 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .c-step-btn:hover { background: rgba(200,136,42,0.22); }
  .c-step-num {
    width: 52px; text-align: center;
    font-size: 18px; font-weight: 700; color: #3a2010;
    background: #fffdf8;
    border: none;
    border-left: 1px solid rgba(180,120,40,0.2);
    border-right: 1px solid rgba(180,120,40,0.2);
    padding: 8px 0; outline: none;
  }
  .c-servings-unit { font-size: 13px; color: rgba(140,100,40,0.6); }

  /* ── Ingredient Cards ── */
  .c-ing-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }

  .c-ing-card {
    background: #fff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 1px 6px rgba(120,70,10,0.05);
  }

  .c-ing-row1 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .c-ing-name {
    flex: 1;
    padding: 9px 12px;
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 8px;
    color: #3a2e1e;
    font-size: 15px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
  }
  .c-ing-name:focus { border-color: rgba(180,120,40,0.55); background: #fff9ee; }
  .c-ing-name::placeholder { color: rgba(140,100,40,0.3); }

  .c-ing-row2 {
    display: grid;
    grid-template-columns: 2fr 1.2fr 2fr 1.2fr;
    gap: 8px;
    margin-bottom: 10px;
  }
  @media (max-width: 400px) {
    .c-ing-row2 { grid-template-columns: 1fr 1fr; }
  }
  .c-ing-field label {
    display: block;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: rgba(140,100,40,0.55);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .c-ing-input {
    width: 100%;
    padding: 8px 10px;
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 8px;
    color: #3a2e1e;
    font-size: 14px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
  }
  .c-ing-input:focus { border-color: rgba(180,120,40,0.55); background: #fff9ee; }
  .c-ing-input.num { text-align: right; }
  .c-ing-select {
    width: 100%;
    padding: 8px 10px;
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 8px;
    color: #3a2e1e;
    font-size: 14px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .c-ing-row3 { display: flex; flex-direction: column; gap: 8px; }
  .c-ing-note {
    width: 100%;
    padding: 7px 10px;
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.15);
    border-radius: 8px;
    color: #3a2e1e;
    font-size: 13px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    -webkit-appearance: none;
  }
  .c-ing-note::placeholder { color: rgba(140,100,40,0.28); font-size: 12px; }
  .c-ing-subtotal {
    font-size: 15px;
    font-weight: 700;
    color: #9a6010;
    text-align: right;
    padding-right: 2px;
  }

  .c-btn-del {
    width: 30px; height: 30px;
    background: none;
    border: 1px solid rgba(200,80,60,0.2);
    border-radius: 8px;
    color: rgba(200,80,60,0.45);
    font-size: 15px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0;
  }
  .c-btn-del:hover { background: rgba(200,80,60,0.1); color: #c04030; border-color: rgba(200,80,60,0.4); }

  .c-total-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding: 14px 4px 4px;
  }
  .c-total-label { font-size: 11px; letter-spacing: 0.14em; color: rgba(120,80,30,0.6); font-weight: 600; }
  .c-total-value { font-size: 22px; font-weight: 700; color: #3a2010; }

  .c-btn-add {
    width: 100%;
    padding: 13px;
    background: transparent;
    border: 1px dashed rgba(180,120,40,0.3);
    border-radius: 12px;
    color: rgba(140,90,30,0.65);
    font-size: 13px;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 500;
    margin-bottom: 28px;
  }
  .c-btn-add:hover { background: rgba(180,120,40,0.06); color: #a06820; border-color: rgba(180,120,40,0.5); }

  .c-divider { height: 1px; background: rgba(180,120,40,0.15); margin: 28px 0; }

  .c-recipe {
    width: 100%;
    min-height: 200px;
    background: #fff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    color: #3a2e1e;
    padding: 18px;
    font-size: 14px;
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 300;
    line-height: 1.9;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s;
    box-shadow: 0 1px 6px rgba(120,70,10,0.05);
  }
  .c-recipe:focus { border-color: rgba(180,120,40,0.45); }
  .c-recipe::placeholder { color: rgba(140,100,40,0.28); }

  .c-loading {
    text-align: center;
    padding: 60px 20px;
    color: rgba(140,100,40,0.55);
    font-size: 13px;
    letter-spacing: 0.1em;
  }
`;

export default function CurryCalculator() {
  const [ingredients, setIngredients] = useState([defaultIngredient()]);
  const [servings, setServings] = useState(4);
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  useEffect(() => {
    sbLoad().then(d => {
      if (d) {
        if (d.ingredients?.length > 0) setIngredients(d.ingredients);
        if (d.servings) setServings(d.servings);
        if (d.recipe !== undefined) setRecipe(d.recipe);
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
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const updateIngredient = (id, field, value) =>
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  const addIngredient = () => setIngredients(prev => [...prev, defaultIngredient()]);
  const removeIngredient = (id) => setIngredients(prev => prev.filter(i => i.id !== id));

  const getSubtotal = (ing) => (parseFloat(ing.price) || 0) * (parseFloat(ing.quantity) || 0);
  const totalCost = ingredients.reduce((s, i) => s + getSubtotal(i), 0);
  const costPerPerson = servings > 0 ? Math.ceil(totalCost / servings) : 0;

  const capPerPersonStr = () => {
    const byUnit = {};
    ingredients.forEach(i => {
      if (!i.name || !i.capacity) return;
      const u = i.unit || "g";
      const cap = (parseFloat(i.capacity) || 0) * (parseFloat(i.quantity) || 0);
      if (cap > 0) byUnit[u] = (byUnit[u] || 0) + cap;
    });
    if (servings <= 0 || Object.keys(byUnit).length === 0) return "—";
    return Object.entries(byUnit).map(([u, v]) => `${(v / servings).toFixed(1)}${u}`).join(" + ");
  };

  const saveLabel =
    saveState === "saving" ? "保存中..." :
    saveState === "saved"  ? "✓ 保存済み" :
    saveState === "error"  ? "⚠ エラー" : "保存";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="curry-app">

        <header className="c-header">
          <div className="c-header-left">
            <a href="/" className="c-back">← 案件管理</a>
            <div>
              <div className="c-logo">chigu</div>
              <div className="c-logo-sub">Recipe Studio</div>
            </div>
          </div>
          <button
            className={`btn-save ${saveState}`}
            onClick={handleSave}
            disabled={saveState === "saving" || loading}
          >
            {saveLabel}
          </button>
        </header>

        <main className="c-main">
          {loading ? (
            <div className="c-loading">データを読み込み中...</div>
          ) : (
            <>
              <div className="c-page-title">
                <h1>Curry Recipe</h1>
                <div className="c-subtitle">COST CALCULATOR & RECIPE NOTES</div>
              </div>

              {/* Summary */}
              <div className="c-summary-grid">
                <div className="c-summary-card">
                  <div className="sl">Total Cost</div>
                  <div className="sv">¥{totalCost.toLocaleString()}</div>
                  <div className="ss">材料費合計</div>
                </div>
                <div className="c-summary-card">
                  <div className="sl">Cost / Person</div>
                  <div className="sv">¥{costPerPerson.toLocaleString()}</div>
                  <div className="ss">1人あたり原価</div>
                </div>
                <div className="c-summary-card">
                  <div className="sl">Amount / Person</div>
                  <div className="sv" style={{ fontSize: capPerPersonStr().length > 10 ? 16 : 20 }}>
                    {capPerPersonStr()}
                  </div>
                  <div className="ss">1人あたりの量</div>
                </div>
              </div>

              {/* Servings */}
              <div className="c-section-label">人数設定</div>
              <div className="c-servings-row">
                <span className="c-servings-label">作る人数</span>
                <div className="c-stepper">
                  <button className="c-step-btn" onClick={() => setServings(s => Math.max(1, s - 1))}>−</button>
                  <input
                    className="c-step-num"
                    type="number" min="1"
                    value={servings}
                    onChange={e => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button className="c-step-btn" onClick={() => setServings(s => s + 1)}>＋</button>
                </div>
                <span className="c-servings-unit">人分</span>
              </div>

              {/* Ingredients */}
              <div className="c-section-label" style={{ marginTop: 28 }}>購入材料</div>

              <div className="c-ing-list">
                {ingredients.map((ing) => (
                  <div className="c-ing-card" key={ing.id}>
                    {/* 材料名 + 削除 */}
                    <div className="c-ing-row1">
                      <input
                        className="c-ing-name"
                        placeholder="材料名（例：玉ねぎ）"
                        value={ing.name}
                        onChange={e => updateIngredient(ing.id, "name", e.target.value)}
                      />
                      <button className="c-btn-del" onClick={() => removeIngredient(ing.id)}>×</button>
                    </div>

                    {/* 容量 / 単位 / 値段 / 個数 */}
                    <div className="c-ing-row2">
                      <div className="c-ing-field">
                        <label>容量</label>
                        <input className="c-ing-input num" type="number" min="0" placeholder="200"
                          value={ing.capacity} onChange={e => updateIngredient(ing.id, "capacity", e.target.value)} />
                      </div>
                      <div className="c-ing-field">
                        <label>単位</label>
                        <select className="c-ing-select" value={ing.unit}
                          onChange={e => updateIngredient(ing.id, "unit", e.target.value)}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="c-ing-field">
                        <label>値段（円）</label>
                        <input className="c-ing-input num" type="number" min="0" placeholder="0"
                          value={ing.price} onChange={e => updateIngredient(ing.id, "price", e.target.value)} />
                      </div>
                      <div className="c-ing-field">
                        <label>個数</label>
                        <input className="c-ing-input num" type="number" min="1" placeholder="1"
                          value={ing.quantity} onChange={e => updateIngredient(ing.id, "quantity", e.target.value)} />
                      </div>
                    </div>

                    {/* 備考 + 小計 */}
                    <div className="c-ing-row3">
                      <input className="c-ing-note" placeholder="備考（産地・ブランドなど）"
                        value={ing.note} onChange={e => updateIngredient(ing.id, "note", e.target.value)} />
                      <div className="c-ing-subtotal">小計：¥{getSubtotal(ing).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="c-total-row">
                <span className="c-total-label">合計</span>
                <span className="c-total-value">¥{totalCost.toLocaleString()}</span>
              </div>

              <button className="c-btn-add" onClick={addIngredient}>＋ 材料を追加</button>

              <div className="c-divider" />

              {/* Recipe */}
              <div className="c-section-label">レシピ手順</div>
              <textarea
                className="c-recipe"
                placeholder="レシピの手順、コツ、メモなどを自由に記入..."
                value={recipe}
                onChange={e => setRecipe(e.target.value)}
              />
            </>
          )}
        </main>
      </div>
    </>
  );
}
