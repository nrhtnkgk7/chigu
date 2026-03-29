import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'react-router-dom';

const SUPABASE_URL = 'https://thukxeznpnwfqtoehyvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRodWt4ZXpucG53ZnF0b2VoeXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzk1NTMsImV4cCI6MjA4ODQxNTU1M30._ZqXyb1slx-8WNmebptkeTNJdv-aUlJGRAwJZdsFkqo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 1 } },
  global: { headers: { 'X-Client-Info': 'chigu-plan' } },
  db: { schema: 'public' },
});

// ── Security Utilities ──
function sanitize(str, maxLen = 500) {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '')           // Strip HTML brackets
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars
    .trim()
    .slice(0, maxLen);
}

function isValidUrl(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function isValidShareId(str) {
  return /^[0-9a-f]{12,64}$/i.test(str);
}

// Rate limiter: prevent rapid-fire operations
const rateLimiter = (() => {
  const last = {};
  return (key, intervalMs = 500) => {
    const now = Date.now();
    if (last[key] && now - last[key] < intervalMs) return false;
    last[key] = now;
    return true;
  };
})();

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
  confirmed: '#43a047',
  confirmedBg: '#e8f5e9',
  maybe: '#f57c00',
  maybeBg: '#fff3e0',
  undecided: '#b0bec5',
  undecidedBg: '#f5f5f5',
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
  if (!text || text.length > 5000) return { name: '', url: '', address: '' };
  const lines = text.split('\n').map(l => l.trim()).filter(l => l).slice(0, 20);
  const result = { name: '', url: '', address: '' };
  const filtered = lines.filter(l =>
    !l.startsWith('[') || !l.includes('NAVER')
  );
  for (const line of filtered) {
    if (line.match(/^https?:\/\//) && !result.url) {
      result.url = sanitize(line, 2000);
    } else if (
      line.match(/[시도군구읍면동리로길]/) ||
      line.match(/[市区町村]/) ||
      line.match(/특별시|광역시|특별자치/)
    ) {
      result.address = sanitize(line, 500);
    } else if (!result.name) {
      result.name = sanitize(line, 200);
    }
  }
  return result;
}

function parseBulkSchedule(text, defaultYear) {
  if (!text || text.length > 10000) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l).slice(0, 200);
  const items = [];
  let currentDate = null;
  const year = defaultYear || new Date().getFullYear();
  const MAX_ITEMS = 100;

  for (const line of lines) {
    if (items.length >= MAX_ITEMS) break;
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
          name: sanitize(timeMatch[2], 200),
          time: timeMatch[1],
          date: currentDate,
          status: '未定',
        });
      } else if (line.length > 0) {
        items.push({
          name: sanitize(line, 200),
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
    background: '#ece8e3',
    borderRadius: 8,
    padding: 2,
    margin: '8px 0',
  },
  tab: (active, accentColor) => ({
    border: 'none',
    borderRadius: 6,
    padding: '7px 0',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    flex: 1,
    fontFamily: '"Noto Sans JP", sans-serif',
    whiteSpace: 'nowrap',
    background: active ? '#fff' : 'transparent',
    color: active ? (accentColor || C.primary) : C.textLight,
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.15s ease',
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

// ── Item Card Component (flat list style) ──
function ItemCard({ item, onTap, readonly, onTimeChange, hidePrivate }) {
  const [editingTime, setEditingTime] = useState(false);
  const [tempTime, setTempTime] = useState(item.time || '');

  function handleTimeSubmit() {
    if (onTimeChange) onTimeChange(item.id, tempTime || null);
    setEditingTime(false);
  }

  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG['未定'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>

      {/* Time */}
      <div style={{ width: 42, flexShrink: 0 }}>
        {editingTime && !readonly ? (
          <input type="time" value={tempTime}
            onChange={e => setTempTime(e.target.value)}
            onBlur={handleTimeSubmit}
            onKeyDown={e => e.key === 'Enter' && handleTimeSubmit()}
            autoFocus
            style={{ width: 56, border: `1.5px solid ${C.accent}`, borderRadius: 5,
              padding: '3px 4px', fontSize: 13, fontFamily: '"Noto Sans JP", sans-serif',
              color: C.primary, background: '#fff', outline: 'none' }}
            onClick={e => e.stopPropagation()} />
        ) : (
          <span onClick={e => { if (readonly) return; e.stopPropagation(); setTempTime(item.time || ''); setEditingTime(true); }}
            style={{ fontSize: 13, fontWeight: 700, color: item.time ? C.primary : C.textLight,
              fontVariantNumeric: 'tabular-nums', cursor: readonly ? 'default' : 'pointer' }}>
            {item.time || '---'}
          </span>
        )}
      </div>

      {/* Name */}
      <span style={{ fontSize: 14, fontWeight: 500, flex: 1, color: C.text, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: readonly ? 'default' : 'pointer' }}
        onClick={() => !readonly && onTap && onTap(item)}>
        {item.name}
      </span>

      {/* Right indicators */}
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, textDecoration: 'none', flexShrink: 0, opacity: 0.35 }}
          onClick={e => e.stopPropagation()}>📍</a>
      )}
      {!hidePrivate && item.want_photo && <span style={{ fontSize: 8, color: '#1a5eb8', flexShrink: 0 }}>📷</span>}
      {!hidePrivate && item.price != null && (
        <span style={{ fontSize: 10, fontWeight: 600, color: '#c43e00', flexShrink: 0,
          fontVariantNumeric: 'tabular-nums' }}>₩{(item.price / 1000).toFixed(0)}k</span>
      )}
      <span style={{ width: 10, height: 10, borderRadius: 5, background: sc.color, flexShrink: 0 }} />
      {!readonly && <span style={{ color: C.textLight, fontSize: 12, flexShrink: 0 }}
        onClick={() => onTap && onTap(item)}>›</span>}
    </div>
  );
}

