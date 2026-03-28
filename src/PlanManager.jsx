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
  // 同一日内は時間順（時間なしは末尾、同時間はsort_order順）
  sortedDates.forEach(date => {
    groups[date].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time) || (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
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
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  headerBtn: {
    ...baseBtn,
    background: 'rgba(255,255,255,0.15)',
    color: C.white,
    padding: '6px 10px',
    fontSize: 11,
  },
  backBtn: {
    ...baseBtn,
    background: 'none',
    color: C.white,
    padding: '4px 0',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
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
    background: 'rgba(0,0,0,0.35)',
    zIndex: 200,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  modalContent: {
    background: C.card,
    borderRadius: 16,
    width: 'calc(100% - 24px)',
    maxWidth: 480,
    margin: '40px auto 60px',
    padding: '20px 18px 28px',
    position: 'relative',
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
    borderRadius: 8,
    padding: '11px 12px',
    fontSize: 16,
    fontFamily: '"Noto Sans JP", sans-serif',
    color: C.text,
    background: '#f9f8f5',
    boxSizing: 'border-box',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    maxWidth: '100%',
  },
  textarea: {
    width: '100%',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '11px 12px',
    fontSize: 16,
    fontFamily: '"Noto Sans JP", sans-serif',
    color: C.text,
    background: '#f9f8f5',
    boxSizing: 'border-box',
    outline: 'none',
    resize: 'vertical',
    minHeight: 80,
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
    fontSize: 13,
    fontWeight: 800,
    color: C.primary,
    padding: '20px 0 6px',
    borderBottom: `1.5px solid ${C.primary}`,
    marginBottom: 8,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    letterSpacing: '0.5px',
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

// ── Item Card Component (minimal, refined) ──
function ItemCard({ item, onTap, readonly, onTimeChange }) {
  const [editingTime, setEditingTime] = useState(false);
  const [tempTime, setTempTime] = useState(item.time || '');

  function handleTimeSubmit() {
    if (onTimeChange) onTimeChange(item.id, tempTime || null);
    setEditingTime(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      {!readonly && (
        <div className="drag-handle" style={{
          color: C.textLight, fontSize: 14, cursor: 'grab', touchAction: 'none',
          userSelect: 'none', flexShrink: 0, opacity: 0.4,
        }}>⠿</div>
      )}

      {/* Time */}
      <div style={{ minWidth: 46, flexShrink: 0 }}>
        {editingTime && !readonly ? (
          <input type="time" value={tempTime}
            onChange={e => setTempTime(e.target.value)}
            onBlur={handleTimeSubmit}
            onKeyDown={e => e.key === 'Enter' && handleTimeSubmit()}
            autoFocus
            style={{ width: 58, border: `1.5px solid ${C.accent}`, borderRadius: 5,
              padding: '3px 4px', fontSize: 14, fontFamily: '"Noto Sans JP", sans-serif',
              color: C.primary, background: '#fff', outline: 'none' }}
            onClick={e => e.stopPropagation()} />
        ) : (
          <span onClick={e => { if (readonly) return; e.stopPropagation(); setTempTime(item.time || ''); setEditingTime(true); }}
            style={{ fontSize: 14, fontWeight: 700, color: item.time ? C.primary : C.textLight,
              fontVariantNumeric: 'tabular-nums', cursor: readonly ? 'default' : 'pointer',
              letterSpacing: '0.5px' }}>
            {item.time || '---'}
          </span>
        )}
      </div>

      {/* Name + indicators */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={() => !readonly && onTap && onTap(item)}>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, textDecoration: 'none', flexShrink: 0, opacity: 0.5 }}
            onClick={e => e.stopPropagation()}>📍</a>
        )}
      </div>

      {/* Right side: tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {item.want_photo && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#1565c0', background: '#e3f2fd',
            padding: '2px 5px', borderRadius: 3, letterSpacing: '0.3px' }}>📷</span>
        )}
        {item.price != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#bf360c',
            fontVariantNumeric: 'tabular-nums' }}>₩{Number(item.price).toLocaleString()}</span>
        )}
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          color: STATUS_CONFIG[item.status]?.color || C.undecided,
          background: STATUS_CONFIG[item.status]?.bg || C.undecidedBg }}>
          {STATUS_CONFIG[item.status]?.icon || '○'}
        </span>
        {!readonly && <span style={{ color: C.textLight, fontSize: 14, marginLeft: 2 }}
          onClick={() => onTap && onTap(item)}>›</span>}
      </div>
    </div>
  );
}

// ── Sortable List with Touch Drag ──
function SortableList({ items: flatItems, onReorder, renderItem, renderSectionHeader }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const containerRef = useRef(null);
  const rectsRef = useRef([]);
  const dragRef = useRef({ active: false, timer: null, startY: 0, rafId: null, lastOverIdx: -1 });

  function recordRects() {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-sort-idx]');
    rectsRef.current = Array.from(cards).map(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });
  }

  function idxFromY(clientY) {
    const y = clientY + window.scrollY;
    for (let i = 0; i < rectsRef.current.length; i++) {
      const r = rectsRef.current[i];
      const mid = r.top + r.height / 2;
      if (y < mid) return i;
    }
    return rectsRef.current.length - 1;
  }

  function cleanup() {
    clearTimeout(dragRef.current.timer);
    if (dragRef.current.rafId) cancelAnimationFrame(dragRef.current.rafId);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    dragRef.current.active = false;
    dragRef.current.lastOverIdx = -1;
    setDragIdx(null);
    setOverIdx(null);
  }

  function onTouchStart(e) {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const el = e.target.closest('[data-sort-idx]');
    if (!el) return;
    const idx = parseInt(el.getAttribute('data-sort-idx'));
    const touch = e.touches[0];
    dragRef.current.startY = touch.clientY;

    dragRef.current.timer = setTimeout(() => {
      dragRef.current.active = true;
      recordRects();
      setDragIdx(idx);
      setOverIdx(idx);
      dragRef.current.lastOverIdx = idx;
      if (navigator.vibrate) navigator.vibrate(15);
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }, 150);
  }

  function onTouchMove(e) {
    if (!dragRef.current.active) {
      const dy = Math.abs(e.touches[0].clientY - dragRef.current.startY);
      if (dy > 10) clearTimeout(dragRef.current.timer);
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];

    // Auto-scroll at edges
    const edge = 80, speed = 12;
    if (touch.clientY < edge) window.scrollBy(0, -speed);
    else if (touch.clientY > window.innerHeight - edge) window.scrollBy(0, speed);

    // RAF throttle — only update state once per frame
    if (dragRef.current.rafId) cancelAnimationFrame(dragRef.current.rafId);
    dragRef.current.rafId = requestAnimationFrame(() => {
      const newOver = idxFromY(touch.clientY);
      if (newOver !== dragRef.current.lastOverIdx) {
        dragRef.current.lastOverIdx = newOver;
        setOverIdx(newOver);
      }
    });
  }

  function onTouchEnd() {
    if (dragRef.current.active && dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      onReorder(dragIdx, overIdx);
    }
    cleanup();
  }

  const displayItems = (() => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) return flatItems;
    const arr = [...flatItems];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(overIdx, 0, moved);
    return arr;
  })();

  const draggingItem = dragIdx !== null ? flatItems[dragIdx] : null;
  const isDragging = dragIdx !== null;

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={cleanup}
      style={{ position: 'relative' }}
    >
      {displayItems.map((item, idx) => {
        const isDraggedItem = draggingItem && item.id === draggingItem.id;
        const hasPrice = item.price != null;
        const hasPhoto = item.want_photo;

        // Subtle left accent based on state
        const accent = isDraggedItem ? `3px solid ${C.confirmed}`
          : hasPhoto ? '3px solid #90caf9'
          : hasPrice ? '3px solid #ffcc80'
          : '3px solid transparent';

        const bg = isDraggedItem ? '#f1f8e9'
          : hasPhoto ? '#f5f9ff'
          : hasPrice ? '#fffcf5'
          : '#fff';

        return (
          <div key={item.id}>
            {renderSectionHeader && renderSectionHeader(item, idx, displayItems)}
            <div
              data-sort-idx={idx}
              style={{
                background: bg,
                borderLeft: accent,
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 6,
                boxShadow: isDraggedItem ? '0 2px 12px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: isDragging ? 'none' : 'all 0.12s ease',
              }}
            >
              {renderItem(item, idx)}
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
    name: '', url: '', address: '', date: '', time: '', status: '未定', genre: '', memo: '', price: '', want_photo: false,
  });
  const [newProjectName, setNewProjectName] = useState('');
  const [copySuccess, setCopySuccess] = useState(null); // null | 'link' | 'text'
  const [exportIncludeUrl, setExportIncludeUrl] = useState(false);
  const [exportPriceOnly, setExportPriceOnly] = useState(false);

  const exportRef = useRef(null);

  function handleTimeChange(id, time) {
    updateItem(id, { time });
  }

  function handleDateChange(id, date) {
    updateItem(id, { date });
  }

  function handleTogglePhoto(id, value) {
    updateItem(id, { want_photo: value });
  }

  // Build flat ordered list from grouped data
  function buildFlatList() {
    const flat = [];
    const filtered = statusFilter === 'all'
      ? items
      : statusFilter === 'price'
      ? items.filter(it => it.price != null)
      : items.filter(it => it.status === statusFilter);
    const { groups: g, sortedDates: sd, undecided: u } = groupByDate(filtered);
    for (const d of sd) for (const it of g[d]) flat.push(it);
    for (const it of u) flat.push(it);
    return flat;
  }

  async function handleReorder(fromIdx, toIdx) {
    const flat = buildFlatList();
    const arr = [...flat];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);

    // Determine new date and time from neighbors
    const prev = toIdx > 0 ? arr[toIdx - 1] : null;
    const next = toIdx < arr.length - 1 ? arr[toIdx + 1] : null;

    // Adopt date from nearest neighbor
    const neighborDate = (prev?.date || next?.date) || moved.date;
    moved.date = neighborDate;

    // Auto-assign time between neighbors if both have times on same date
    if (prev?.date === neighborDate && next?.date === neighborDate && prev?.time && next?.time) {
      moved.time = midpointTime(prev.time, next.time);
    } else if (prev?.date === neighborDate && prev?.time && (!next || next?.date !== neighborDate)) {
      // After last item with time: add 30 min
      moved.time = addMinutes(prev.time, 30);
    } else if (next?.date === neighborDate && next?.time && (!prev || prev?.date !== neighborDate)) {
      // Before first item with time: subtract 30 min
      moved.time = addMinutes(next.time, -30);
    }

    // Update sort_order for all reordered items
    const updates = arr.map((it, i) => ({ ...it, sort_order: i }));
    const updatedIds = new Set(updates.map(u => u.id));
    const newItems = [
      ...updates,
      ...items.filter(it => !updatedIds.has(it.id)),
    ];
    setItems(newItems);

    // Persist moved item's date + time + sort_order, others just sort_order
    for (const it of updates) {
      if (it.id === moved.id) {
        await supabase.from('plan_items').update({ sort_order: it.sort_order, date: it.date, time: it.time }).eq('id', it.id);
      } else {
        await supabase.from('plan_items').update({ sort_order: it.sort_order }).eq('id', it.id);
      }
    }
  }

  function midpointTime(t1, t2) {
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;
    const mid = Math.round((min1 + min2) / 2);
    // Round to nearest 5 min
    const rounded = Math.round(mid / 5) * 5;
    const h = Math.floor(rounded / 60) % 24;
    const m = rounded % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function addMinutes(t, mins) {
    const [h, m] = t.split(':').map(Number);
    let total = h * 60 + m + mins;
    if (total < 0) total = 0;
    if (total >= 1440) total = 1439;
    const rh = Math.floor(total / 60);
    const rm = total % 60;
    return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
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
      price: formData.price !== '' ? parseInt(formData.price) : null,
      want_photo: formData.want_photo || false,
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
      name: '', url: '', address: '', date: '', time: '', status: '未定', genre: '', memo: '', price: '', want_photo: false,
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
      price: item.price != null ? String(item.price) : '',
      want_photo: item.want_photo || false,
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
  function generateTextSchedule(opts = {}) {
    const { includeUrl = false, priceOnly = false } = opts;
    const src = priceOnly ? items.filter(it => it.price != null) : items;
    const { groups, sortedDates, undecided } = groupByDate(src);
    let text = '';
    for (const date of sortedDates) {
      text += formatDate(date) + '\n';
      for (const item of groups[date]) {
        text += (item.time || '---') + ' ' + item.name;
        if (item.price != null) text += ' ₩' + Number(item.price).toLocaleString();
        if (includeUrl && item.url) text += ' ' + item.url;
        text += '\n';
      }
      text += '\n';
    }
    if (undecided.length > 0) {
      text += '日程未定\n';
      for (const item of undecided) {
        text += (item.time || '---') + ' ' + item.name;
        if (item.price != null) text += ' ₩' + Number(item.price).toLocaleString();
        if (includeUrl && item.url) text += ' ' + item.url;
        text += '\n';
      }
    }
    if (priceOnly) {
      const total = src.reduce((s, it) => s + (it.price || 0), 0);
      text += '\n合計: ₩' + total.toLocaleString() + ' (' + src.length + '件)';
    }
    return text.trim();
  }

  async function copyTextSchedule(opts = {}) {
    const text = generateTextSchedule(opts);
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

  async function exportSchedule(format, priceOnly = false) {
    const el = exportRef.current;
    if (!el) return;

    // Temporarily update export content
    const src = priceOnly ? items.filter(it => it.price != null) : items;
    const { groups: eg, sortedDates: esd, undecided: eu } = groupByDate(src);
    const total = priceOnly ? src.reduce((s, it) => s + (it.price || 0), 0) : null;

    // Build HTML for export
    let html = `<h1 style="font-size:24px;color:${C.primary};margin-bottom:24px;font-family:'Noto Sans JP',sans-serif">${currentProject?.name}${priceOnly ? ' — 金額一覧' : ''}</h1>`;
    for (const date of esd) {
      html += `<div style="font-size:16px;font-weight:700;color:${C.primary};border-bottom:2px solid ${C.primary};padding-bottom:6px;margin-bottom:10px">${formatDate(date)}</div>`;
      for (const item of eg[date]) {
        html += `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${C.borderLight};font-size:14px;font-family:'Noto Sans JP',sans-serif">`;
        html += `<span style="width:50px;font-weight:700;color:${C.primary}">${item.time || '---'}</span>`;
        html += `<span style="flex:1">${item.name}</span>`;
        if (item.price != null) html += `<span style="color:#e65100;font-weight:600">₩${Number(item.price).toLocaleString()}</span>`;
        html += `<span style="color:${STATUS_CONFIG[item.status]?.color};font-size:12px">${item.status}</span>`;
        html += `</div>`;
      }
      html += `<div style="margin-bottom:20px"></div>`;
    }
    if (eu.length > 0) {
      html += `<div style="font-size:16px;font-weight:700;color:${C.undecided};border-bottom:2px solid ${C.undecided};padding-bottom:6px;margin-bottom:10px">日程未定</div>`;
      for (const item of eu) {
        html += `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${C.borderLight};font-size:14px;font-family:'Noto Sans JP',sans-serif">`;
        html += `<span style="width:50px;font-weight:700;color:${C.textLight}">---</span>`;
        html += `<span style="flex:1">${item.name}</span>`;
        if (item.price != null) html += `<span style="color:#e65100;font-weight:600">₩${Number(item.price).toLocaleString()}</span>`;
        html += `</div>`;
      }
    }
    if (total != null) {
      html += `<div style="margin-top:20px;padding:12px;border-top:2px solid ${C.primary};font-size:16px;font-weight:700;font-family:'Noto Sans JP',sans-serif">合計: ₩${total.toLocaleString()} (${src.length}件)</div>`;
    }

    el.innerHTML = html;

    const html2canvas = (await import('html2canvas')).default;
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '9999';

    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

    el.style.position = 'absolute';
    el.style.left = '-9999px';

    if (format === 'jpg') {
      const link = document.createElement('a');
      link.download = `${currentProject.name}${priceOnly ? '_金額' : ''}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'px', [canvas.width / 2, canvas.height / 2]);
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${currentProject.name}${priceOnly ? '_金額' : ''}.pdf`);
    }
  }

  // ── Filtered Items ──
  const filteredItems = statusFilter === 'all'
    ? items
    : statusFilter === 'price'
    ? items.filter(it => it.price != null)
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
        <span style={{ ...styles.headerTitle, flex: 1, textAlign: 'center', fontSize: 13 }}>
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
          <button
            style={{
              ...styles.tab(statusFilter === 'price'),
              background: statusFilter === 'price' ? '#e65100' : C.card,
              color: statusFilter === 'price' ? C.white : C.textSub,
              borderColor: statusFilter === 'price' ? '#e65100' : C.border,
            }}
            onClick={() => setStatusFilter('price')}
          >
            ₩ 金額あり ({items.filter(it => it.price != null).length})
          </button>
        </div>

        {/* Price Summary */}
        {(() => {
          const priceItems = items.filter(it => it.price != null);
          if (priceItems.length === 0) return null;
          const total = priceItems.reduce((s, it) => s + (it.price || 0), 0);
          return (
            <div style={{
              background: '#fff8f0', border: '1px solid #ffb74d', borderRadius: 10,
              padding: '10px 14px', marginTop: 8, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>
                💰 {priceItems.length}件
              </span>
              <span style={{ fontSize: 16, color: '#e65100', fontWeight: 700 }}>
                合計 ₩{total.toLocaleString()}
              </span>
            </div>
          );
        })()}
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
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>
                {editItem ? 'スポット編集' : 'スポット追加'}
              </span>
              <button onClick={() => { setModal(null); setEditItem(null); }}
                style={{ ...baseBtn, background: 'none', color: C.textLight, fontSize: 22, padding: '4px 8px' }}>×</button>
            </div>

            {/* NAVER MAP overwrite (edit only) */}
            {editItem && (
              <div style={{ marginBottom: 14, padding: 12, background: '#f8f7f4', borderRadius: 10, border: `1px dashed ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>📍 NAVER MAPで上書き</div>
                <textarea
                  style={{ ...styles.textarea, minHeight: 60, fontSize: 14 }}
                  placeholder="NAVER MAPのコピーを貼り付け"
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={2}
                />
                {pasteText && (() => {
                  const p = parseNaverMap(pasteText);
                  return (
                    <button
                      style={{ ...baseBtn, background: C.accent, color: C.white, padding: '6px 14px', fontSize: 12, marginTop: 6 }}
                      onClick={() => { setFormData(prev => ({ ...prev, name: p.name || prev.name, url: p.url || prev.url, address: p.address || prev.address })); setPasteText(''); }}
                    >→ {p.name || '—'} を反映</button>
                  );
                })()}
              </div>
            )}

            {/* Form fields - compact grid */}
            <input style={{ ...styles.input, marginBottom: 10, fontWeight: 600, height: 44 }} value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="店名 / スポット名 *" />

            <input type="datetime-local"
              value={(formData.date && formData.time) ? `${formData.date}T${formData.time}` : formData.date ? `${formData.date}T00:00` : ''}
              onChange={e => {
                const v = e.target.value;
                if (v) {
                  const [d, t] = v.split('T');
                  setFormData(p => ({ ...p, date: d, time: t }));
                } else {
                  setFormData(p => ({ ...p, date: '', time: '' }));
                }
              }}
              style={{ ...styles.input, marginBottom: 10, height: 44 }}
            />

            {/* Status row */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {STATUSES.map(s => (
                <button key={s}
                  style={{
                    ...baseBtn, flex: 1, padding: '9px 4px', fontSize: 12,
                    background: formData.status === s ? STATUS_CONFIG[s].bg : '#f5f4f1',
                    color: formData.status === s ? STATUS_CONFIG[s].color : C.textLight,
                    border: `1.5px solid ${formData.status === s ? STATUS_CONFIG[s].color : 'transparent'}`,
                  }}
                  onClick={() => setFormData(p => ({ ...p, status: s }))}
                >{STATUS_CONFIG[s].icon} {s}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <input style={styles.input} value={formData.genre}
                onChange={e => setFormData(p => ({ ...p, genre: e.target.value }))} placeholder="ジャンル" />
              <input style={styles.input} type="number" inputMode="numeric" value={formData.price}
                onChange={e => setFormData(p => ({ ...p, price: e.target.value }))} placeholder="金額 ₩" />
            </div>

            {/* Toggle buttons row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                style={{
                  ...baseBtn, flex: 1, padding: '10px', fontSize: 12,
                  background: formData.want_photo ? '#e3f2fd' : '#f5f4f1',
                  color: formData.want_photo ? '#1565c0' : C.textSub,
                  border: `1.5px solid ${formData.want_photo ? '#90caf9' : 'transparent'}`,
                }}
                onClick={() => setFormData(p => ({ ...p, want_photo: !p.want_photo }))}
              >📷 撮りたい絵{formData.want_photo ? ' ✓' : ''}</button>
              {editItem && formData.date && (
                <button
                  style={{ ...baseBtn, flex: 1, padding: '10px', fontSize: 12,
                    background: '#f5f4f1', color: C.undecided, border: '1.5px solid transparent' }}
                  onClick={() => setFormData(p => ({ ...p, date: '' }))}
                >✕ 日程未定に戻す</button>
              )}
            </div>

            <input style={{ ...styles.input, marginBottom: 8 }} value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} placeholder="住所" />
            <input style={{ ...styles.input, marginBottom: 8 }} value={formData.url}
              onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} placeholder="URL https://..." />
            <textarea style={{ ...styles.textarea, minHeight: 50, marginBottom: 12 }} value={formData.memo}
              onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))} placeholder="メモ" rows={2} />

            {/* Action buttons */}
            <button style={styles.primaryBtn} onClick={handleManualSave} disabled={!formData.name.trim()}>
              {editItem ? '保存' : '追加'}
            </button>
            {editItem && (
              <button style={{ ...styles.dangerBtn, marginTop: 8 }} onClick={() => deleteItem(editItem.id)}>
                削除
              </button>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {modal === 'share' && (
        <div style={styles.modal} onClick={() => setModal(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>共有 & エクスポート</span>
              <button onClick={() => setModal(null)}
                style={{ ...baseBtn, background: 'none', color: C.textLight, fontSize: 22, padding: '4px 8px' }}>×</button>
            </div>

            {/* Share link */}
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>共有リンク</div>
            <div style={styles.shareBox}>
              <span style={styles.shareUrl}>{getShareUrl()}</span>
              <button style={styles.copyBtn} onClick={copyShareUrl}>
                {copySuccess === 'link' ? '✓' : 'コピー'}
              </button>
            </div>

            {/* Export scope toggle */}
            <div style={{ display: 'flex', gap: 6, marginTop: 20, marginBottom: 10 }}>
              <button style={{
                ...baseBtn, flex: 1, padding: '8px', fontSize: 12,
                background: !exportPriceOnly ? C.primary : '#f5f4f1',
                color: !exportPriceOnly ? C.white : C.textSub,
                border: `1.5px solid ${!exportPriceOnly ? C.primary : 'transparent'}`,
              }} onClick={() => setExportPriceOnly(false)}>すべて</button>
              <button style={{
                ...baseBtn, flex: 1, padding: '8px', fontSize: 12,
                background: exportPriceOnly ? '#e65100' : '#f5f4f1',
                color: exportPriceOnly ? C.white : C.textSub,
                border: `1.5px solid ${exportPriceOnly ? '#e65100' : 'transparent'}`,
              }} onClick={() => setExportPriceOnly(true)}>₩ 金額ありのみ</button>
            </div>

            {/* Text preview */}
            <div style={{ background: '#f8f7f4', borderRadius: 8, padding: 10, maxHeight: 160, overflow: 'auto',
              fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace',
              border: `1px solid ${C.border}` }}>
              {generateTextSchedule({ includeUrl: exportIncludeUrl, priceOnly: exportPriceOnly }) || 'データなし'}
            </div>

            {/* URL toggle + copy */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textSub, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={exportIncludeUrl} onChange={e => setExportIncludeUrl(e.target.checked)}
                  style={{ width: 16, height: 16 }} />
                URLを含める
              </label>
              <button style={{ ...styles.secondaryBtn, flex: 1, marginTop: 0, padding: '8px', fontSize: 12 }}
                onClick={() => copyTextSchedule({ includeUrl: exportIncludeUrl, priceOnly: exportPriceOnly })}>
                {copySuccess === 'text' ? '✓ コピー済み' : '📋 テキストコピー'}
              </button>
            </div>

            {/* PDF / JPG */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button style={{ ...styles.secondaryBtn, marginTop: 0, padding: '8px', fontSize: 12 }}
                onClick={() => exportSchedule('pdf', exportPriceOnly)}>📄 PDF</button>
              <button style={{ ...styles.secondaryBtn, marginTop: 0, padding: '8px', fontSize: 12 }}
                onClick={() => exportSchedule('jpg', exportPriceOnly)}>🖼️ JPG</button>
            </div>
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
      <div ref={exportRef} style={styles.exportContainer}></div>
    </div>
  );
}
