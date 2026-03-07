import { useState, useEffect } from "react";

const STORAGE_KEY = "chigu_curry_data";

const defaultIngredient = () => ({
  id: Date.now() + Math.random(),
  name: "",
  capacity: "",
  unit: "g",
  price: "",
  quantity: "1",
  note: "",
});

const UNITS = ["g", "kg", "ml", "L", "個", "枚", "本", "袋", "缶", "パック"];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #faf7f2;
    color: #3a2e1e;
    font-family: 'Noto Sans JP', sans-serif;
    min-height: 100vh;
  }

  .curry-app {
    min-height: 100vh;
    background: #faf7f2;
    background-image:
      radial-gradient(ellipse at 15% 40%, rgba(210,140,50,0.08) 0%, transparent 55%),
      radial-gradient(ellipse at 85% 15%, rgba(190,120,30,0.06) 0%, transparent 50%);
  }

  .header {
    border-bottom: 1px solid rgba(180,120,40,0.2);
    padding: 0 32px;
    background: rgba(250,247,242,0.97);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .back-link {
    color: rgba(160,110,40,0.75);
    font-size: 12px;
    text-decoration: none;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color 0.2s;
    font-weight: 500;
  }
  .back-link:hover { color: #a06820; }

  .logo {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 700;
    color: #7a4e10;
    letter-spacing: 0.05em;
  }

  .logo-sub {
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 10px;
    color: rgba(140,90,30,0.55);
    letter-spacing: 0.18em;
    font-weight: 300;
    text-transform: uppercase;
    margin-top: 1px;
  }

  .save-badge {
    font-size: 11px;
    color: rgba(140,100,40,0.55);
    letter-spacing: 0.05em;
  }

  .main {
    max-width: 960px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  .page-title {
    margin-bottom: 36px;
  }

  .page-title h1 {
    font-family: 'Playfair Display', serif;
    font-size: 30px;
    font-weight: 400;
    color: #4a3010;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .page-title .subtitle {
    font-size: 12px;
    color: rgba(140,100,40,0.65);
    letter-spacing: 0.14em;
    margin-top: 6px;
    font-weight: 300;
  }

  .section {
    margin-bottom: 28px;
  }

  .section-label {
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

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(180,120,40,0.2);
  }

  .card {
    background: #ffffff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 8px rgba(120,70,10,0.06);
  }

  /* Summary Cards */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }

  @media (max-width: 600px) {
    .summary-grid { grid-template-columns: 1fr; }
  }

  .summary-card {
    background: #ffffff;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 12px;
    padding: 20px 22px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 8px rgba(120,70,10,0.06);
  }

  .summary-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #c8882a, #e8a838, #c8882a);
    opacity: 0.85;
  }

  .summary-card .s-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    color: rgba(140,100,40,0.65);
    font-weight: 600;
    margin-bottom: 10px;
    text-transform: uppercase;
  }

  .summary-card .s-value {
    font-size: 26px;
    font-weight: 700;
    color: #3a2010;
    letter-spacing: -0.01em;
    line-height: 1;
  }

  .summary-card .s-unit {
    font-size: 13px;
    color: rgba(100,70,20,0.5);
    margin-left: 4px;
    font-weight: 400;
  }

  .summary-card .s-sub {
    font-size: 11px;
    color: rgba(120,80,30,0.55);
    margin-top: 6px;
  }

  /* Servings input */
  .servings-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: #ffffff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    margin-bottom: 28px;
    box-shadow: 0 1px 8px rgba(120,70,10,0.06);
  }

  .servings-label {
    font-size: 13px;
    color: #4a3010;
    letter-spacing: 0.06em;
    font-weight: 500;
    flex: 1;
  }

  .servings-stepper {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid rgba(180,120,40,0.35);
    border-radius: 8px;
    overflow: hidden;
  }

  .step-btn {
    width: 36px;
    height: 36px;
    background: rgba(200,136,42,0.1);
    border: none;
    color: #a06820;
    font-size: 18px;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 400;
  }
  .step-btn:hover { background: rgba(200,136,42,0.22); }

  .step-display {
    width: 54px;
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    color: #3a2010;
    background: #fffdf8;
    border: none;
    border-left: 1px solid rgba(180,120,40,0.2);
    border-right: 1px solid rgba(180,120,40,0.2);
    padding: 8px 0;
    outline: none;
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  thead th {
    text-align: left;
    padding: 12px 14px;
    font-size: 10px;
    letter-spacing: 0.16em;
    color: rgba(120,80,30,0.65);
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(180,120,40,0.18);
    background: #fdf8f0;
    white-space: nowrap;
  }

  tbody tr {
    border-bottom: 1px solid rgba(180,120,40,0.1);
    transition: background 0.15s;
  }

  tbody tr:hover {
    background: #fdf6ea;
  }

  tbody td {
    padding: 10px 14px;
    vertical-align: middle;
  }

  .subtotal {
    color: #9a6010;
    font-weight: 600;
    font-size: 14px;
    text-align: right;
  }

  tfoot td {
    padding: 14px 14px;
    font-size: 11px;
    color: rgba(120,80,30,0.6);
    background: #fdf8f0;
  }

  tfoot .total-label {
    font-size: 12px;
    letter-spacing: 0.1em;
    color: rgba(120,80,30,0.75);
    font-weight: 600;
    text-align: right;
    padding-right: 8px;
  }

  tfoot .total-value {
    font-size: 20px;
    font-weight: 700;
    color: #3a2010;
    text-align: right;
    padding-right: 14px;
  }

  /* Inputs inside table */
  .t-input {
    width: 100%;
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 6px;
    color: #3a2e1e;
    padding: 6px 8px;
    font-size: 13px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    min-width: 0;
  }
  .t-input:focus {
    border-color: rgba(180,120,40,0.55);
    background: #fff9ee;
  }
  .t-input.num {
    text-align: right;
  }
  .t-select {
    background: #faf7f2;
    border: 1px solid rgba(180,120,40,0.2);
    border-radius: 6px;
    color: #3a2e1e;
    padding: 6px 8px;
    font-size: 13px;
    font-family: 'Noto Sans JP', sans-serif;
    outline: none;
    appearance: none;
    cursor: pointer;
    width: 70px;
  }

  /* Buttons */
  .btn-add {
    width: 100%;
    padding: 14px;
    background: transparent;
    border: none;
    border-top: 1px dashed rgba(180,120,40,0.25);
    color: rgba(140,90,30,0.65);
    font-size: 12px;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 500;
  }
  .btn-add:hover {
    background: #fdf6ea;
    color: #a06820;
  }

  .btn-del {
    width: 26px;
    height: 26px;
    background: none;
    border: 1px solid rgba(200,80,60,0.2);
    border-radius: 6px;
    color: rgba(200,80,60,0.45);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .btn-del:hover {
    background: rgba(200,80,60,0.1);
    color: #c04030;
    border-color: rgba(200,80,60,0.4);
  }

  /* Recipe textarea */
  .recipe-textarea {
    width: 100%;
    min-height: 200px;
    background: #ffffff;
    border: 1px solid rgba(180,120,40,0.18);
    border-radius: 12px;
    color: #3a2e1e;
    padding: 20px;
    font-size: 14px;
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 300;
    line-height: 1.9;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s;
    box-shadow: 0 1px 8px rgba(120,70,10,0.05);
  }
  .recipe-textarea:focus {
    border-color: rgba(180,120,40,0.45);
  }
  .recipe-textarea::placeholder {
    color: rgba(140,100,40,0.3);
  }

  .divider {
    height: 1px;
    background: rgba(180,120,40,0.15);
    margin: 28px 0;
  }
`;

export default function CurryCalculator() {
  const [ingredients, setIngredients] = useState([defaultIngredient()]);
  const [servings, setServings] = useState(4);
  const [recipe, setRecipe] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.ingredients) setIngredients(d.ingredients);
        if (d.servings) setServings(d.servings);
        if (d.recipe !== undefined) setRecipe(d.recipe);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ingredients, servings, recipe }));
        setSavedAt(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [ingredients, servings, recipe]);

  const updateIngredient = (id, field, value) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addIngredient = () => {
    setIngredients(prev => [...prev, defaultIngredient()]);
  };

  const removeIngredient = (id) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const getSubtotal = (ing) => {
    const p = parseFloat(ing.price) || 0;
    const q = parseFloat(ing.quantity) || 0;
    return p * q;
  };

  const totalCost = ingredients.reduce((s, i) => s + getSubtotal(i), 0);
  const costPerPerson = servings > 0 ? Math.ceil(totalCost / servings) : 0;

  const totalCapacity = () => {
    const byUnit = {};
    ingredients.forEach(i => {
      if (!i.name || !i.capacity) return;
      const u = i.unit || "g";
      const cap = (parseFloat(i.capacity) || 0) * (parseFloat(i.quantity) || 0);
      if (cap > 0) byUnit[u] = (byUnit[u] || 0) + cap;
    });
    return byUnit;
  };

  const capacityPerPerson = () => {
    const total = totalCapacity();
    if (servings <= 0) return {};
    const result = {};
    Object.entries(total).forEach(([u, v]) => { result[u] = (v / servings).toFixed(1); });
    return result;
  };

  const capPerPersonStr = () => {
    const cap = capacityPerPerson();
    const parts = Object.entries(cap).map(([u, v]) => `${v}${u}`);
    return parts.length > 0 ? parts.join(" + ") : "—";
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="curry-app">
        <header className="header">
          <div className="header-left">
            <a href="/" className="back-link">← 案件管理</a>
            <div>
              <div className="logo">chigu</div>
              <div className="logo-sub">Recipe Studio</div>
            </div>
          </div>
          <div className="save-badge">
            {savedAt ? `${savedAt} 保存済` : ""}
          </div>
        </header>

        <main className="main">
          <div className="page-title">
            <h1>Curry Recipe</h1>
            <div className="subtitle">COST CALCULATOR & RECIPE NOTES</div>
          </div>

          {/* Summary */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="s-label">Total Cost</div>
              <div className="s-value">
                ¥{totalCost.toLocaleString()}
              </div>
              <div className="s-sub">材料費合計</div>
            </div>
            <div className="summary-card">
              <div className="s-label">Cost / Person</div>
              <div className="s-value">
                ¥{costPerPerson.toLocaleString()}
              </div>
              <div className="s-sub">1人あたり原価</div>
            </div>
            <div className="summary-card">
              <div className="s-label">Amount / Person</div>
              <div className="s-value" style={{ fontSize: capPerPersonStr().length > 8 ? 18 : 22 }}>
                {capPerPersonStr()}
              </div>
              <div className="s-sub">1人あたりの量</div>
            </div>
          </div>

          {/* Servings */}
          <div className="section-label">人数設定</div>
          <div className="servings-row">
            <span className="servings-label">作る人数</span>
            <div className="servings-stepper">
              <button className="step-btn" onClick={() => setServings(s => Math.max(1, s - 1))}>−</button>
              <input
                className="step-display"
                type="number"
                min="1"
                value={servings}
                onChange={e => setServings(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button className="step-btn" onClick={() => setServings(s => s + 1)}>＋</button>
            </div>
            <span style={{ fontSize: 13, color: "rgba(180,140,60,0.55)", marginLeft: 8 }}>人分</span>
          </div>

          {/* Ingredients */}
          <div className="section-label" style={{ marginTop: 28 }}>購入材料</div>
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "18%" }}>材料名</th>
                    <th style={{ width: "10%" }}>容量</th>
                    <th style={{ width: "8%" }}>単位</th>
                    <th style={{ width: "12%", textAlign: "right" }}>値段</th>
                    <th style={{ width: "8%", textAlign: "right" }}>個数</th>
                    <th style={{ width: "12%", textAlign: "right" }}>合計</th>
                    <th>備考</th>
                    <th style={{ width: "36px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing) => (
                    <tr key={ing.id}>
                      <td>
                        <input
                          className="t-input"
                          placeholder="例：玉ねぎ"
                          value={ing.name}
                          onChange={e => updateIngredient(ing.id, "name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="t-input num"
                          placeholder="200"
                          value={ing.capacity}
                          onChange={e => updateIngredient(ing.id, "capacity", e.target.value)}
                          type="number"
                          min="0"
                        />
                      </td>
                      <td>
                        <select
                          className="t-select"
                          value={ing.unit}
                          onChange={e => updateIngredient(ing.id, "unit", e.target.value)}
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          className="t-input num"
                          placeholder="¥0"
                          value={ing.price}
                          onChange={e => updateIngredient(ing.id, "price", e.target.value)}
                          type="number"
                          min="0"
                        />
                      </td>
                      <td>
                        <input
                          className="t-input num"
                          placeholder="1"
                          value={ing.quantity}
                          onChange={e => updateIngredient(ing.id, "quantity", e.target.value)}
                          type="number"
                          min="1"
                        />
                      </td>
                      <td className="subtotal">
                        ¥{getSubtotal(ing).toLocaleString()}
                      </td>
                      <td>
                        <input
                          className="t-input"
                          placeholder="メモ"
                          value={ing.note}
                          onChange={e => updateIngredient(ing.id, "note", e.target.value)}
                        />
                      </td>
                      <td>
                        <button className="btn-del" onClick={() => removeIngredient(ing.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="total-label">TOTAL</td>
                    <td className="total-value">¥{totalCost.toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button className="btn-add" onClick={addIngredient}>＋ 材料を追加</button>
          </div>

          <div className="divider" />

          {/* Recipe Notes */}
          <div className="section-label">レシピ手順</div>
          <textarea
            className="recipe-textarea"
            placeholder="レシピの手順、コツ、メモなどを自由に記入..."
            value={recipe}
            onChange={e => setRecipe(e.target.value)}
          />
        </main>
      </div>
    </>
  );
}
