import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'react-router-dom';

const SUPABASE_URL = 'https://thukxeznpnwfqtoehyvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRodWt4ZXpucG53ZnF0b2VoeXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzk1NTMsImV4cCI6MjA4ODQxNTU1M30._ZqXyb1slx-8WNmebptkeTNJdv-aUlJGRAwJZdsFkqo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Design Tokens ──
const C = {
  bg: '#faf7f2',
  card: '#ffffff',
  cardHover: '#f9f6f1',
  primary: '#5d4037',
  primaryLight: '#8d6e63',
  primaryBg: '#efebe9',
  accent: '#ff6f00',
  border: '#e8e0d8',
  borderLight: '#f0ebe4',
  text: '#3e2723',
  textSub: '#8d6e63',
  textLight: '#bcaaa4',
  white: '#ffffff',
  confirmed: '#2e7d32',
  confirmedBg: '#e8f5e9',
  maybe: '#f57c00',
  maybeBg: '#fff3e0',
  undecided: '#78909c',
  undecidedBg: '#eceff1',
  danger: '#c62828',
  dangerBg: '#ffebee',
};

const STATUS_CONFIG = {
  '確定': { color: C.confirmed, bg: C.confirmedBg, icon: '●' },
  '時間があれば': { color: C.maybe, bg: C.maybeBg, icon: '△' },
  '未定': { color: C.undecided, bg: C.undecidedBg, icon: '○' },
};

const STATUSES = ['確定', '時間があれば', '未定'];

// ── Parsers ──
function parseNaverMap(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const result = { name: '', url: '', address: '' };
  const filtered = lines.filter(l =>
    !l.startsWith('[') || !l.includes('NAVER')
  );
  for (const line of filtered) {
    if (line.match(/^https?:\/\//)) {
      result.url = line;
    } else if (
      line.match(/[시도군구읍면동리로길]/) ||
      line.match(/[市区町村]/) ||
      line.match(/특별시|광역시|특별자치/)
    ) {
      result.address = line;
    } else if (!result.name) {
      result.name = line;
    }
  }
  return result;
}

function parseBulkSchedule(text, defaultYear) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  let currentDate = null;
  const year = defaultYear || new Date().getFullYear();

  for (const line of lines) {
    // Match: 4/1, 4/1(水), 2025/4/1, 2025/4/1(水)
    const dateMatch = line.match(/^(\d{4}\/)?(\d{1,2})\/(\d{1,2})(?:\s*[\(（][日月火水木金土][\)）])?$/);
    if (dateMatch) {
      const y = dateMatch[1] ? dateMatch[1].replace('/', '') : year;
      const m = dateMatch[2].padStart(2, '0');
      const d = dateMatch[3].padStart(2, '0');
      currentDate = `${y}-${m}-${d}`;
    } else {
      const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      if (timeMatch) {
        items.push({
          name: timeMatch[2],
          time: timeMatch[1],
          date: currentDate,
          status: '未定',
        });
      } else if (line.length > 0) {
        items.push({
          name: line,
          time: null,
          date: currentDate,
          status: '未定',
        });
      }
    }
  }
  return items;
}