// ── Sortable List with Touch Drag ──
function SimpleList({ items: flatItems, renderItem, renderSectionHeader }) {
  return (
    <div>
      {flatItems.map((item, idx) => {
        const hasPrice = item.price != null;
        const hasPhoto = item.want_photo;
        const isLast = idx === flatItems.length - 1;
        const nextItem = !isLast ? flatItems[idx + 1] : null;
        const sameDateAsNext = nextItem && (item.date || null) === (nextItem.date || null);

        return (
          <div key={item.id}>
            {renderSectionHeader && renderSectionHeader(item, idx, flatItems)}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 4px',
              borderBottom: sameDateAsNext ? `1px solid ${C.borderLight}` : 'none',
            }}>
              <div style={{
                width: 3, height: 20, borderRadius: 2, flexShrink: 0,
                background: hasPhoto ? '#5c9ce6'
                  : hasPrice ? '#e8a040'
                  : 'transparent',
              }} />
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

  // ── Shared View ──
  useEffect(() => {
    if (shareId) {
      loadSharedProject(shareId);
    } else {
      loadProjects();
    }
  }, [shareId]);

  async function loadSharedProject(sid) {
    if (!isValidShareId(sid)) return;
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
      console.error('loadProjects error');
      alert('読み込みエラーが発生しました。ページをリロードしてください。');
    }
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    if (!rateLimiter('createProject', 1000)) return;
    const safeName = sanitize(newProjectName, 200);
    if (!safeName) return;
    const { data, error } = await supabase
      .from('plan_projects')
      .insert({ name: safeName })
      .select()
      .single();
    if (error) {
      alert('作成に失敗しました。もう一度お試しください。');
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
    if (!rateLimiter('updateProject', 500)) return;
    const safeName = sanitize(name, 200);
    if (!safeName) return;
    await supabase
      .from('plan_projects')
      .update({ name: safeName })
      .eq('id', currentProject.id);
    setCurrentProject(prev => ({ ...prev, name: safeName }));
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, name: safeName } : p));
    setModal(null);
  }

  async function deleteProject() {
    if (!currentProject) return;
    if (!rateLimiter('deleteProject', 2000)) return;
    if (!window.confirm(`「${currentProject.name}」を削除しますか？`)) return;
    if (!window.confirm('この操作は取り消せません。本当に削除しますか？')) return;
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
    if (!rateLimiter('addItem', 500)) return;
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
      alert('追加に失敗しました。');
      return;
    }
    if (data) setItems(prev => [...prev, data]);
  }

  async function addItems(itemsArr) {
    if (!rateLimiter('addItems', 1000)) return;
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
      alert('一括追加に失敗しました。');
      return;
    }
    if (data) setItems(prev => [...prev, ...data]);
  }

  async function updateItem(id, updates) {
    if (!rateLimiter('updateItem', 300)) return;
    await supabase.from('plan_items').update(updates).eq('id', id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  }

  async function deleteItem(id) {
    if (!rateLimiter('deleteItem', 500)) return;
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
    // Input validation
    const name = (formData.name || '').trim().slice(0, 200);
    if (!name) return;
    const url = (formData.url || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      alert('URLはhttps://で始まる必要があります');
      return;
    }
    const price = formData.price !== '' ? Math.max(0, parseInt(formData.price) || 0) : null;

    const data = {
      name,
      url: url || null,
      address: (formData.address || '').trim().slice(0, 500) || null,
      date: formData.date || null,
      time: formData.time || null,
      status: formData.status,
      genre: (formData.genre || '').trim().slice(0, 100) || null,
      memo: (formData.memo || '').trim().slice(0, 1000) || null,
      price,
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

    const src = priceOnly ? items.filter(it => it.price != null) : items;
    const { groups: eg, sortedDates: esd, undecided: eu } = groupByDate(src);
    const total = priceOnly ? src.reduce((s, it) => s + (it.price || 0), 0) : null;

    // Build DOM safely (no innerHTML)
    el.textContent = '';
    const h1 = document.createElement('h1');
    h1.textContent = `${currentProject?.name}${priceOnly ? ' — 金額一覧' : ''}`;
    Object.assign(h1.style, { fontSize: '24px', color: C.primary, marginBottom: '24px', fontFamily: '"Noto Sans JP", sans-serif' });
    el.appendChild(h1);

    function addSection(dateStr, sectionItems, isUndecided) {
      const hdr = document.createElement('div');
      hdr.textContent = isUndecided ? '日程未定' : formatDate(dateStr);
      Object.assign(hdr.style, { fontSize: '16px', fontWeight: '700', color: isUndecided ? C.undecided : C.primary, borderBottom: `2px solid ${isUndecided ? C.undecided : C.primary}`, paddingBottom: '6px', marginBottom: '10px' });
      el.appendChild(hdr);
      for (const item of sectionItems) {
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '12px', padding: '8px 0', borderBottom: `1px solid ${C.borderLight}`, fontSize: '14px', fontFamily: '"Noto Sans JP", sans-serif' });
        const time = document.createElement('span');
        time.textContent = item.time || '---';
        Object.assign(time.style, { width: '50px', fontWeight: '700', color: C.primary });
        row.appendChild(time);
        const name = document.createElement('span');
        name.textContent = item.name;
        Object.assign(name.style, { flex: '1' });
        row.appendChild(name);
        if (item.price != null) {
          const price = document.createElement('span');
          price.textContent = `₩${Number(item.price).toLocaleString()}`;
          Object.assign(price.style, { color: '#e65100', fontWeight: '600' });
          row.appendChild(price);
        }
        const status = document.createElement('span');
        status.textContent = item.status;
        Object.assign(status.style, { color: STATUS_CONFIG[item.status]?.color || C.undecided, fontSize: '12px' });
        row.appendChild(status);
        el.appendChild(row);
      }
      const spacer = document.createElement('div');
      spacer.style.marginBottom = '20px';
      el.appendChild(spacer);
    }

    for (const date of esd) addSection(date, eg[date], false);
    if (eu.length > 0) addSection(null, eu, true);

    if (total != null) {
      const totalDiv = document.createElement('div');
      totalDiv.textContent = `合計: ₩${total.toLocaleString()} (${src.length}件)`;
      Object.assign(totalDiv.style, { marginTop: '20px', padding: '12px', borderTop: `2px solid ${C.primary}`, fontSize: '16px', fontWeight: '700', fontFamily: '"Noto Sans JP", sans-serif' });
      el.appendChild(totalDiv);
    }

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
                <ItemCard key={item.id} item={item} readonly hidePrivate />
              ))}
            </div>
          ))}
          {undecided.length > 0 && (
            <div>
              <div style={{ ...styles.dateHeader, color: C.undecided, borderColor: C.undecided }}>
                日程未定
              </div>
              {undecided.map(item => (
                <ItemCard key={item.id} item={item} readonly hidePrivate />
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

      {/* Segment Filter */}
      <div style={{ padding: '0 12px', maxWidth: 600, margin: '0 auto' }}>
        <div style={styles.tabBar}>
          <button style={styles.tab(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>
            全 {items.length}
          </button>
          {STATUSES.map(s => {
            const count = items.filter(it => it.status === s).length;
            return (
              <button key={s} style={styles.tab(statusFilter === s, STATUS_CONFIG[s].color)}
                onClick={() => setStatusFilter(s)}>
                {STATUS_CONFIG[s].icon} {count}
              </button>
            );
          })}
          <button
            style={styles.tab(statusFilter === 'price', '#e65100')}
            onClick={() => setStatusFilter('price')}
          >
            ₩ {items.filter(it => it.price != null).length}
          </button>
        </div>

        {/* Price Summary */}
        {(() => {
          const priceItems = items.filter(it => it.price != null);
          if (priceItems.length === 0) return null;
          const total = priceItems.reduce((s, it) => s + (it.price || 0), 0);
          return (
            <div style={{
              background: '#fffcf5', borderRadius: 6, padding: '6px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 12, marginBottom: 4,
            }}>
              <span style={{ color: '#bf360c' }}>💰 {priceItems.length}件</span>
              <span style={{ color: '#bf360c', fontWeight: 700 }}>₩{total.toLocaleString()}</span>
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
              <SimpleList
                items={flat}
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
              <input style={styles.input} type="number" inputMode="numeric" min="0" value={formData.price}
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
