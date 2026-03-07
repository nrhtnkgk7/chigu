import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "chigu_curry_data";

const defaultIngredient = () => ({
  id: Date.now() + Math.random(),
  name: "",
  capacity: "",
  unit: "g",
  price: "",
  quantity: 1,
  note: "",
});

const defaultData = {
  recipeName: "",
  servings: 10,
  ingredients: [defaultIngredient()],
  recipe: "",
  memo: "",
};

export default function CurryCalculator() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      }
    } catch {}
    return { ...defaultData };
  });

  const [saved, setSaved] = useState(false);

  // 自動保存
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 500);
    return () => clearTimeout(timer);
  }, [data]);

  const updateField = useCallback((field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const updateIngredient = useCallback((id, field, value) => {
    setData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing
      ),
    }));
    setSaved(false);
  }, []);

  const addIngredient = () => {
    setData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, defaultIngredient()],
    }));
  };

  const removeIngredient = (id) => {
    setData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }));
  };

  const calcSubtotal = (ing) => {
    const price = parseFloat(ing.price) || 0;
    const qty = parseFloat(ing.quantity) || 0;
    return price * qty;
  };

  const totalCost = data.ingredients.reduce(
    (sum, ing) => sum + calcSubtotal(ing),
    0
  );

  const totalCapacity = data.ingredients.reduce((sum, ing) => {
    const cap = parseFloat(ing.capacity) || 0;
    const qty = parseFloat(ing.quantity) || 0;
    return sum + cap * qty;
  }, 0);

  const servings = Math.max(1, parseInt(data.servings) || 1);
  const costPerPerson = totalCost / servings;
  const capacityPerPerson = totalCapacity / servings;

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportCSV = () => {
    const header = "材料名,容量,単位,値段,個数,合計,備考";
    const rows = data.ingredients.map(
      (ing) =>
        `"${ing.name}","${ing.capacity}","${ing.unit}","${ing.price}","${ing.quantity}","${calcSubtotal(ing)}","${ing.note}"`
    );
    const footer = `\n人数,${servings}\n合計原価,¥${totalCost.toLocaleString()}\n1人あたり原価,¥${Math.ceil(costPerPerson).toLocaleString()}\n1人あたり量,${Math.round(capacityPerPerson)}g`;
    const csv = [header, ...rows].join("\n") + footer;
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.recipeName || "curry"}_recipe.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (window.confirm("すべてのデータをリセットしますか？")) {
      setData({ ...defaultData, ingredients: [defaultIngredient()] });
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // --- styles ---
  const styles = {
    container: {
      maxWidth: 960,
      margin: "0 auto",
      padding: "24px 16px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: "#333",
      fontSize: 14,
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
      flexWrap: "wrap",
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: 600,
      color: "#222",
      margin: 0,
    },
    subtitle: {
      fontSize: 12,
      color: "#888",
      marginTop: 2,
    },
    backLink: {
      fontSize: 13,
      color: "#666",
      textDecoration: "none",
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "6px 12px",
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: "#555",
      marginBottom: 10,
      borderBottom: "1px solid #eee",
      paddingBottom: 6,
    },
    input: {
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "6px 8px",
      fontSize: 13,
      width: "100%",
      boxSizing: "border-box",
      outline: "none",
    },
    inputFocus: {
      borderColor: "#999",
    },
    select: {
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "6px 4px",
      fontSize: 13,
      background: "#fff",
      outline: "none",
    },
    tableWrap: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 700,
    },
    th: {
      background: "#f5f5f5",
      color: "#666",
      fontWeight: 500,
      fontSize: 12,
      padding: "8px 6px",
      textAlign: "left",
      borderBottom: "2px solid #e0e0e0",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "4px 4px",
      borderBottom: "1px solid #f0f0f0",
      verticalAlign: "middle",
    },
    numTd: {
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
    },
    removeBtn: {
      background: "none",
      border: "none",
      color: "#ccc",
      cursor: "pointer",
      fontSize: 18,
      padding: "2px 6px",
      lineHeight: 1,
    },
    addBtn: {
      background: "#fff",
      border: "1px dashed #ccc",
      borderRadius: 4,
      padding: "8px 16px",
      color: "#888",
      cursor: "pointer",
      fontSize: 13,
      width: "100%",
      marginTop: 4,
    },
    summaryBox: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 16,
    },
    summaryCard: {
      flex: "1 1 140px",
      background: "#fafafa",
      border: "1px solid #eee",
      borderRadius: 6,
      padding: "12px 16px",
      textAlign: "center",
    },
    summaryLabel: {
      fontSize: 11,
      color: "#888",
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: 600,
      color: "#333",
    },
    summaryHighlight: {
      fontSize: 20,
      fontWeight: 700,
      color: "#d35400",
    },
    textarea: {
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "10px 12px",
      fontSize: 13,
      width: "100%",
      boxSizing: "border-box",
      resize: "vertical",
      outline: "none",
      lineHeight: 1.8,
      fontFamily: "inherit",
    },
    row: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 12,
    },
    btnGroup: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    btn: {
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "8px 16px",
      fontSize: 13,
      cursor: "pointer",
      background: "#fff",
      color: "#555",
    },
    btnPrimary: {
      border: "1px solid #333",
      borderRadius: 4,
      padding: "8px 16px",
      fontSize: 13,
      cursor: "pointer",
      background: "#333",
      color: "#fff",
    },
    savedMsg: {
      fontSize: 12,
      color: "#27ae60",
      marginLeft: 8,
    },
    servingsInput: {
      width: 70,
      textAlign: "center",
      border: "1px solid #ddd",
      borderRadius: 4,
      padding: "6px 8px",
      fontSize: 15,
      fontWeight: 600,
      outline: "none",
    },
    servingsLabel: {
      fontSize: 13,
      color: "#666",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>レシピ原価計算</h1>
          <div style={styles.subtitle}>chigu - Recipe Cost Calculator</div>
        </div>
        <a href="/" style={styles.backLink}>
          ← 案件管理へ戻る
        </a>
      </div>

      {/* レシピ名 & 人数 */}
      <div style={styles.section}>
        <div style={styles.row}>
          <div style={{ flex: "1 1 200px" }}>
            <input
              style={styles.input}
              placeholder="レシピ名（例：チキンカレー）"
              value={data.recipeName}
              onChange={(e) => updateField("recipeName", e.target.value)}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={styles.servingsLabel}>人数</span>
            <input
              type="number"
              min="1"
              style={styles.servingsInput}
              value={data.servings}
              onChange={(e) => updateField("servings", e.target.value)}
            />
            <span style={styles.servingsLabel}>人分</span>
          </div>
        </div>
      </div>

      {/* 購入材料テーブル */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>購入材料</div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 30 }}></th>
                <th style={{ ...styles.th, minWidth: 120 }}>材料名</th>
                <th style={{ ...styles.th, width: 80 }}>容量</th>
                <th style={{ ...styles.th, width: 60 }}>単位</th>
                <th style={{ ...styles.th, width: 90 }}>値段（税込）</th>
                <th style={{ ...styles.th, width: 60 }}>個数</th>
                <th style={{ ...styles.th, width: 90 }}>合計</th>
                <th style={{ ...styles.th, minWidth: 100 }}>備考</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients.map((ing, idx) => (
                <tr key={ing.id}>
                  <td style={styles.td}>
                    {data.ingredients.length > 1 && (
                      <button
                        style={styles.removeBtn}
                        onClick={() => removeIngredient(ing.id)}
                        title="削除"
                      >
                        ×
                      </button>
                    )}
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      placeholder={`材料${idx + 1}`}
                      value={ing.name}
                      onChange={(e) =>
                        updateIngredient(ing.id, "name", e.target.value)
                      }
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      style={{ ...styles.input, textAlign: "right" }}
                      placeholder="0"
                      value={ing.capacity}
                      onChange={(e) =>
                        updateIngredient(ing.id, "capacity", e.target.value)
                      }
                    />
                  </td>
                  <td style={styles.td}>
                    <select
                      style={styles.select}
                      value={ing.unit}
                      onChange={(e) =>
                        updateIngredient(ing.id, "unit", e.target.value)
                      }
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="個">個</option>
                      <option value="本">本</option>
                      <option value="枚">枚</option>
                      <option value="缶">缶</option>
                      <option value="袋">袋</option>
                      <option value="パック">パック</option>
                      <option value="束">束</option>
                      <option value="房">房</option>
                      <option value="片">片</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      style={{ ...styles.input, textAlign: "right" }}
                      placeholder="¥0"
                      value={ing.price}
                      onChange={(e) =>
                        updateIngredient(ing.id, "price", e.target.value)
                      }
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="1"
                      style={{
                        ...styles.input,
                        textAlign: "center",
                        width: 50,
                      }}
                      value={ing.quantity}
                      onChange={(e) =>
                        updateIngredient(ing.id, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td style={{ ...styles.td, ...styles.numTd }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "0 8px",
                      }}
                    >
                      ¥{calcSubtotal(ing).toLocaleString()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.input}
                      placeholder=""
                      value={ing.note}
                      onChange={(e) =>
                        updateIngredient(ing.id, "note", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button style={styles.addBtn} onClick={addIngredient}>
          ＋ 材料を追加
        </button>

        {/* サマリー */}
        <div style={styles.summaryBox}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>材料合計</div>
            <div style={styles.summaryValue}>
              ¥{totalCost.toLocaleString()}
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>総容量</div>
            <div style={styles.summaryValue}>
              {totalCapacity.toLocaleString()}g
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>
              1人あたり原価（{servings}人分）
            </div>
            <div style={styles.summaryHighlight}>
              ¥{Math.ceil(costPerPerson).toLocaleString()}
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>
              1人あたり量（{servings}人分）
            </div>
            <div style={styles.summaryValue}>
              {Math.round(capacityPerPerson).toLocaleString()}g
            </div>
          </div>
        </div>
      </div>

      {/* レシピ */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>レシピ・作り方</div>
        <textarea
          style={{ ...styles.textarea, minHeight: 180 }}
          placeholder={
            "1. 玉ねぎをみじん切りにし、飴色になるまで炒める\n2. 鶏肉を一口大に切り、塩こしょうで下味をつける\n3. ..."
          }
          value={data.recipe}
          onChange={(e) => updateField("recipe", e.target.value)}
        />
      </div>

      {/* メモ */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>開発メモ</div>
        <textarea
          style={{ ...styles.textarea, minHeight: 80 }}
          placeholder="改善点、次回試したいこと、味の感想など..."
          value={data.memo}
          onChange={(e) => updateField("memo", e.target.value)}
        />
      </div>

      {/* ボタン */}
      <div style={{ ...styles.btnGroup, justifyContent: "space-between" }}>
        <div style={styles.btnGroup}>
          <button style={styles.btnPrimary} onClick={handleSave}>
            保存
          </button>
          {saved && <span style={styles.savedMsg}>✓ 保存しました</span>}
          <button style={styles.btn} onClick={handleExportCSV}>
            CSV出力
          </button>
        </div>
        <button
          style={{ ...styles.btn, color: "#c0392b", borderColor: "#e0c0b0" }}
          onClick={handleReset}
        >
          リセット
        </button>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "#bbb",
          marginTop: 40,
          paddingBottom: 20,
        }}
      >
        chigu — Recipe Cost Calculator
      </div>
    </div>
  );
}