function formatDate(dateStr) {
  if (!dateStr) return '日程未定';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${parseInt(m)}/${parseInt(d)} (${days[date.getDay()]})`;
}

function groupByDate(items) {
  const groups = {};
  const undecided = [];
  for (const item of items) {
    if (item.date) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    } else {
      undecided.push(item);
    }
  }
  const sortedDates = Object.keys(groups).sort();
  // sort_order優先（手動並び替え対応）
  sortedDates.forEach(date => {
    groups[date].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  });
  undecided.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return { groups, sortedDates, undecided };
}

// ── Styles ──
const baseBtn = {
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: '"Noto Sans JP", sans-serif',
  fontWeight: 500,
  transition: 'all 0.15s ease',
};

const styles = {
  container: {
    fontFamily: '"Noto Sans JP", sans-serif',
    background: C.bg,
    minHeight: '100dvh',
    color: C.text,
    WebkitTextSizeAdjust: '100%',
  },
  header: {
    background: C.primary,
    color: C.white,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  headerBtn: {
    ...baseBtn,
    background: 'rgba(255,255,255,0.15)',
    color: C.white,
    padding: '8px 14px',
    fontSize: 13,
  },
  backBtn: {
    ...baseBtn,
    background: 'none',
    color: C.white,
    padding: '8px 0',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  body: {
    padding: '16px 16px 100px',
    maxWidth: 600,
    margin: '0 auto',
  },
  card: {
    background: C.card,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    padding: 16,
    marginBottom: 12,
  },
  floatingBtn: {
    ...baseBtn,
    position: 'fixed',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    background: C.primary,
    color: C.white,
    fontSize: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(93,64,55,0.35)',
    zIndex: 90,
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  modalContent: {
    background: C.card,
    borderRadius: '20px 20px 0 0',
    width: '100%',
    maxWidth: 600,
    maxHeight: '90dvh',
    overflow: 'auto',
    padding: '24px 20px 40px',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: C.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 16,
    fontFamily: '"Noto Sans JP", sans-serif',
    color: C.text,
    background: C.bg,
    boxSizing: 'border-box',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 16,
    fontFamily: '"Noto Sans JP", sans-serif',
    color: C.text,
    background: C.bg,
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
    minHeight: 120,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: C.textSub,
    marginBottom: 6,
    marginTop: 14,
  },
  primaryBtn: {
    ...baseBtn,
    background: C.primary,
    color: C.white,
    padding: '14px 24px',
    fontSize: 15,
    width: '100%',
    marginTop: 20,
  },
  secondaryBtn: {
    ...baseBtn,
    background: C.primaryBg,
    color: C.primary,
    padding: '14px 24px',
    fontSize: 15,
    width: '100%',
    marginTop: 10,
  },
  dangerBtn: {
    ...baseBtn,
    background: C.dangerBg,
    color: C.danger,
    padding: '12px 24px',
    fontSize: 14,
    width: '100%',
    marginTop: 10,
  },
  dateHeader: {
    fontSize: 15,
    fontWeight: 700,
    color: C.primary,
    padding: '18px 0 8px',
    borderBottom: `2px solid ${C.primary}`,
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCard: {
    background: C.card,
    borderRadius: 12,
    border: `1px solid ${C.borderLight}`,
    padding: '12px 14px',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusBadge: (status) => ({
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    color: STATUS_CONFIG[status]?.color || C.undecided,
    background: STATUS_CONFIG[status]?.bg || C.undecidedBg,
    whiteSpace: 'nowrap',
  }),
  itemTime: {
    fontSize: 14,
    fontWeight: 700,
    color: C.primary,
    minWidth: 44,
    flexShrink: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    flex: 1,
  },
  itemSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  itemUrl: {
    fontSize: 12,
    color: C.accent,
    textDecoration: 'none',
    marginTop: 2,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: C.textLight,
    fontSize: 14,
  },
  actionSheet: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionOption: {
    ...baseBtn,
    background: C.bg,
    color: C.text,
    padding: '16px',
    fontSize: 15,
    textAlign: 'left',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    fontSize: 20,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    background: C.primaryBg,
    flexShrink: 0,
  },
  shareBox: {
    background: C.bg,
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: `1px solid ${C.border}`,
  },
  shareUrl: {
    flex: 1,
    fontSize: 13,
    color: C.textSub,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyBtn: {
    ...baseBtn,
    background: C.primary,
    color: C.white,
    padding: '8px 14px',
    fontSize: 12,
    flexShrink: 0,
  },
  projectCard: {
    background: C.card,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    padding: '18px 16px',
    marginBottom: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
  },
  projectMeta: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 4,
  },
  chevron: {
    color: C.textLight,
    fontSize: 18,
  },
  tabBar: {
    display: 'flex',
    gap: 6,
    padding: '12px 0',
    overflowX: 'auto',
  },
  tab: (active) => ({
    ...baseBtn,
    background: active ? C.primary : C.card,
    color: active ? C.white : C.textSub,
    padding: '8px 16px',
    fontSize: 13,
    border: `1px solid ${active ? C.primary : C.border}`,
    borderRadius: 20,
    whiteSpace: 'nowrap',
  }),
  exportContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 794,
    background: '#fff',
    padding: 40,
    fontFamily: '"Noto Sans JP", sans-serif',
  },
};

// ── Item Card Component (pure display) ──
function ItemCard({ item, onTap, readonly, onTimeChange, onDateChange }) {
  const [editingTime, setEditingTime] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [tempTime, setTempTime] = useState(item.time || '');
  const [tempDate, setTempDate] = useState(item.date || '');

  function handleTimeSubmit() {
    if (onTimeChange) onTimeChange(item.id, tempTime || null);
    setEditingTime(false);
  }
  function handleDateSubmit() {
    if (onDateChange) onDateChange(item.id, tempDate || null);
    setEditingDate(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {/* Drag Handle - visual only, events handled by parent */}
      {!readonly && (
        <div
          className="drag-handle"
          style={{
            display: 'flex', alignItems: 'center', padding: '8px 2px',
            color: C.textLight, fontSize: 18, cursor: 'grab', touchAction: 'none',
            userSelect: 'none', flexShrink: 0, lineHeight: 1,
          }}
        >
          ≡
        </div>
      )}

      {/* Time - tap to edit */}
      <div style={{ ...styles.itemTime, cursor: readonly ? 'default' : 'pointer' }}>
        {editingTime && !readonly ? (
          <input
            type="time"
            value={tempTime}
            onChange={e => setTempTime(e.target.value)}
            onBlur={handleTimeSubmit}
            onKeyDown={e => e.key === 'Enter' && handleTimeSubmit()}
            autoFocus
            style={{
              width: 64, border: `1px solid ${C.accent}`, borderRadius: 6,
              padding: '4px 6px', fontSize: 16, fontFamily: '"Noto Sans JP", sans-serif',
              color: C.primary, background: C.white, outline: 'none',
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            onClick={e => {
              if (readonly) return;
              e.stopPropagation();
              setTempTime(item.time || '');
              setEditingTime(true);
            }}
            style={{
              padding: '4px 6px', borderRadius: 6,
              background: !readonly ? C.primaryBg : 'transparent',
            }}
          >
            {item.time || '---'}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => !readonly && onTap && onTap(item)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={styles.itemName}>{item.name}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 16, textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
              onClick={e => e.stopPropagation()} title="地図を開く">📍</a>
          )}
          <span style={styles.statusBadge(item.status)}>{item.status}</span>
        </div>
        {item.genre && <div style={styles.itemSub}>{item.genre}</div>}
        {item.address && <div style={styles.itemSub}>{item.address}</div>}
        {item.memo && <div style={{ ...styles.itemSub, fontStyle: 'italic' }}>{item.memo}</div>}

        {/* Inline date for undecided */}
        {!item.date && !readonly && (
          <div style={{ marginTop: 6 }}>
            {editingDate ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} autoFocus
                  style={{ border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 8px', fontSize: 16,
                    fontFamily: '"Noto Sans JP", sans-serif', color: C.primary, background: C.white, outline: 'none' }} />
                <button onClick={handleDateSubmit}
                  style={{ border: 'none', background: C.primary, color: C.white, borderRadius: 6,
                    padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: '"Noto Sans JP", sans-serif' }}>決定</button>
                <button onClick={() => setEditingDate(false)}
                  style={{ border: `1px solid ${C.border}`, background: C.white, color: C.textSub, borderRadius: 6,
                    padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: '"Noto Sans JP", sans-serif' }}>×</button>
              </div>
            ) : (
              <span onClick={e => { e.stopPropagation(); setTempDate(''); setEditingDate(true); }}
                style={{ fontSize: 12, color: C.accent, cursor: 'pointer', padding: '2px 8px', borderRadius: 6,
                  background: C.maybeBg, fontWeight: 600 }}>+ 日付を設定</span>
            )}
          </div>
        )}
      </div>

      {!readonly && <span style={styles.chevron} onClick={() => onTap && onTap(item)}>›</span>}
    </div>
  );
}

// ── Sortable List with Touch Drag ──
function SortableList({ items: flatItems, onReorder, renderItem, renderSectionHeader }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const containerRef = useRef(null);
  const dragState = useRef({ active: false, timer: null, startY: 0, scrollInterval: null, clone: null, offsetY: 0 });

  function findItemIndex(el) {
    const row = el.closest('[data-sort-idx]');
    return row ? parseInt(row.getAttribute('data-sort-idx')) : null;
  }

  function startAutoScroll(clientY) {
    stopAutoScroll();
    const edge = 80, speed = 8;
    dragState.current.scrollInterval = setInterval(() => {
      if (clientY < edge) window.scrollBy(0, -speed);
      else if (clientY > window.innerHeight - edge) window.scrollBy(0, speed);
    }, 16);
  }
  function stopAutoScroll() {
    if (dragState.current.scrollInterval) {
      clearInterval(dragState.current.scrollInterval);
      dragState.current.scrollInterval = null;
    }
  }

  function createClone(sourceEl, clientY) {
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';
    clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
    clone.style.borderRadius = '12px';
    clone.style.transform = 'scale(1.03)';
    clone.style.opacity = '0.95';
    clone.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
    document.body.appendChild(clone);
    dragState.current.clone = clone;
    dragState.current.offsetY = clientY - rect.top;
  }

  function moveClone(clientY) {
    if (!dragState.current.clone) return;
    const top = clientY - dragState.current.offsetY;
    dragState.current.clone.style.top = top + 'px';
  }

  function removeClone() {
    if (dragState.current.clone) {
      dragState.current.clone.remove();
      dragState.current.clone = null;
    }
  }

  function cleanup() {
    clearTimeout(dragState.current.timer);
    stopAutoScroll();
    removeClone();
    document.body.style.overflow = '';
    dragState.current.active = false;
    setDragIdx(null);
    setOverIdx(null);
  }

  function onTouchStart(e) {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const idx = findItemIndex(e.target);
    if (idx === null) return;

    const touch = e.touches[0];
    const cardEl = e.target.closest('[data-sort-idx]');
    dragState.current.startY = touch.clientY;
    dragState.current.timer = setTimeout(() => {
      dragState.current.active = true;
      setDragIdx(idx);
      setOverIdx(idx);
      if (navigator.vibrate) navigator.vibrate(20);
      document.body.style.overflow = 'hidden';
      if (cardEl) createClone(cardEl, touch.clientY);
    }, 200);
  }

  function onTouchMove(e) {
    if (!dragState.current.active) {
      const dy = Math.abs(e.touches[0].clientY - dragState.current.startY);
      if (dy > 8) clearTimeout(dragState.current.timer);
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    moveClone(touch.clientY);
    startAutoScroll(touch.clientY);

    // Temporarily hide clone to find element underneath
    if (dragState.current.clone) dragState.current.clone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (dragState.current.clone) dragState.current.clone.style.display = '';
    if (el) {
      const idx = findItemIndex(el);
      if (idx !== null) setOverIdx(idx);
    }
  }

  function onTouchEnd() {
    if (dragState.current.active && dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      onReorder(dragIdx, overIdx);
    }
    cleanup();
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={cleanup}
    >
      {flatItems.map((item, idx) => {
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== overIdx;
        const dropAbove = isOver && dragIdx > overIdx;
        const dropBelow = isOver && dragIdx < overIdx;

        return (
          <div key={item.id}>
            {renderSectionHeader && renderSectionHeader(item, idx, flatItems)}
            <div
              data-sort-idx={idx}
              style={{
                ...styles.itemCard,
                opacity: isDragging ? 0.25 : 1,
                background: isDragging ? C.borderLight : C.card,
                height: isDragging ? 48 : undefined,
                overflow: isDragging ? 'hidden' : undefined,
                borderLeft: dropAbove || dropBelow ? `3px solid ${C.accent}` : `1px solid ${C.borderLight}`,
                marginTop: dropAbove ? 4 : undefined,
                marginBottom: dropBelow ? 4 : undefined,
                transition: 'all 0.1s ease',
              }}
            >
              {isDragging ? null : renderItem(item, idx)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──
export default function PlanManager() {
  const params = useParams();
  const shareId = params.shareId || null;

  const [view, setView] = useState('projects'); // projects | detail
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modal, setModal] = useState(null); // null | 'actions' | 'naver' | 'bulk' | 'manual' | 'edit' | 'share' | 'newProject' | 'editProject'
  const [editItem, setEditItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Form states
  const [pasteText, setPasteText] = useState('');
  const [formData, setFormData] = useState({
    name: '', url: '', address: '', date: '', time: '', status: '未定', genre: '', memo: '',
  });
  const [newProjectName, setNewProjectName] = useState('');
  const [copySuccess, setCopySuccess] = useState(null); // null | 'link' | 'text'

  const exportRef = useRef(null);

  function handleTimeChange(id, time) {
    updateItem(id, { time });
  }

  function handleDateChange(id, date) {
    updateItem(id, { date });
  }

  // Build flat ordered list from grouped data
  function buildFlatList() {
    const flat = [];
    const { groups: g, sortedDates: sd, undecided: u } = groupByDate(
      statusFilter === 'all' ? items : items.filter(it => it.status === statusFilter)
    );
    for (const d of sd) for (const it of g[d]) flat.push(it);
    for (const it of u) flat.push(it);
    return flat;
  }

  async function handleReorder(fromIdx, toIdx) {
    const flat = buildFlatList();
    const arr = [...flat];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);

    // Update sort_order for all reordered items
    const updates = arr.map((it, i) => ({ ...it, sort_order: i }));
    // Merge back with any filtered-out items
    const updatedIds = new Set(updates.map(u => u.id));
    const newItems = [
      ...updates,
      ...items.filter(it => !updatedIds.has(it.id)),
    ];
    setItems(newItems);

    // Persist
    for (const it of updates) {
      await supabase.from('plan_items').update({ sort_order: it.sort_order }).eq('id', it.id);
    }
  }

  // ── Shared View ──
  useEffect(() => {
    if (shareId) {
      loadSharedProject(shareId);
    } else {
      loadProjects();
    }
  }, [shareId]);

  async function loadSharedProject(sid) {
    setLoading(true);
    const { data: proj } = await supabase
      .from('plan_projects')
      .select('*')
      .eq('share_id', sid)
      .single();
    if (proj) {
      setCurrentProject(proj);
      const { data: its } = await supabase
        .from('plan_items')
        .select('*')
        .eq('project_id', proj.id)
        .order('sort_order');
      setItems(its || []);
      setView('detail');
    }
    setLoading(false);
  }

  // ── Projects CRUD ──
  async function loadProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('plan_projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('loadProjects error:', error);
      alert('読み込みエラー: ' + error.message + '\n\nSupabaseでテーブルが作成されているか確認してください。');
    }
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    const { data, error } = await supabase
      .from('plan_projects')
      .insert({ name: newProjectName.trim() })
      .select()
      .single();
    if (error) {
      alert('作成エラー: ' + error.message);
      console.error('createProject error:', error);
      return;
    }
    if (data) {
      setProjects(prev => [data, ...prev]);
      setNewProjectName('');
      setModal(null);
      openProject(data);
    }
  }

  async function updateProjectName(name) {
    if (!name.trim() || !currentProject) return;
    await supabase
      .from('plan_projects')
      .update({ name: name.trim() })
      .eq('id', currentProject.id);
    setCurrentProject(prev => ({ ...prev, name: name.trim() }));
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, name: name.trim() } : p));
    setModal(null);
  }

  async function deleteProject() {
    if (!currentProject) return;
    if (!window.confirm(`「${currentProject.name}」を削除しますか？`)) return;
    await supabase.from('plan_projects').delete().eq('id', currentProject.id);
    setProjects(prev => prev.filter(p => p.id !== currentProject.id));
    setCurrentProject(null);
    setItems([]);
    setView('projects');
    setModal(null);
  }

  async function openProject(proj) {
    setCurrentProject(proj);
    setView('detail');
    setLoading(true);
    const { data } = await supabase
      .from('plan_items')
      .select('*')
      .eq('project_id', proj.id)
      .order('sort_order');
    setItems(data || []);
    setLoading(false);
  }

  // ── Items CRUD ──
  async function addItem(itemData) {
    const newItem = {
      project_id: currentProject.id,
      sort_order: items.length,
      ...itemData,
    };
    const { data, error } = await supabase
      .from('plan_items')
      .insert(newItem)
      .select()
      .single();
    if (error) {
      alert('追加エラー: ' + error.message);
      return;
    }
    if (data) setItems(prev => [...prev, data]);
  }

  async function addItems(itemsArr) {
    const newItems = itemsArr.map((it, i) => ({
      project_id: currentProject.id,
      sort_order: items.length + i,
      ...it,
    }));
    const { data, error } = await supabase
      .from('plan_items')
      .insert(newItems)
      .select();
    if (error) {
      alert('一括追加エラー: ' + error.message);
      return;
    }
    if (data) setItems(prev => [...prev, ...data]);
  }

  async function updateItem(id, updates) {
    await supabase.from('plan_items').update(updates).eq('id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  }

  async function deleteItem(id) {
    await supabase.from('plan_items').delete().eq('id', id);
    setItems(prev => prev.filter(it => it.id !== id));
    setModal(null);
    setEditItem(null);
  }

  async function cycleStatus(item) {
    const idx = STATUSES.indexOf(item.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    await updateItem(item.id, { status: next });
  }

  // ── Paste Handlers ──
  function handleNaverPaste() {
    const parsed = parseNaverMap(pasteText);
    if (!parsed.name) return;
    setFormData({
      name: parsed.name,
      url: parsed.url,
      address: parsed.address,
      date: '',
      time: '',
      status: '未定',
      genre: '',
      memo: '',
    });
    setPasteText('');
    setModal('manual');
  }

  async function handleBulkPaste() {
    const parsed = parseBulkSchedule(pasteText);
    if (parsed.length === 0) return;
    await addItems(parsed);
    setPasteText('');
    setModal(null);
  }

  function handleManualSave() {
    const data = {
      name: formData.name,
      url: formData.url || null,
      address: formData.address || null,
      date: formData.date || null,
      time: formData.time || null,
      status: formData.status,
      genre: formData.genre || null,
      memo: formData.memo || null,
    };
    if (editItem) {
      updateItem(editItem.id, data);
    } else {
      addItem(data);
    }
    resetForm();
    setModal(null);
    setEditItem(null);
  }

  function resetForm() {
    setFormData({
      name: '', url: '', address: '', date: '', time: '', status: '未定', genre: '', memo: '',
    });
  }

  function openEdit(item) {
    setEditItem(item);
    setPasteText('');
    setFormData({
      name: item.name || '',
      url: item.url || '',
      address: item.address || '',
      date: item.date || '',
      time: item.time || '',
      status: item.status || '未定',
      genre: item.genre || '',
      memo: item.memo || '',
    });
    setModal('edit');
  }

  // ── Share ──
  function getShareUrl() {
    if (!currentProject) return '';
    return `https://chigood.com/p/s/${currentProject.share_id}`;
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopySuccess('link');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = getShareUrl();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess('link');
      setTimeout(() => setCopySuccess(null), 2000);
    }
  }

  // ── Export ──
  function generateTextSchedule() {
    const { groups, sortedDates, undecided } = groupByDate(items);
    let text = '';
    for (const date of sortedDates) {
      text += formatDate(date) + '\n';
      for (const item of groups[date]) {
        text += (item.time || '---') + ' ' + item.name;
        if (item.url) text += ' ' + item.url;
        text += '\n';
      }
      text += '\n';
    }
    if (undecided.length > 0) {
      text += '日程未定\n';
      for (const item of undecided) {
        text += (item.time || '---') + ' ' + item.name;
        if (item.url) text += ' ' + item.url;
        text += '\n';
      }
    }
    return text.trim();
  }

  async function copyTextSchedule() {
    const text = generateTextSchedule();
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('text');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess('text');
      setTimeout(() => setCopySuccess(null), 2000);
    }
  }

  async function exportSchedule(format) {
    const el = exportRef.current;
    if (!el) return;

    // dynamic import
    const html2canvas = (await import('html2canvas')).default;

    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '9999';

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    el.style.position = 'absolute';
    el.style.left = '-9999px';

    if (format === 'jpg') {
      const link = document.createElement('a');
      link.download = `${currentProject.name}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'px', [canvas.width / 2, canvas.height / 2]);
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${currentProject.name}.pdf`);
    }
  }

  // ── Filtered Items ──
  const filteredItems = statusFilter === 'all'
    ? items
    : items.filter(it => it.status === statusFilter);

  const { groups, sortedDates, undecided } = groupByDate(filteredItems);

  // ── Render ──
  if (loading && !currentProject && !projects.length) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>PLAN</span>
        </div>
        <div style={styles.emptyState}>読み込み中...</div>
      </div>
    );
  }

  // ── SHARED VIEW ──
  if (shareId) {
    if (!currentProject) {
      return (
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={styles.headerTitle}>PLAN</span>
          </div>
          <div style={styles.emptyState}>プロジェクトが見つかりません</div>
        </div>
      );
    }
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>{currentProject.name}</span>
        </div>
        <div style={styles.body}>
          {sortedDates.map(date => (
            <div key={date}>
              <div style={styles.dateHeader}>{formatDate(date)}</div>
              {groups[date].map(item => (
                <ItemCard key={item.id} item={item} readonly />
              ))}
            </div>
          ))}
          {undecided.length > 0 && (
            <div>
              <div style={{ ...styles.dateHeader, color: C.undecided, borderColor: C.undecided }}>
                日程未定
              </div>
              {undecided.map(item => (
                <ItemCard key={item.id} item={item} readonly />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PROJECT LIST VIEW ──
  if (view === 'projects') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>PLAN</span>
        </div>
        <div style={styles.body}>
          {projects.length === 0 && !loading ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div>プロジェクトがありません</div>
              <div style={{ marginTop: 4 }}>＋ボタンから作成しましょう</div>
            </div>
          ) : (
            projects.map(proj => (
              <div
                key={proj.id}
                style={styles.projectCard}
                onClick={() => openProject(proj)}
              >
                <div>
                  <div style={styles.projectName}>{proj.name}</div>
                  <div style={styles.projectMeta}>
                    {new Date(proj.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <span style={styles.chevron}>›</span>
              </div>
            ))
          )}
        </div>

        {/* New Project FAB */}
        <button style={styles.floatingBtn} onClick={() => { setNewProjectName(''); setModal('newProject'); }}>
          ＋
        </button>

        {/* New Project Modal */}
        {modal === 'newProject' && (
          <div style={styles.modal} onClick={() => setModal(null)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={styles.modalTitle}>新規プロジェクト</div>
              <input
                style={styles.input}
                placeholder="例: ソウル 2025年4月"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                autoFocus
              />
              <button style={styles.primaryBtn} onClick={createProject}>作成</button>
              <button style={styles.secondaryBtn} onClick={() => setModal(null)}>キャンセル</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PROJECT DETAIL VIEW ──
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => { setView('projects'); setCurrentProject(null); }}>
          ‹ 戻る
        </button>
        <span style={{ ...styles.headerTitle, flex: 1, textAlign: 'center', fontSize: 15 }}>
          {currentProject?.name}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={styles.headerBtn} onClick={() => setModal('share')}>共有</button>
          <button style={styles.headerBtn} onClick={() => setModal('editProject')}>⋯</button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
        <div style={styles.tabBar}>
          <button style={styles.tab(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>
            すべて ({items.length})
          </button>
          {STATUSES.map(s => {
            const count = items.filter(it => it.status === s).length;
            return (
              <button key={s} style={styles.tab(statusFilter === s)} onClick={() => setStatusFilter(s)}>
                {STATUS_CONFIG[s].icon} {s} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Body */}
      <div style={styles.body}>
        {sortedDates.length === 0 && undecided.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
            <div>スポットを追加しましょう</div>
            <div style={{ marginTop: 4 }}>＋ボタンから追加できます</div>
          </div>
        )}

        {(() => {
          const flat = buildFlatList();
          if (flat.length === 0) return null;

          // Insert date headers as section markers
          let lastDate = null;
          const sections = [];
          for (let i = 0; i < flat.length; i++) {
            const item = flat[i];
            const dateKey = item.date || '__undecided__';
            if (dateKey !== lastDate) {
              const isUndecided = !item.date;
              sections.push(
                <div key={`header-${dateKey}`} style={{
                  ...styles.dateHeader,
                  color: isUndecided ? C.undecided : C.primary,
                  borderColor: isUndecided ? C.undecided : C.primary,
                }}>
                  <span>{isUndecided ? '📌 日程未定' : formatDate(item.date)}</span>
                  <span style={{ fontSize: 12, fontWeight: 400, color: C.textSub }}>
                    {flat.filter(x => (x.date || '__undecided__') === dateKey).length}件
                  </span>
                </div>
              );
              lastDate = dateKey;
            }
          }

          return (
            <>
              <SortableList
                items={flat}
                onReorder={handleReorder}
                renderItem={(item) => (
                  <ItemCard
                    item={item}
                    onTap={openEdit}
                    onTimeChange={handleTimeChange}
                    onDateChange={handleDateChange}
                  />
                )}
                renderSectionHeader={(item, idx, allItems) => {
                  if (idx === 0 || (allItems[idx - 1].date || null) !== (item.date || null)) {
                    const isUndecided = !item.date;
                    return (
                      <div style={{
                        ...styles.dateHeader,
                        color: isUndecided ? C.undecided : C.primary,
                        borderColor: isUndecided ? C.undecided : C.primary,
                      }}>
                        <span>{isUndecided ? '📌 日程未定' : formatDate(item.date)}</span>
                        <span style={{ fontSize: 12, fontWeight: 400, color: C.textSub }}>
                          {allItems.filter(x => (x.date || null) === (item.date || null)).length}件
                        </span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </>
          );
        })()}
      </div>

      {/* Floating Add Button */}
      <button style={styles.floatingBtn} onClick={() => setModal('actions')}>＋</button>

      {/* ── MODALS ── */}

      {/* Action Sheet */}
      {modal === 'actions' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>スポットを追加</div>
            <div style={styles.actionSheet}>
              <button style={styles.actionOption} onClick={() => { setModal('naver'); setPasteText(''); }}>
                <span style={styles.actionIcon}>📍</span>
                <div>
                  <div style={{ fontWeight: 600 }}>NAVER MAP 貼り付け</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>コピペで店名・URL・住所を自動取得</div>
                </div>
              </button>
              <button style={styles.actionOption} onClick={() => { setModal('bulk'); setPasteText(''); }}>
                <span style={styles.actionIcon}>📝</span>
                <div>
                  <div style={{ fontWeight: 600 }}>日程一括貼り付け</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>日付+時間のリストを一括登録</div>
                </div>
              </button>
              <button style={styles.actionOption} onClick={() => { resetForm(); setEditItem(null); setModal('manual'); }}>
                <span style={styles.actionIcon}>✏️</span>
                <div>
                  <div style={{ fontWeight: 600 }}>手動で追加</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>個別に情報を入力</div>
                </div>
              </button>
            </div>
            <button style={styles.secondaryBtn} onClick={() => setModal(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* NAVER MAP Paste Modal */}
      {modal === 'naver' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>NAVER MAP 貼り付け</div>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, lineHeight: 1.6 }}>
              NAVER MAPからコピーした内容をそのまま貼り付けてください。店名・住所・URLを自動で取り出します。
            </div>
            <textarea
              style={styles.textarea}
              placeholder={`[NAVER マップ]\nトトス\nソウル特別市 龍山区...\nhttps://naver.me/...`}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={6}
            />
            {pasteText && (
              <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: C.primary }}>プレビュー:</div>
                {(() => {
                  const p = parseNaverMap(pasteText);
                  return (
                    <>
                      <div>店名: <strong>{p.name || '—'}</strong></div>
                      <div>住所: {p.address || '—'}</div>
                      <div>URL: {p.url || '—'}</div>
                    </>
                  );
                })()}
              </div>
            )}
            <button style={styles.primaryBtn} onClick={handleNaverPaste} disabled={!pasteText}>
              次へ（日時設定）
            </button>
            <button style={styles.secondaryBtn} onClick={() => setModal(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* Bulk Schedule Paste Modal */}
      {modal === 'bulk' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>日程一括貼り付け</div>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, lineHeight: 1.6 }}>
              日付と時間のリストを貼り付けてください。日付がない行は「日程未定」に入ります。
            </div>
            <textarea
              style={styles.textarea}
              placeholder={`4/1\n10:00 ソンス\n12:00 テンジャンチゲ\n14:00 明洞\n\n4/2\n9:00 景福宮`}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={8}
            />
            {pasteText && (
              <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: C.primary }}>
                  プレビュー: {parseBulkSchedule(pasteText).length}件検出
                </div>
                {parseBulkSchedule(pasteText).slice(0, 5).map((it, i) => (
                  <div key={i} style={{ marginBottom: 2 }}>
                    {it.date ? formatDate(it.date) : '未定'} {it.time || ''} {it.name}
                  </div>
                ))}
                {parseBulkSchedule(pasteText).length > 5 && (
                  <div style={{ color: C.textLight }}>...他 {parseBulkSchedule(pasteText).length - 5}件</div>
                )}
              </div>
            )}
            <button style={styles.primaryBtn} onClick={handleBulkPaste} disabled={!pasteText}>
              一括登録
            </button>
            <button style={styles.secondaryBtn} onClick={() => setModal(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      {(modal === 'manual' || modal === 'edit') && (
        <div style={styles.modal} onClick={() => { setModal(null); setEditItem(null); }}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              {editItem ? 'スポット編集' : 'スポット追加'}
            </div>

            {/* NAVER MAP paste for overwrite (edit mode only) */}
            {editItem && (
              <div style={{ marginBottom: 16, padding: 14, background: C.bg, borderRadius: 12, border: `1px dashed ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>
                  📍 NAVER MAPで上書き
                </div>
                <textarea
                  style={{ ...styles.textarea, minHeight: 80, fontSize: 14 }}
                  placeholder={`NAVER MAPのコピーを貼り付け\n→ 店名・住所・URLを上書きします`}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={3}
                />
                {pasteText && (() => {
                  const p = parseNaverMap(pasteText);
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>
                        プレビュー: {p.name || '—'} / {p.address || '—'}
                      </div>
                      <button
                        style={{ ...baseBtn, background: C.accent, color: C.white, padding: '8px 16px', fontSize: 13, marginTop: 4 }}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            name: p.name || prev.name,
                            url: p.url || prev.url,
                            address: p.address || prev.address,
                          }));
                          setPasteText('');
                        }}
                      >上書き反映</button>
                    </div>
                  );
                })()}
              </div>
            )}

            <label style={styles.label}>店名 / スポット名 *</label>
            <input
              style={styles.input}
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="例: トトス"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={styles.label}>日付</label>
                <input
                  style={styles.input}
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div>
                <label style={styles.label}>時間</label>
                <input
                  style={styles.input}
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData(p => ({ ...p, time: e.target.value }))}
                />
              </div>
            </div>

            <label style={styles.label}>ステータス</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUSES.map(s => (
                <button
                  key={s}
                  style={{
                    ...baseBtn,
                    flex: 1,
                    padding: '10px 8px',
                    fontSize: 13,
                    background: formData.status === s ? STATUS_CONFIG[s].bg : C.bg,
                    color: formData.status === s ? STATUS_CONFIG[s].color : C.textLight,
                    border: `2px solid ${formData.status === s ? STATUS_CONFIG[s].color : C.border}`,
                  }}
                  onClick={() => setFormData(p => ({ ...p, status: s }))}
                >
                  {STATUS_CONFIG[s].icon} {s}
                </button>
              ))}
            </div>

            <label style={styles.label}>ジャンル</label>
            <input
              style={styles.input}
              value={formData.genre}
              onChange={e => setFormData(p => ({ ...p, genre: e.target.value }))}
              placeholder="例: 韓国料理、カフェ"
            />

            <label style={styles.label}>住所</label>
            <input
              style={styles.input}
              value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              placeholder="住所"
            />

            <label style={styles.label}>URL</label>
            <input
              style={styles.input}
              value={formData.url}
              onChange={e => setFormData(p => ({ ...p, url: e.target.value }))}
              placeholder="https://..."
            />

            <label style={styles.label}>メモ</label>
            <textarea
              style={{ ...styles.textarea, minHeight: 60 }}
              value={formData.memo}
              onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
              placeholder="メモ"
              rows={2}
            />

            <button
              style={styles.primaryBtn}
              onClick={handleManualSave}
              disabled={!formData.name.trim()}
            >
              {editItem ? '保存' : '追加'}
            </button>

            {editItem && (
              <button style={styles.dangerBtn} onClick={() => deleteItem(editItem.id)}>
                このスポットを削除
              </button>
            )}

            <button style={styles.secondaryBtn} onClick={() => { setModal(null); setEditItem(null); }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {modal === 'share' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>共有 & エクスポート</div>

            <label style={styles.label}>共有リンク</label>
            <div style={styles.shareBox}>
              <span style={styles.shareUrl}>{getShareUrl()}</span>
              <button style={styles.copyBtn} onClick={copyShareUrl}>
                {copySuccess === 'link' ? '✓' : 'コピー'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>
              このリンクを共有すると、誰でもスケジュールを閲覧できます
            </div>

            <label style={{ ...styles.label, marginTop: 24 }}>テキスト出力</label>
            <div style={{ background: C.bg, borderRadius: 10, padding: 12, maxHeight: 180, overflow: 'auto', fontSize: 13, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace', border: `1px solid ${C.border}` }}>
              {generateTextSchedule() || 'スケジュールがありません'}
            </div>
            <button style={{ ...styles.secondaryBtn, marginTop: 8 }} onClick={copyTextSchedule}>
              {copySuccess === 'text' ? '✓ コピー済み' : '📋 テキストをコピー'}
            </button>

            <label style={{ ...styles.label, marginTop: 24 }}>ダウンロード</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button style={styles.secondaryBtn} onClick={() => exportSchedule('pdf')}>
                📄 PDF
              </button>
              <button style={styles.secondaryBtn} onClick={() => exportSchedule('jpg')}>
                🖼️ JPG
              </button>
            </div>

            <button style={{ ...styles.secondaryBtn, marginTop: 20 }} onClick={() => setModal(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {modal === 'editProject' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>プロジェクト設定</div>

            <label style={styles.label}>プロジェクト名</label>
            <input
              style={styles.input}
              defaultValue={currentProject?.name}
              onBlur={e => updateProjectName(e.target.value)}
            />

            <button style={styles.dangerBtn} onClick={deleteProject}>
              このプロジェクトを削除
            </button>

            <button style={styles.secondaryBtn} onClick={() => setModal(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Hidden Export Element */}
      <div ref={exportRef} style={styles.exportContainer}>
        <h1 style={{ fontSize: 24, color: C.primary, marginBottom: 24 }}>
          {currentProject?.name}
        </h1>
        {sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: C.primary,
              borderBottom: `2px solid ${C.primary}`, paddingBottom: 6, marginBottom: 10,
            }}>
              {formatDate(date)}
            </div>
            {groups[date].map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: '8px 0',
                borderBottom: `1px solid ${C.borderLight}`, fontSize: 14,
              }}>
                <span style={{ width: 50, fontWeight: 700, color: C.primary }}>
                  {item.time || '---'}
                </span>
                <span style={{ flex: 1 }}>{item.name}</span>
                <span style={{
                  color: STATUS_CONFIG[item.status]?.color,
                  fontSize: 12,
                }}>{item.status}</span>
                {item.genre && <span style={{ color: C.textSub, fontSize: 12 }}>{item.genre}</span>}
              </div>
            ))}
          </div>
        ))}
        {undecided.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: C.undecided,
              borderBottom: `2px solid ${C.undecided}`, paddingBottom: 6, marginBottom: 10,
            }}>
              日程未定
            </div>
            {undecided.map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: '8px 0',
                borderBottom: `1px solid ${C.borderLight}`, fontSize: 14,
              }}>
                <span style={{ width: 50, fontWeight: 700, color: C.textLight }}>---</span>
                <span style={{ flex: 1 }}>{item.name}</span>
                <span style={{
                  color: STATUS_CONFIG[item.status]?.color,
                  fontSize: 12,
                }}>{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
