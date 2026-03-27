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
  sortedDates.forEach(date => {
    groups[date].sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  });
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

// ── Item Card Component ──
function ItemCard({ item, onTap, readonly, onTimeChange, onDragStart, onDragOver, onDragEnd, onTouchStart, onTouchMove, onTouchEnd, isDragging }) {
  const [editingTime, setEditingTime] = useState(false);
  const [tempTime, setTempTime] = useState(item.time || '');
  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG['未定'];

  function handleTimeSubmit() {
    if (onTimeChange) onTimeChange(item.id, tempTime || null);
    setEditingTime(false);
  }

  return (
    <div
      style={{
        ...styles.itemCard,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'scale(1.02)' : 'none',
        boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
        transition: isDragging ? 'none' : 'all 0.15s ease',
      }}
      draggable={!readonly}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag Handle */}
      {!readonly && (
        <div style={{
          display: 'flex', alignItems: 'center', padding: '0 4px 0 0',
          color: C.textLight, fontSize: 16, cursor: 'grab', touchAction: 'none',
          userSelect: 'none', flexShrink: 0,
        }}>
          ⠿
        </div>
      )}

      {/* Time - tap to edit */}
      <div style={{ ...styles.itemTime, cursor: readonly ? 'default' : 'pointer', position: 'relative' }}>
        {editingTime && !readonly ? (
          <input
            type="time"
            value={tempTime}
            onChange={e => setTempTime(e.target.value)}
            onBlur={handleTimeSubmit}
            onKeyDown={e => e.key === 'Enter' && handleTimeSubmit()}
            autoFocus
            style={{
              width: 60, border: `1px solid ${C.accent}`, borderRadius: 6,
              padding: '2px 4px', fontSize: 13, fontFamily: '"Noto Sans JP", sans-serif',
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
              padding: '2px 4px', borderRadius: 6,
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
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 16, textDecoration: 'none', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center',
              }}
              onClick={e => e.stopPropagation()}
              title="地図を開く"
            >
              📍
            </a>
          )}
          <span style={styles.statusBadge(item.status)}>{item.status}</span>
        </div>
        {item.genre && <div style={styles.itemSub}>{item.genre}</div>}
        {item.address && <div style={styles.itemSub}>{item.address}</div>}
        {item.memo && <div style={{ ...styles.itemSub, fontStyle: 'italic' }}>{item.memo}</div>}
      </div>

      {!readonly && <span style={styles.chevron} onClick={() => onTap && onTap(item)}>›</span>}
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
  const [copySuccess, setCopySuccess] = useState(false);

  const exportRef = useRef(null);

  // Drag and drop state
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const touchState = useRef({ id: null, startY: 0, el: null, clone: null, moved: false, timer: null });

  function handleTimeChange(id, time) {
    updateItem(id, { time });
  }

  // Desktop drag handlers
  function handleDragStart(e, item) {
    setDragId(item.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e, item) {
    e.preventDefault();
    if (item.id !== dragOverId) setDragOverId(item.id);
  }
  async function handleDragEnd() {
    if (dragId && dragOverId && dragId !== dragOverId) {
      await reorderItems(dragId, dragOverId);
    }
    setDragId(null);
    setDragOverId(null);
  }

  // Touch drag handlers (long press)
  function handleTouchStart(e, item) {
    const touch = e.touches[0];
    touchState.current.startY = touch.clientY;
    touchState.current.id = item.id;
    touchState.current.moved = false;
    touchState.current.timer = setTimeout(() => {
      setDragId(item.id);
      touchState.current.moved = true;
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }
  function handleTouchMove(e) {
    if (!touchState.current.moved) {
      const dy = Math.abs(e.touches[0].clientY - touchState.current.startY);
      if (dy > 10 && !dragId) {
        clearTimeout(touchState.current.timer);
        return;
      }
    }
    if (!dragId) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const card = el.closest('[data-item-id]');
      if (card) {
        const overId = card.getAttribute('data-item-id');
        if (overId !== dragOverId) setDragOverId(overId);
      }
    }
  }
  async function handleTouchEnd() {
    clearTimeout(touchState.current.timer);
    if (dragId && dragOverId && dragId !== dragOverId) {
      await reorderItems(dragId, dragOverId);
    }
    setDragId(null);
    setDragOverId(null);
    touchState.current = { id: null, startY: 0, el: null, clone: null, moved: false, timer: null };
  }

  async function reorderItems(fromId, toId) {
    const newItems = [...items];
    const fromIdx = newItems.findIndex(i => i.id === fromId);
    const toIdx = newItems.findIndex(i => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    // Also swap dates so item moves into the target's date group
    const fromDate = newItems[fromIdx].date;
    const toDate = newItems[toIdx].date;
    const [moved] = newItems.splice(fromIdx, 1);
    moved.date = toDate;
    newItems.splice(toIdx, 0, moved);
    // Update sort_order for all
    const updates = newItems.map((it, i) => ({ ...it, sort_order: i }));
    setItems(updates);
    // Persist
    for (const it of updates) {
      await supabase.from('plan_items').update({ sort_order: it.sort_order, date: it.date }).eq('id', it.id);
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
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = getShareUrl();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  // ── Export ──
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

        {sortedDates.map(date => (
          <div key={date}>
            <div style={styles.dateHeader}>
              <span>{formatDate(date)}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: C.textSub }}>
                {groups[date].length}件
              </span>
            </div>
            {groups[date].map(item => (
              <div key={item.id} data-item-id={item.id} style={{
                borderTop: dragOverId === item.id ? `2px solid ${C.accent}` : '2px solid transparent',
              }}>
                <ItemCard
                  item={item}
                  onTap={openEdit}
                  onTimeChange={handleTimeChange}
                  isDragging={dragId === item.id}
                  onDragStart={e => handleDragStart(e, item)}
                  onDragOver={e => handleDragOver(e, item)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={e => handleTouchStart(e, item)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
            ))}
          </div>
        ))}

        {undecided.length > 0 && (
          <div>
            <div style={{ ...styles.dateHeader, color: C.undecided, borderColor: C.undecided }}>
              <span>📌 日程未定</span>
              <span style={{ fontSize: 12, fontWeight: 400 }}>{undecided.length}件</span>
            </div>
            {undecided.map(item => (
              <div key={item.id} data-item-id={item.id} style={{
                borderTop: dragOverId === item.id ? `2px solid ${C.accent}` : '2px solid transparent',
              }}>
                <ItemCard
                  item={item}
                  onTap={openEdit}
                  onTimeChange={handleTimeChange}
                  isDragging={dragId === item.id}
                  onDragStart={e => handleDragStart(e, item)}
                  onDragOver={e => handleDragOver(e, item)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={e => handleTouchStart(e, item)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
            ))}
          </div>
        )}
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
                {copySuccess ? '✓' : 'コピー'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>
              このリンクを共有すると、誰でもスケジュールを閲覧できます
            </div>

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
