import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings2,
  List,
  UserCog,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  Send,
  TrendingUp,
  Zap,
  LayoutGrid,
  CreditCard,
  AlertTriangle,
  ClipboardList,
  Home,
  RefreshCw,
  Droplets,
  Wrench,
  Pencil,
  Plus,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

const API_BASE = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : `${window.location.origin}/api`);

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'consumers', label: 'Consumers', icon: Users },
  { id: 'bills',     label: 'Bills',     icon: FileText },
  { id: 'tools',     label: 'Tools',     icon: Settings2 },
  { id: 'logs',      label: 'Logs',      icon: List },
  { id: 'users',     label: 'Users',     icon: UserCog },
  { id: 'chatbot',   label: 'Chat Bot',  icon: MessageSquare },
  { id: 'service',   label: 'Service',   icon: LayoutGrid },
];

function DashboardContent() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/logs`)
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalSent   = logs.reduce((s, l) => s + (l.sent   || 0), 0);
  const totalFailed = logs.reduce((s, l) => s + (l.failed || 0), 0);
  const totalBlasts = logs.length;
  const successRate = (totalSent + totalFailed) > 0
    ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0;

  // Group by logCode
  const byType = {};
  for (const l of logs) {
    const key = l.logCode || 'Unknown';
    byType[key] = (byType[key] || 0) + (l.sent || 0);
  }
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  // Last 14 days
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const byDay = {};
  for (const l of logs) {
    const day = l.created?.slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + (l.sent || 0);
  }
  const dayData = days.map(d => ({ day: d, sent: byDay[d] || 0 }));
  const maxDay  = Math.max(...dayData.map(d => d.sent), 1);

  const recent = logs.slice(0, 6);

  const shortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  };
  const formatTs = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading dashboard…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <h2 className="text-lg font-bold text-gray-800">Dashboard</h2>

      {/* â”€â”€ Stat Cards â”€â”€ */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total SMS Sent',  value: totalSent.toLocaleString(),   iconColor: 'text-blue-400',   Icon: Send       },
          { label: 'Total Failed',    value: totalFailed.toLocaleString(), iconColor: 'text-red-400',    Icon: XCircle    },
          { label: 'Success Rate',    value: `${successRate}%`,            iconColor: 'text-green-400',  Icon: TrendingUp },
          { label: 'Total Blasts',    value: totalBlasts.toLocaleString(), iconColor: 'text-purple-400', Icon: Zap        },
        ].map(({ label, value, iconColor, Icon }) => (
          <div key={label} className="bg-gray-600 rounded-lg p-4 flex items-center gap-4">
            <Icon className={`w-9 h-9 shrink-0 ${iconColor}`} />
            <div>
              <p className="text-xs text-gray-300 font-medium uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Charts Row â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* 14-day bar chart */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
            SMS Sent — Last 14 Days
          </div>
          <div className="p-4">
            {dayData.every(d => d.sent === 0) ? (
              <p className="text-xs text-gray-400 text-center py-8">No data for this period.</p>
            ) : (
              <svg viewBox="0 0 560 150" className="w-full" height={150}>
                {/* gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f} x1="0" y1={110 - f * 90} x2="560" y2={110 - f * 90}
                    stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {dayData.map((d, i) => {
                  const barH = (d.sent / maxDay) * 90;
                  const x    = i * 40 + 2;
                  return (
                    <g key={d.day}>
                      <rect x={x} y={110 - barH} width={36} height={barH}
                        fill="#3b82f6" rx="2" opacity="0.8" />
                      {d.sent > 0 && (
                        <text x={x + 18} y={107 - barH} textAnchor="middle"
                          fontSize="8" fill="#374151">{d.sent}</text>
                      )}
                      <text x={x + 18} y={124} textAnchor="middle" fontSize="7.5" fill="#9ca3af">
                        {shortDate(d.day)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* SMS by Type — horizontal bars */}
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
            SMS by Type
          </div>
          <div className="p-4 space-y-3">
            {typeEntries.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No data yet.</p>
            ) : (() => {
              const maxT = typeEntries[0][1];
              return typeEntries.map(([type, count], i) => (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 truncate max-w-[72%]">{type}</span>
                    <span className="font-semibold text-gray-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxT) * 100}%`, backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* â”€â”€ Recent Activity â”€â”€ */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 uppercase tracking-wide">
          Recent Activity
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No activity yet.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Type', 'User', 'Sent', 'Failed'].map(h => (
                  <th key={h} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((log, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-400">{formatTs(log.created)}</td>
                  <td className="border border-gray-200 px-3 py-1.5 font-medium text-gray-700">{log.logCode}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{log.user}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-green-700 font-semibold">{log.sent ?? '—'}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-red-500">{log.failed ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── SmsToolModal ──────────────────────────────────────────────────────────────

const SMS_TYPES = ['Billing', 'Due Date', 'Disconnection', 'Advisory'];

function SmsToolModal({ consumers, headers, onClose }) {
  const [smsType, setSmsType]       = useState('Due Date');
  const [datePosted, setDatePosted] = useState('');
  const [dueDate, setDueDate]       = useState('');
  const [disconDate, setDisconDate] = useState('');
  const [advisory, setAdvisory]     = useState('');
  const [templates, setTemplates]   = useState(null);
  const [sending, setSending]       = useState(false);
  const [progress, setProgress]     = useState(null);
  const [result, setResult]         = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Detect column indices from header names
  const phoneColIdx   = headers.findIndex(h => /cellphone|phone|mobile|contact/i.test(h));
  const nameColIdx    = headers.findIndex(h => /^name$/i.test(h));
  const accountColIdx = headers.findIndex(h => /account/i.test(h));

  useEffect(() => {
    fetch(`${API_BASE}/templates`)
      .then(r => r.json())
      .then(t => { setTemplates(t); if (t?.advTpl) setAdvisory(t.advTpl); })
      .catch(() => {});
  }, []);

  const fmtPhone = (raw) => {
    if (!raw) return '';
    let n = String(raw).replace(/[\s\-()+]/g, '');
    if (n.startsWith('63') && n.length === 12) n = '0' + n.slice(2);
    if (n.startsWith('9')  && n.length === 10) n = '0' + n;
    return /^09\d{9}$/.test(n) ? n : '';
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  };

  const applyTpl = (tpl, vars) =>
    (tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  const validConsumers = useMemo(
    () => consumers.filter(row => fmtPhone(row[phoneColIdx] ?? '')),
    [consumers, phoneColIdx]
  );

  const buildMsg = (row) => {
    if (!templates) return '';
    const name          = nameColIdx    >= 0 ? (row[nameColIdx]    ?? 'Consumer') : 'Consumer';
    const accountNumber = accountColIdx >= 0 ? (row[accountColIdx] ?? '')         : '';
    const vars = {
      name, accountNumber,
      datePosted:  fmtDate(datePosted),
      dueDate:     fmtDate(dueDate),
      disconDate:  fmtDate(disconDate),
      date:        fmtDate(smsType === 'Billing' ? datePosted : smsType === 'Due Date' ? dueDate : disconDate),
      advisory,
      consumption: '', waterFee: '0.00', installFee: '0.00',
      meterMaint: '0.00', penalty: '0.00', totalAmount: '0.00',
    };
    const tplMap = { Billing: templates.billTpl, 'Due Date': templates.dueTpl, Disconnection: templates.discTpl, Advisory: advisory };
    return applyTpl(tplMap[smsType], vars);
  };

  const handleSend = async () => {
    const messages = validConsumers.map(row => ({ phone: fmtPhone(row[phoneColIdx] ?? ''), message: buildMsg(row) }));
    setSending(true); setResult(null); setProgress(null);
    const CHUNK = 20;
    let sent = 0, failed = 0;
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      try {
        const res  = await fetch(`${API_BASE}/sms/send-bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chunk }) });
        const data = await res.json();
        if (data.success) { sent += data.sent; failed += data.failed; } else failed += chunk.length;
      } catch { failed += chunk.length; }
      setProgress({ total: messages.length, done: Math.min(i + CHUNK, messages.length), sent, failed });
    }
    setSending(false);
    setResult({ sent, failed });
    fetch(`${API_BASE}/logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'System', logCode: smsType, sent, failed }),
    }).catch(() => {});
  };

  const previewMsg = validConsumers.length > 0 ? buildMsg(validConsumers[0]) : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">SMS Tool</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-semibold text-gray-700">{validConsumers.length}</span> of {consumers.length} filtered consumers have valid phone numbers.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4">✕</button>
        </div>

        {/* SMS Type selector */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">SMS Type</p>
          <div className="flex gap-2 flex-wrap">
            {SMS_TYPES.map(t => (
              <button key={t} onClick={() => { setSmsType(t); setResult(null); setProgress(null); }}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  smsType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Billing: three date inputs */}
        {smsType === 'Billing' && (
          <div className="space-y-2 p-3 bg-gray-50 rounded border border-gray-200">
            {[['Date Posted', datePosted, setDatePosted], ['Due Date', dueDate, setDueDate], ['Disconnection Date', disconDate, setDisconDate]].map(([label, val, set]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-36 shrink-0">{label}</span>
                <input type="date" value={val} onChange={e => set(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
              </div>
            ))}
            <p className="text-[10px] text-gray-400">Amount fields will be blank — use the Tools tab for full billing SMS.</p>
          </div>
        )}

        {/* Due Date / Disconnection: single date */}
        {(smsType === 'Due Date' || smsType === 'Disconnection') && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-36 shrink-0">{smsType === 'Due Date' ? 'Due Date' : 'Disconnection Date'}</span>
            <input type="date"
              value={smsType === 'Due Date' ? dueDate : disconDate}
              onChange={e => smsType === 'Due Date' ? setDueDate(e.target.value) : setDisconDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
            />
          </div>
        )}

        {/* Advisory: text area */}
        {smsType === 'Advisory' && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Advisory Text</label>
            <textarea value={advisory} onChange={e => setAdvisory(e.target.value)} rows={3}
              placeholder="Enter advisory message…"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-y"
            />
          </div>
        )}

        {/* SMS preview */}
        {templates && previewMsg && (
          <div className="space-y-1">
            <button onClick={() => setShowPreview(v => !v)} className="text-xs text-blue-600 hover:underline font-medium">
              {showPreview ? 'Hide' : 'Preview'} SMS (first recipient)
            </button>
            {showPreview && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                {previewMsg}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{progress.done >= progress.total ? 'Complete' : `Sending ${progress.done} / ${progress.total}`}</span>
              <span><span className="text-green-600 font-medium">{progress.sent} sent</span> · <span className="text-red-500">{progress.failed} failed</span></span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className={`h-2 rounded-full transition-all duration-300 ${progress.done >= progress.total ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border text-sm bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Done — {result.sent} sent, {result.failed} failed.</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <button onClick={handleSend}
            disabled={sending || validConsumers.length === 0 || !templates}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-6 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : `Send SMS (${validConsumers.length})`}
          </button>
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SheetGrid ─────────────────────────────────────────────────────────────────
// Reusable grid with global search, per-column filters, and sortable headers.
// Data is cached in memory per apiUrl — navigating away and back is instant.

const _sheetCache = {}; // { [apiUrl]: { headers, rows } }

function SheetGrid({
  title,
  subtitle,
  apiUrl,
  tabLabel,
  extraButtons,
  onFilteredRowsChange,
  rowActions,
}) {
  const [data, setData]               = useState(_sheetCache[apiUrl] || null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [colFilters, setColFilters]   = useState({});   // { colIndex: string }
  const [sortCol, setSortCol]         = useState(null); // column index
  const [sortDir, setSortDir]         = useState('asc');
  const [showColFilters, setShowColFilters] = useState(false);

  const fetchData = async (bustCache = false) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(apiUrl);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load data.');
      _sheetCache[apiUrl] = json;
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (!_sheetCache[apiUrl]) fetchData(); }, []);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;

    // Global search across all columns
    const q = globalSearch.trim().toLowerCase();
    if (q) rows = rows.filter(row => row.some(cell => (cell ?? '').toLowerCase().includes(q)));

    // Per-column filters
    for (const [ci, val] of Object.entries(colFilters)) {
      if (!val.trim()) continue;
      const fq = val.toLowerCase();
      rows = rows.filter(row => (row[ci] ?? '').toLowerCase().includes(fq));
    }

    // Sort
    if (sortCol !== null) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortCol] ?? '').toLowerCase();
        const bv = (b[sortCol] ?? '').toLowerCase();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, globalSearch, colFilters, sortCol, sortDir]);

  useEffect(() => {
    if (onFilteredRowsChange) onFilteredRowsChange(filteredRows, data ? data.headers : []);
  }, [filteredRows]);

  const handleSort = (ci) => {
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(ci); setSortDir('asc'); }
  };

  const hasActiveFilters = globalSearch || Object.values(colFilters).some(v => v.trim()) || sortCol !== null;

  const clearAll = () => {
    setGlobalSearch('');
    setColFilters({});
    setSortCol(null);
    setSortDir('asc');
  };

  const SortIcon = ({ ci }) => {
    if (sortCol !== ci) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="p-6 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {extraButtons}
          <button
            onClick={() => { delete _sheetCache[apiUrl]; fetchData(); }}
            disabled={loading}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border text-sm bg-red-50 text-red-700 border-red-200">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && data.rows.length > 0 && (
        /* Filter toolbar */
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search all columns…"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400 w-56"
          />
          <button
            onClick={() => setShowColFilters(v => !v)}
            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
              showColFilters || Object.values(colFilters).some(v => v.trim())
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            Column Filters {Object.values(colFilters).filter(v => v.trim()).length > 0 && `(${Object.values(colFilters).filter(v => v.trim()).length})`}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 font-medium transition-colors"
            >
              Clear All
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {filteredRows.length === data.rows.length
              ? `${data.rows.length} record${data.rows.length !== 1 ? 's' : ''}`
              : `${filteredRows.length} of ${data.rows.length} records`}
          </span>
        </div>
      )}

      {data && (
        <div className="border border-gray-300 rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-200 border-b border-gray-300">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              {tabLabel}
            </span>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-310px)]">
            {data.rows.length === 0 ? (
              <p className="p-8 text-sm text-gray-400 text-center">No data found in the {tabLabel} tab.</p>
            ) : filteredRows.length === 0 ? (
              <p className="p-8 text-sm text-gray-400 text-center">No records match your filters.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  {/* Column headers (sortable) */}
                  <tr>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-500 w-8">#</th>
                    {data.headers.map((h, ci) => (
                      <th
                        key={ci}
                        onClick={() => handleSort(ci)}
                        className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200 transition-colors"
                      >
                        {h}<SortIcon ci={ci} />
                      </th>
                    ))}
                    {rowActions && (
                      <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap w-24">
                        Actions
                      </th>
                    )}
                  </tr>
                  {/* Per-column filter inputs */}
                  {showColFilters && (
                    <tr className="bg-blue-50">
                      <td className="border border-gray-300 px-1 py-1" />
                      {data.headers.map((_, ci) => (
                        <td key={ci} className="border border-gray-300 px-1 py-1">
                          <input
                            type="text"
                            placeholder="filter…"
                            value={colFilters[ci] || ''}
                            onChange={e => setColFilters(prev => ({ ...prev, [ci]: e.target.value }))}
                            className="w-full border border-blue-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-400 bg-white"
                          />
                        </td>
                      ))}
                      {rowActions && <td className="border border-gray-300 px-1 py-1" />}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 px-2 py-1 text-gray-400 text-right">{i + 1}</td>
                      {data.headers.map((_, ci) => (
                        <td key={ci} className="border border-gray-200 px-2 py-1 text-gray-700">{row[ci] ?? ''}</td>
                      ))}
                      {rowActions && (
                        <td className="border border-gray-200 px-2 py-1">
                          {rowActions(row, data.headers)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <p className="text-sm text-gray-400 text-center py-10">No data loaded.</p>
      )}
    </div>
  );
}

function ConsumerFormModal({ mode, headers, initialRow, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const consIdx = useMemo(
    () => headers.findIndex(h => String(h || '').trim().toLowerCase() === 'conscode'),
    [headers]
  );

  const [form, setForm] = useState(() => {
    const base = {};
    headers.forEach((h, i) => { base[i] = ''; });
    if (initialRow) {
      headers.forEach((_, i) => { base[i] = initialRow[i] ?? ''; });
    }
    return base;
  });

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const conscode = String(form[consIdx] ?? '').trim();

  const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:border-blue-400';
  const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide';

  async function handleSave() {
    setStatus(null);
    if (consIdx < 0) { setStatus({ type: 'error', msg: 'CONSCODE column not found in Masterlist headers.' }); return; }
    if (!conscode)  { setStatus({ type: 'error', msg: 'CONSCODE is required.' }); return; }

    const rowData = headers.map((_, i) => String(form[i] ?? ''));

    setSaving(true);
    try {
      const url = isEdit ? `${API_BASE}/sheets/masterlist/update` : `${API_BASE}/sheets/masterlist/add`;
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { conscode, rowData } : { rowData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed.');

      setStatus({ type: 'success', msg: isEdit ? 'Consumer updated.' : 'Consumer added.' });
      onSaved?.();
      onClose();
    } catch (e) {
      setStatus({ type: 'error', msg: e.message || 'Save failed.' });
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">{isEdit ? 'Edit Consumer' : 'Add Consumer'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Masterlist (Google Sheet)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4">✕</button>
        </div>

        {status && <StatusBadge message={status.msg} type={status.type} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {headers.map((h, i) => {
            const isConscode = i === consIdx;
            return (
              <div key={i}>
                <p className={labelCls}>{h || `Column ${i + 1}`}{isConscode && <span className="text-red-500 ml-1">*</span>}</p>
                <input
                  className={inputCls}
                  value={form[i]}
                  disabled={isEdit && isConscode}
                  onChange={(e) => setForm(prev => ({ ...prev, [i]: e.target.value }))}
                />
                {isEdit && isConscode && (
                  <p className="text-[10px] text-gray-400 mt-1">CONSCODE cannot be changed when editing.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsumersContent() {
  const [smsToolOpen, setSmsToolOpen]             = useState(false);
  const [consumerFormOpen, setConsumerFormOpen]   = useState(false);
  const [consumerFormMode, setConsumerFormMode]   = useState('add'); // 'add' | 'edit'
  const [editRow, setEditRow]                     = useState(null);

  const [filteredConsumers, setFilteredConsumers] = useState([]);
  const [filteredHeaders, setFilteredHeaders]     = useState([]);

  const masterlistApiUrl = `${API_BASE}/sheets/masterlist`;

  const refreshMasterlist = () => {
    delete _sheetCache[masterlistApiUrl];
  };

  const openAdd = () => {
    setConsumerFormMode('add');
    setEditRow(null);
    setConsumerFormOpen(true);
  };

  const openEdit = (row) => {
    setConsumerFormMode('edit');
    setEditRow(row);
    setConsumerFormOpen(true);
  };

  return (
    <>
      <SheetGrid
        title="Consumers"
        subtitle="Current data in the Masterlist Google Sheet tab."
        apiUrl={masterlistApiUrl}
        tabLabel="Masterlist"
        onFilteredRowsChange={(rows, headers) => { setFilteredConsumers(rows); setFilteredHeaders(headers); }}
        extraButtons={
          <>
            <button
              onClick={openAdd}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Consumer
            </button>
            <button
              onClick={() => setSmsToolOpen(true)}
              disabled={filteredConsumers.length === 0}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded font-semibold transition-colors disabled:opacity-40"
            >
              SMS Tool
            </button>
          </>
        }
        rowActions={(row) => (
          <button
            onClick={() => openEdit(row)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold inline-flex items-center gap-1"
            title="Edit consumer"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      />

      {smsToolOpen && (
        <SmsToolModal
          consumers={filteredConsumers}
          headers={filteredHeaders}
          onClose={() => setSmsToolOpen(false)}
        />
      )}

      {consumerFormOpen && (
        <ConsumerFormModal
          mode={consumerFormMode}
          headers={filteredHeaders}
          initialRow={editRow}
          onClose={() => setConsumerFormOpen(false)}
          onSaved={refreshMasterlist}
        />
      )}
    </>
  );
}

function BillsContent() {
  return (
    <SheetGrid
      title="Bills"
      subtitle="Current data in the LatestBill Google Sheet tab."
      apiUrl={`${API_BASE}/sheets/latest-bill`}
      tabLabel="LatestBill"
    />
  );
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.replace(/^\uFEFF/, '').trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function StatusBadge({ message, type }) {
  if (!message) return null;
  const styles = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error:   'bg-red-50 text-red-700 border-red-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200',
  };
  const icons = {
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    error:   <XCircle className="w-4 h-4 shrink-0" />,
    info:    <AlertCircle className="w-4 h-4 shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded border text-sm mt-2 ${styles[type] || styles.info}`}>
      {icons[type] || icons.info}
      <span>{message}</span>
    </div>
  );
}

function SendProgress({ progress, onCancel }) {
  if (!progress) return null;
  const pct     = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const isDone  = progress.total > 0 && progress.done >= progress.total;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span className="font-medium">
          {isDone ? 'Complete' : `Sending ${progress.done} / ${progress.total}`}
        </span>
        <span>
          <span className="text-green-600 font-medium">{progress.sent} sent</span>
          {' Â· '}
          <span className="text-red-500">{progress.failed} failed</span>
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{pct}%</span>
        {!isDone && (
          <button onClick={onCancel} className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// â”€â”€ ToolsContent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ToolsContent() {
  // â”€â”€ Masterlist (consumer settings) â”€â”€
  const [masterlistFile, setMasterlistFile]   = useState(null);
  const [masterlist, setMasterlist]           = useState([]);   // parsed rows
  const [masterlistStatus, setMasterlistStatus] = useState(null);
  const masterlistRef = useRef();

  // â”€â”€ Monthly Bill Upload â”€â”€
  const [billsFiles, setBillsFiles]       = useState([]);
  const [datePosted, setDatePosted]       = useState('');
  const [dueDate, setDueDate]             = useState('');
  const [disconDate, setDisconDate]       = useState('');
  const [smsOnly, setSmsOnly]             = useState(false);
  const [billsStatus, setBillsStatus]     = useState(null);
  const [billsProcessing, setBillsProcessing] = useState(false);
  const [billsPreview, setBillsPreview]   = useState(null);
  const [billsSending, setBillsSending]   = useState(false);
  const [billsSendStatus, setBillsSendStatus] = useState(null);
  const billsRef = useRef();

  // â”€â”€ SMS Broadcast â”€â”€
  const [notifType, setNotifType]           = useState('Due Date');
  const [refDate, setRefDate]               = useState('');
  const [broadcastFile, setBroadcastFile]   = useState(null);
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [broadcastProcessing, setBroadcastProcessing] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState(null);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSendStatus, setBroadcastSendStatus] = useState(null);
  const broadcastRef = useRef();

  // â”€â”€ Send progress (shared; only one send runs at a time) â”€â”€
  const [sendProgress, setSendProgress] = useState(null);
  const abortRef = useRef(false);

  // â”€â”€ SMS Templates â”€â”€
  const DEFAULT_BILL_TPL = `BogoWD(free,no reply): Your bill (Conscode: {conscode}) for THIS MONTH is {totalAmount}. Consumed {consumption} cubic. Due Date {dueDate}. Disconnection Date {disconDate}.`;
  const DEFAULT_DUE_TPL  = `BogoWD(free,no reply): This is a reminder that your water bill is due on {date}. Water Fee: Php {waterFee}. Installation Fee: Php {installFee}. Meter Maintenance: Php {meterMaint}. Total Amount Due: Php {totalAmount}.`;
  const DEFAULT_DISC_TPL = `BogoWD(free,no reply): Your account is scheduled for disconnection on {date} due to unpaid balance. Water Fee: Php {waterFee}. Installation Fee: Php {installFee}. Meter Maintenance Fee: Php {meterMaint}. Penalty: Php {penalty}. Total Amount Due: Php {totalAmount}.`;
  const DEFAULT_ADV_TPL  = `BogoWD(free,no reply): This is an advisory from CPMPC. {advisory} For inquiries, please contact our office. Thank you.`;

  const [billTpl,  setBillTpl]  = useState(DEFAULT_BILL_TPL);
  const [dueTpl,   setDueTpl]   = useState(DEFAULT_DUE_TPL);
  const [discTpl,  setDiscTpl]  = useState(DEFAULT_DISC_TPL);
  const [advTpl,   setAdvTpl]   = useState(DEFAULT_ADV_TPL);
  const [showTpl,  setShowTpl]  = useState(false);
  const [tplSaveStatus, setTplSaveStatus] = useState(null);

  // Load saved templates from server on mount
  useEffect(() => {
    fetch(`${API_BASE}/templates`)
      .then(r => r.json())
      .then(data => {
        if (data.billTpl)  setBillTpl(data.billTpl);
        if (data.dueTpl)   setDueTpl(data.dueTpl);
        if (data.discTpl)  setDiscTpl(data.discTpl);
        if (data.advTpl)   setAdvTpl(data.advTpl);
      })
      .catch(() => {}); // silently ignore if server not available
  }, []);

  async function handleSaveTemplates() {
    setTplSaveStatus(null);
    try {
      const res = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billTpl, dueTpl, discTpl, advTpl }),
      });
      const data = await res.json();
      setTplSaveStatus(data.success ? { type: 'success', msg: 'Templates saved.' } : { type: 'error', msg: data.error || 'Save failed.' });
    } catch {
      setTplSaveStatus({ type: 'error', msg: 'Could not reach the server.' });
    }
  }

  // â”€â”€ Helpers â”€â”€

  const readFile = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsText(file);
  });

  const findConsumer = (code) => {
    const codeStr = String(code).trim();
    const codeNum = parseInt(codeStr, 10);
    return masterlist.find(row => {
      // Try CONSCODE key first, fall back to first column value
      const rowCode = String(row['CONSCODE'] || Object.values(row)[0] || '').trim();
      if (rowCode === codeStr) return true;                           // exact match
      const rowNum = parseInt(rowCode, 10);
      return !isNaN(codeNum) && !isNaN(rowNum) && codeNum === rowNum; // numeric match (ignores leading zeros)
    });
  };

  const applyTemplate = (tpl, vars) =>
    tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);

  const formatBillSMS = (consumer, bill, dp, dd, dc) => {
    const name          = consumer['NAME'] || consumer.name || consumer.consumer_name || 'Consumer';
    const accountNumber = consumer['ACCOUNT_NUMBER'] || consumer.account_number || '';
    const conscode      = bill['Conscode']         || bill['conscode']          || Object.values(bill)[0] || '';
    const consumption   = bill['Consumption']      || bill['consumption']       || '';
    const waterFee      = (parseFloat((bill['Water Fee'] || bill['water_fee'] || bill['WaterFee'] || '0').replace(/,/g, '') || 0) * 1.02).toFixed(2);
    const installFee    = bill['Installation Fee'] || bill['installation_fee']  || bill['InstallationFee'] || '0.00';
    const meterMaint    = bill['Meter Maintenance']|| bill['meter_maintenance'] || bill['MeterMaintenance']|| '0.00';
    const totalAmount   = (
      parseFloat(waterFee) +
      parseFloat(installFee.replace(/,/g, '') || 0) +
      parseFloat(meterMaint.replace(/,/g, '') || 0)
    ).toFixed(2);
    return applyTemplate(billTpl, {
      name, accountNumber, conscode, consumption,
      waterFee, installFee, meterMaint, totalAmount,
      datePosted: dp, dueDate: dd, disconDate: dc,
    });
  };

  const extractFees = (row) => {
    const waterFee   = (parseFloat((row['Water Fee'] || row['water_fee'] || row['WaterFee'] || '0').replace(/,/g, '') || 0) * 1.02).toFixed(2);
    const installFee = row['Installation Fee']      || row['installation_fee']   || row['InstallationFee']      || '0.00';
    // Handle both "Meter Maintenance" (bills/due) and "Meter Maintenance Fee" (disconnection)
    const meterMaint = row['Meter Maintenance Fee'] || row['Meter Maintenance']  || row['meter_maintenance_fee']
                    || row['meter_maintenance']     || row['MeterMaintenanceFee'] || row['MeterMaintenance']    || '0.00';
    const penalty    = row['Penalty']               || row['penalty']            || '0.00';
    const totalAmount = (
      parseFloat(waterFee) +
      parseFloat(installFee.replace(/,/g, '') || 0) +
      parseFloat(meterMaint.replace(/,/g, '') || 0) +
      parseFloat(penalty.replace(/,/g, '')    || 0)
    ).toFixed(2);
    return { waterFee, installFee, meterMaint, penalty, totalAmount };
  };

  const formatBroadcastSMS = (consumer, type, date, row = {}) => {
    const name          = consumer['NAME'] || consumer.name || consumer.consumer_name || 'Consumer';
    const accountNumber = consumer['ACCOUNT_NUMBER'] || consumer.account_number || '';
    const tpl           = type === 'Due Date' ? dueTpl : type === 'Disconnection Date' ? discTpl : advTpl;
    const advisory      = row['Advisory'] || '';
    return applyTemplate(tpl, { name, accountNumber, date, advisory, ...extractFees(row) });
  };

  const formatDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  };

  const formatPhone = (raw) => {
    if (!raw) return '';
    let n = String(raw).replace(/[\s\-()+]/g, ''); // strip spaces, dashes, parens, +
    if (n.startsWith('63') && n.length === 12) n = '0' + n.slice(2); // 639xxxxxxxxx â†’ 09xxxxxxxxx
    if (n.startsWith('9')  && n.length === 10) n = '0' + n;          // 9xxxxxxxxx   â†’ 09xxxxxxxxx
    return /^09\d{9}$/.test(n) ? n : '';              // must be valid 09XXXXXXXXX (11 digits)
  };

  const getPhone = (consumer) => {
    const raw = consumer['CELLPHONE_NUMBER'] || consumer.phone || consumer.mobile || consumer.contact ||
      consumer.PHONE || consumer.MOBILE || consumer.CONTACT || consumer.cellphone || '';
    return formatPhone(raw);
  };

  // â”€â”€ Handlers â”€â”€

  async function handleMasterlistUpload() {
    if (!masterlistFile) { setMasterlistStatus({ type: 'error', msg: 'Please select a CSV file.' }); return; }
    try {
      const text  = await readFile(masterlistFile);
      const rows  = parseCSV(text);
      setMasterlist(rows);
      setMasterlistStatus({ type: 'success', msg: `${rows.length} consumer records loaded successfully.` });
    } catch {
      setMasterlistStatus({ type: 'error', msg: 'Failed to read file. Make sure it is a valid CSV.' });
    }
  }

  async function handleBillsUpload() {
    if (!billsFiles.length)  { setBillsStatus({ type: 'error', msg: 'Please select at least one CSV Bills file.' }); return; }
    if (!masterlist.length)  { setBillsStatus({ type: 'error', msg: 'Load the Consumer Masterlist first.' }); return; }
    if (!datePosted || !dueDate || !disconDate)
                             { setBillsStatus({ type: 'error', msg: 'Fill in Date Posted, Due Date and Disconnection Date.' }); return; }

    setBillsProcessing(true);
    setBillsStatus(null);
    setBillsPreview(null);
    try {
      const BILL_COLS = ['Conscode', 'Consumption', 'Water Fee', 'Installation Fee', 'Meter Maintenance'];

      // Parse all selected files and combine rows
      const bills = [];
      for (const file of billsFiles) {
        const text = await readFile(file);
        const rawLines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          .trim().split('\n').filter(l => l.trim());
        const firstCell = splitCSVLine(rawLines[0])[0].replace(/^\uFEFF/, '').trim();
        const hasHeader = isNaN(Number(firstCell)) && firstCell !== '';
        const dataLines = hasHeader ? rawLines.slice(1) : rawLines;
        dataLines.forEach(line => {
          const vals = splitCSVLine(line);
          const obj = {};
          BILL_COLS.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
          bills.push(obj);
        });
      }

      // Replace Google Sheet tab LatestBill unless SMS-only mode is enabled.
      if (!smsOnly) {
        const sheetHeaders = [...BILL_COLS, 'Due Date', 'Disconnection Date'];
        const sheetPayload = {
          headers: sheetHeaders,
          rows: bills.map(bill => [
            ...BILL_COLS.map(col => {
              if (col === 'Water Fee') {
                return (parseFloat((bill[col] || '0').replace(/,/g, '') || 0) * 1.02).toFixed(2);
              }
              return bill[col] || '';
            }),
            formatDate(dueDate),
            formatDate(disconDate),
          ]),
        };
        const sheetRes = await fetch(`${API_BASE}/sheets/latest-bill/replace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload),
        });
        const sheetData = await sheetRes.json();
        if (!sheetRes.ok || !sheetData.success) {
          throw new Error(sheetData.error || 'Failed to update LatestBill in Google Sheets.');
        }
      }

      const results = [];

      for (const bill of bills) {
        const code     = bill['Conscode'].trim();
        const consumer = findConsumer(code);
        if (!consumer) { results.push({ code, status: 'not_found' }); continue; }
        const phone    = getPhone(consumer);
        const sms      = formatBillSMS(consumer, bill, formatDate(datePosted), formatDate(dueDate), formatDate(disconDate));
        results.push({ code, phone, sms, status: phone ? 'ready' : 'no_phone' });
      }

      const ready    = results.filter(r => r.status === 'ready').length;
      const noPhone  = results.filter(r => r.status === 'no_phone').length;
      const notFound = results.filter(r => r.status === 'not_found').length;

      setBillsPreview({ results, ready, noPhone, notFound });
      setBillsStatus({ type: 'success', msg: `${ready} SMS ready to send · ${noPhone} missing phone · ${notFound} consumer not found.${smsOnly ? '' : ' LatestBill tab updated.'}` });
    } catch (error) {
      setBillsStatus({ type: 'error', msg: error?.message || 'Failed to process bills file.' });
    }
    setBillsProcessing(false);
  }

  async function handleSendBillsSMS() {
    if (!billsPreview) return;
    const ready = billsPreview.results.filter(r => r.status === 'ready');
    if (!ready.length) { setBillsSendStatus({ type: 'error', msg: 'No ready messages to send.' }); return; }

    const allMessages = ready.map(r => ({ phone: r.phone, message: r.sms }));
    const total = allMessages.length;
    const CHUNK = 20;

    setBillsSending(true);
    setBillsSendStatus(null);
    setSendProgress({ total, done: 0, sent: 0, failed: 0 });
    abortRef.current = false;

    let totalSent = 0, totalFailed = 0, cancelled = false;

    for (let i = 0; i < allMessages.length; i += CHUNK) {
      if (abortRef.current) { cancelled = true; break; }
      const chunk = allMessages.slice(i, i + CHUNK);
      try {
        const res  = await fetch(`${API_BASE}/sms/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chunk }),
        });
        const data = await res.json();
        if (data.success) { totalSent += data.sent; totalFailed += data.failed; }
        else { totalFailed += chunk.length; }
      } catch { totalFailed += chunk.length; }
      setSendProgress({ total, done: Math.min(i + CHUNK, total), sent: totalSent, failed: totalFailed });
    }

    setBillsSending(false);
    if (cancelled) {
      setSendProgress(null);
      setBillsSendStatus({ type: 'error', msg: `Cancelled — ${totalSent} sent, ${totalFailed} failed.` });
    } else {
      setSendProgress({ total, done: total, sent: totalSent, failed: totalFailed }); // show 100%
      setBillsSendStatus({ type: 'success', msg: `Done — ${totalSent} sent, ${totalFailed} failed.` });
      fetch(`${API_BASE}/logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'System', logCode: 'Monthly Bill', sent: totalSent, failed: totalFailed }),
      }).catch(() => {});
    }
  }

  async function handleBroadcast() {
    const isAdvisory = notifType === 'Advisory';
    if (!masterlist.length)              { setBroadcastStatus({ type: 'error', msg: 'Load the Consumer Masterlist first.' }); return; }
    if (!isAdvisory && !broadcastFile)   { setBroadcastStatus({ type: 'error', msg: 'Please select a CSV file.' }); return; }
    if (!isAdvisory && !refDate)         { setBroadcastStatus({ type: 'error', msg: 'Enter the Reference Date.' }); return; }

    setBroadcastProcessing(true);
    setBroadcastStatus(null);
    setBroadcastPreview(null);
    setBroadcastSendStatus(null);
    try {
      const results = [];

      if (isAdvisory) {
        // Send to all consumers in the masterlist
        for (const consumer of masterlist) {
          const code  = String(consumer['CONSCODE'] || Object.values(consumer)[0] || '').trim();
          const phone = getPhone(consumer);
          const sms   = formatBroadcastSMS(consumer, notifType, formatDate(refDate), {});
          results.push({ code, phone, sms, status: phone ? 'ready' : 'no_phone' });
        }
      } else {
        const BROADCAST_COLS = ['Conscode', 'Consumption', 'Water Fee', 'Installation Fee', 'Meter Maintenance', 'Penalty'];
        const rawText  = await readFile(broadcastFile);
        const rawLines = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          .trim().split('\n').filter(l => l.trim());
        const firstCell = splitCSVLine(rawLines[0])[0].replace(/^\uFEFF/, '').trim();
        const hasHeader = isNaN(Number(firstCell)) && firstCell !== '';
        const dataLines = hasHeader ? rawLines.slice(1) : rawLines;
        const rows = dataLines.map(line => {
          const vals = splitCSVLine(line);
          const obj = {};
          BROADCAST_COLS.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
          return obj;
        });

        for (const row of rows) {
          const code     = row['Conscode'].trim();
          const consumer = findConsumer(code);
          if (!consumer) { results.push({ code, status: 'not_found' }); continue; }
          const phone = getPhone(consumer);
          const sms   = formatBroadcastSMS(consumer, notifType, formatDate(refDate), row);
          results.push({ code, phone, sms, status: phone ? 'ready' : 'no_phone' });
        }
      }

      const ready    = results.filter(r => r.status === 'ready').length;
      const noPhone  = results.filter(r => r.status === 'no_phone').length;
      const notFound = results.filter(r => r.status === 'not_found').length;

      setBroadcastPreview({ results, ready, noPhone, notFound });
      setBroadcastStatus({ type: 'success', msg: `${ready} SMS ready to send Â· ${noPhone} missing phone Â· ${notFound} consumer not found.` });
    } catch {
      setBroadcastStatus({ type: 'error', msg: 'Failed to process broadcast file.' });
    }
    setBroadcastProcessing(false);
  }

  async function handleSendBroadcastSMS() {
    if (!broadcastPreview) return;
    const ready = broadcastPreview.results.filter(r => r.status === 'ready');
    if (!ready.length) { setBroadcastSendStatus({ type: 'error', msg: 'No ready messages to send.' }); return; }

    const allMessages = ready.map(r => ({ phone: r.phone, message: r.sms }));
    const total = allMessages.length;
    const CHUNK = 20;

    setBroadcastSending(true);
    setBroadcastSendStatus(null);
    setSendProgress({ total, done: 0, sent: 0, failed: 0 });
    abortRef.current = false;

    let totalSent = 0, totalFailed = 0, cancelled = false;

    for (let i = 0; i < allMessages.length; i += CHUNK) {
      if (abortRef.current) { cancelled = true; break; }
      const chunk = allMessages.slice(i, i + CHUNK);
      try {
        const res  = await fetch(`${API_BASE}/sms/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chunk }),
        });
        const data = await res.json();
        if (data.success) { totalSent += data.sent; totalFailed += data.failed; }
        else { totalFailed += chunk.length; }
      } catch { totalFailed += chunk.length; }
      setSendProgress({ total, done: Math.min(i + CHUNK, total), sent: totalSent, failed: totalFailed });
    }

    setBroadcastSending(false);
    if (cancelled) {
      setSendProgress(null);
      setBroadcastSendStatus({ type: 'error', msg: `Cancelled — ${totalSent} sent, ${totalFailed} failed.` });
    } else {
      setSendProgress({ total, done: total, sent: totalSent, failed: totalFailed }); // show 100%
      setBroadcastSendStatus({ type: 'success', msg: `Done — ${totalSent} sent, ${totalFailed} failed.` });
      fetch(`${API_BASE}/logs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'System', logCode: notifType, sent: totalSent, failed: totalFailed }),
      }).catch(() => {});
    }
  }

  // â”€â”€ Shared input styles â”€â”€
  const inputCls  = 'border border-gray-300 rounded px-2 py-1 text-[16px] w-full focus:outline-none focus:border-blue-400';
  const btnCls    = 'bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-1.5 rounded transition-colors disabled:opacity-50';
  const sectionHd = 'bg-gray-200 border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide';
  const cellCls   = 'border border-gray-300 px-4 py-3 align-top bg-gray-50';

  return (
    <div className="p-4 space-y-4 text-sm text-gray-700">

      {/* â”€â”€ SMS TEMPLATES â”€â”€ */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-200 hover:bg-gray-300 transition-colors text-left"
          onClick={() => setShowTpl(v => !v)}
        >
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">SMS Message Templates</span>
          <span className="text-gray-500 text-xs">{showTpl ? '▲ Hide' : '▼ Configure'}</span>
        </button>

        {showTpl && (
          <div className="p-4 space-y-4 bg-white">

            {/* Bill template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-700">Monthly Bill Notification</p>
                <button onClick={() => setBillTpl(DEFAULT_BILL_TPL)}
                  className="text-[10px] text-blue-500 hover:underline">Reset to default</button>
              </div>
              <textarea
                value={billTpl}
                onChange={e => { setBillTpl(e.target.value); setBillsPreview(null); }}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-y font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Variables:{' '}
                {['{name}','{accountNumber}','{conscode}','{consumption}','{waterFee}','{installFee}','{meterMaint}','{totalAmount}','{datePosted}','{dueDate}','{disconDate}'].map(v => (
                  <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>
                ))}
              </p>
            </div>

            {/* Due date template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-700">Due Date Reminder</p>
                <button onClick={() => setDueTpl(DEFAULT_DUE_TPL)}
                  className="text-[10px] text-blue-500 hover:underline">Reset to default</button>
              </div>
              <textarea
                value={dueTpl}
                onChange={e => setDueTpl(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-y font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Variables:{' '}
                {['{name}','{accountNumber}','{date}','{waterFee}','{installFee}','{meterMaint}','{totalAmount}'].map(v => (
                  <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>
                ))}
              </p>
            </div>

            {/* Disconnection template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-700">Disconnection Notice</p>
                <button onClick={() => setDiscTpl(DEFAULT_DISC_TPL)}
                  className="text-[10px] text-blue-500 hover:underline">Reset to default</button>
              </div>
              <textarea
                value={discTpl}
                onChange={e => setDiscTpl(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-y font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Variables:{' '}
                {['{name}','{accountNumber}','{date}','{waterFee}','{installFee}','{meterMaint}','{penalty}','{totalAmount}'].map(v => (
                  <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>
                ))}
              </p>
            </div>

            {/* Advisory template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-700">Advisory</p>
                <button onClick={() => setAdvTpl(DEFAULT_ADV_TPL)}
                  className="text-[10px] text-blue-500 hover:underline">Reset to default</button>
              </div>
              <textarea
                value={advTpl}
                onChange={e => setAdvTpl(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 resize-y font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Variables:{' '}
                {['{name}','{accountNumber}','{date}','{advisory}'].map(v => (
                  <code key={v} className="bg-gray-100 px-1 rounded mr-1">{v}</code>
                ))}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                <code className="bg-gray-100 px-1 rounded">{'{advisory}'}</code> is read from an <strong>Advisory</strong> column in your CSV (optional).
              </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              <button className={btnCls} onClick={handleSaveTemplates}>
                Save Templates
              </button>
              {tplSaveStatus && (
                <StatusBadge message={tplSaveStatus.msg} type={tplSaveStatus.type} />
              )}
            </div>

          </div>
        )}
      </div>

      {/* â”€â”€ TOOLS â”€â”€ */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <div className={sectionHd}>Tools</div>
        <div className="flex flex-col md:flex-row">
              {/* Left: Consumer Masterlist */}
              <div className={`${cellCls} md:w-1/2`}>
                <p className="font-bold text-gray-600 border-b border-gray-300 pb-1 mb-3 text-xs uppercase tracking-wide">
                  Consumers Settings Upload
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CSV Consumers (Masterlist)</p>
                    <input
                      ref={masterlistRef}
                      type="file" accept=".csv"
                      className="text-[16px] text-gray-600 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded file:text-[16px] file:bg-white file:cursor-pointer cursor-pointer"
                      onChange={e => { setMasterlistFile(e.target.files[0] || null); setMasterlistStatus(null); }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">Upload</span>
                    <button className={btnCls} onClick={handleMasterlistUpload}>
                      CONTINUE
                    </button>
                  </div>
                  <StatusBadge message={masterlistStatus?.msg} type={masterlistStatus?.type} />
                  {masterlist.length > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ Masterlist active — {masterlist.length} records
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Monthly Bill Upload */}
              <div className={`${cellCls} md:w-1/2`}>
                <p className="font-bold text-gray-600 border-b border-gray-300 pb-1 mb-3 text-xs uppercase tracking-wide">
                  Monthly Bill Upload
                </p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  This process will automatically send the Date Posted SMS notification
                  to the users in the CSV.
                </p>
                <div className="space-y-2">
                  {[
                    ['Date Posted',        datePosted,  setDatePosted],
                    ['Due Date',           dueDate,     setDueDate],
                    ['Disconnection Date', disconDate,  setDisconDate],
                  ].map(([label, val, set]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-600">{label}</span>
                      <input type="date" value={val}
                        onChange={e => set(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  ))}

                  <div className="flex flex-col gap-0.5 pt-1">
                    <span className="text-xs text-gray-600">SMS Only</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                      <input type="checkbox" checked={smsOnly} onChange={e => setSmsOnly(e.target.checked)}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      Skip saving to Google Sheet (LatestBill)
                    </label>
                  </div>

                  <div className="pt-1">
                    <p className="text-xs text-gray-500 mb-1">CSV Bills</p>
                    <input
                      ref={billsRef}
                      type="file" accept=".csv" multiple
                      className="text-[16px] text-gray-600 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded file:text-[16px] file:bg-white file:cursor-pointer cursor-pointer"
                      onChange={e => {
                        const newFiles = Array.from(e.target.files);
                        setBillsFiles(prev => {
                          const existing = prev.map(f => f.name);
                          const toAdd = newFiles.filter(f => !existing.includes(f.name));
                          return [...prev, ...toAdd];
                        });
                        setBillsStatus(null);
                        setBillsPreview(null);
                        e.target.value = '';
                      }}
                    />
                    {billsFiles.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {billsFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between text-[10px] bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                            <span className="text-blue-700 truncate">{f.name}</span>
                            <button
                              className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                              onClick={() => { setBillsFiles(prev => prev.filter((_, j) => j !== i)); setBillsPreview(null); }}
                            >âœ•</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">Upload</span>
                    <button className={btnCls} onClick={handleBillsUpload} disabled={billsProcessing}>
                      {billsProcessing ? 'PROCESSING…' : 'CONTINUE'}
                    </button>
                  </div>

                  <StatusBadge message={billsStatus?.msg} type={billsStatus?.type} />
                </div>
              </div>
        </div>
      </div>

      {/* Bills Preview Table */}
      {billsPreview && (
        <div className="border border-gray-300 rounded overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-200 border-b border-gray-300">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> SMS Preview
            </span>
            <span className="text-xs text-gray-500">
              {billsPreview.ready} ready Â· {billsPreview.noPhone} no phone Â· {billsPreview.notFound} not found
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {['Consumer Code','Phone','Status','SMS Preview'].map(h => (
                    <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {billsPreview.results.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-2 py-1 font-mono">{r.code}</td>
                    <td className="border border-gray-200 px-2 py-1">{r.phone || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1">
                      {r.status === 'ready'     && <span className="text-green-600 font-semibold">Ready</span>}
                      {r.status === 'no_phone'  && <span className="text-yellow-600 font-semibold">No Phone</span>}
                      {r.status === 'not_found' && <span className="text-red-500 font-semibold">Not Found</span>}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-gray-500 truncate max-w-xs">{r.sms || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Send SMS action bar */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-300">
            <div className="flex items-center gap-3">
              <button
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-6 py-1.5 rounded transition-colors disabled:opacity-50"
                onClick={handleSendBillsSMS}
                disabled={billsSending || billsPreview.ready === 0}
              >
                {billsSending ? 'SENDING…' : `SEND SMS (${billsPreview.ready})`}
              </button>
              {!billsSending && billsSendStatus && (
                <StatusBadge message={billsSendStatus.msg} type={billsSendStatus.type} />
              )}
            </div>
            {sendProgress && !broadcastSending && <SendProgress progress={sendProgress} onCancel={() => { abortRef.current = true; }} />}
          </div>
        </div>
      )}

      {/* â”€â”€ SMS NOTIFICATIONS â”€â”€ */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <div className={sectionHd}>SMS Notifications</div>
        <div className="border-b border-gray-300 px-3 py-2 bg-gray-100">
          <span className="text-xs font-semibold text-gray-600">SMS Broadcast (Due and Disconnection)</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Send Due Date and Disconnection Date SMS</p>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-600">Type of Notification</span>
            <select value={notifType} onChange={e => { setNotifType(e.target.value); setBroadcastPreview(null); setBroadcastSendStatus(null); }}
              className="border border-gray-300 rounded px-2 py-1 text-[16px] focus:outline-none focus:border-blue-400 w-full">
              <option>Due Date</option>
              <option>Disconnection Date</option>
              <option>Advisory</option>
            </select>
          </div>

          {notifType !== 'Advisory' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-600">Reference Due/Disconnection Date</span>
              <input type="date" value={refDate} onChange={e => { setRefDate(e.target.value); setBroadcastPreview(null); setBroadcastSendStatus(null); }}
                className="border border-gray-300 rounded px-2 py-1 text-[16px] w-full focus:outline-none focus:border-blue-400" />
            </div>
          )}

          {notifType !== 'Advisory' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-600">CSV File</span>
              <input
                ref={broadcastRef}
                type="file" accept=".csv"
                className="text-[16px] text-gray-600 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded file:text-[16px] file:bg-white file:cursor-pointer cursor-pointer"
                onChange={e => { setBroadcastFile(e.target.files[0] || null); setBroadcastStatus(null); setBroadcastPreview(null); setBroadcastSendStatus(null); }}
              />
            </div>
          )}

          {notifType === 'Advisory' && masterlist.length > 0 && (
            <p className="text-xs text-blue-600">Will send to all {masterlist.length} consumers in the loaded masterlist.</p>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-600">Preview Messages</span>
            <button className={`${btnCls} self-start`} onClick={handleBroadcast} disabled={broadcastProcessing}>
              {broadcastProcessing ? 'PROCESSING…' : 'CONTINUE'}
            </button>
          </div>

          <StatusBadge message={broadcastStatus?.msg} type={broadcastStatus?.type} />
        </div>
      </div>

      {/* Broadcast Preview Table */}
      {broadcastPreview && (
        <div className="border border-gray-300 rounded overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-200 border-b border-gray-300">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> SMS Preview — {notifType}
            </span>
            <span className="text-xs text-gray-500">
              {broadcastPreview.ready} ready Â· {broadcastPreview.noPhone} no phone Â· {broadcastPreview.notFound} not found
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {['Consumer Code','Phone','Status','SMS Preview'].map(h => (
                    <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {broadcastPreview.results.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-2 py-1 font-mono">{r.code}</td>
                    <td className="border border-gray-200 px-2 py-1">{r.phone || '—'}</td>
                    <td className="border border-gray-200 px-2 py-1">
                      {r.status === 'ready'     && <span className="text-green-600 font-semibold">Ready</span>}
                      {r.status === 'no_phone'  && <span className="text-yellow-600 font-semibold">No Phone</span>}
                      {r.status === 'not_found' && <span className="text-red-500 font-semibold">Not Found</span>}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-gray-500 truncate max-w-xs">{r.sms || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-300">
            <div className="flex items-center gap-3">
              <button
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-6 py-1.5 rounded transition-colors disabled:opacity-50"
                onClick={handleSendBroadcastSMS}
                disabled={broadcastSending || broadcastPreview.ready === 0}
              >
                {broadcastSending ? 'SENDING…' : `SEND SMS (${broadcastPreview.ready})`}
              </button>
              {!broadcastSending && broadcastSendStatus && (
                <StatusBadge message={broadcastSendStatus.msg} type={broadcastSendStatus.type} />
              )}
            </div>
            {sendProgress && !billsSending && <SendProgress progress={sendProgress} onCancel={() => { abortRef.current = true; }} />}
          </div>
        </div>
      )}

    </div>
  );
}

function LogsContent() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/logs`)
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatTs = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const typeBadge = (log) => {
    if (log.type === 'activity') {
      const isLogin = log.logCode === 'Login';
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isLogin ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {log.logCode}
        </span>
      );
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">SMS</span>;
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Activity &amp; SMS Logs</h2>
      <div className="border border-gray-300 rounded overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-200">
            <tr>
              {['Type', 'User', 'Detail', 'Sent', 'Failed', 'Date & Time'].map(h => (
                <th key={h} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No logs yet.</td></tr>
            )}
            {logs.map((log, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-1.5">{typeBadge(log)}</td>
                <td className="border border-gray-200 px-3 py-1.5 font-medium">{log.user}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-600">{log.type === 'activity' ? '—' : log.logCode}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-green-700 font-medium">{log.sent ?? '—'}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-red-500">{log.failed ?? '—'}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{formatTs(log.created)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROLES = ['admin', 'manager', 'cashier'];

function UsersContent({ employee }) {
  const isAdmin = employee?.role === 'admin';

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editUser, setEditUser]   = useState(null);   // null = add, object = edit
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const emptyForm = { username: '', name: '', email: '', role: 'cashier', password: '', active: true };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true); setLoadError('');
    fetch(`${API_BASE}/auth/employees`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setUsers(d.employees); }
        else { setUsers([]); setLoadError(d.error || 'Failed to load users.'); }
        setLoading(false);
      })
      .catch(() => { setLoadError('Cannot reach server.'); setLoading(false); });
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditUser(null);
    setForm(emptyForm);
    setFormError(''); setFormSuccess('');
    setShowForm(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ username: u.username, name: u.name, email: u.email || '', role: u.role, password: '', active: u.active });
    setFormError(''); setFormSuccess('');
    setShowForm(true);
  }

  async function handleSave() {
    setFormError(''); setFormSuccess('');
    if (!form.name.trim() || !form.role) { setFormError('Name and role are required.'); return; }
    if (!editUser && (!form.username.trim() || !form.password)) { setFormError('Username and password are required.'); return; }

    setSaving(true);
    try {
      const url    = editUser ? `${API_BASE}/auth/employees/${editUser.id}` : `${API_BASE}/auth/employees`;
      const method = editUser ? 'PUT' : 'POST';
      const body   = editUser
        ? { name: form.name, email: form.email, role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) }
        : { username: form.username, name: form.name, email: form.email, role: form.role, password: form.password };

      const res  = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setFormError(data.error || 'Failed to save.'); }
      else { setFormSuccess(editUser ? 'User updated.' : 'User created.'); load(); if (!editUser) setForm(emptyForm); }
    } catch { setFormError('Server error.'); }
    setSaving(false);
  }

  const roleBadge = { admin: 'bg-red-100 text-red-700', manager: 'bg-yellow-100 text-yellow-700', cashier: 'bg-blue-100 text-blue-700' };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">User Accounts</h2>
        {isAdmin && !showForm && (
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors">
            + Add User
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && isAdmin && (
        <div className="border border-gray-300 rounded mb-5 overflow-hidden">
          <div className="bg-gray-200 border-b border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
            {editUser ? `Edit — ${editUser.name}` : 'New User'}
          </div>
          <div className="p-4 bg-white grid grid-cols-2 gap-3">
            {!editUser && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
                <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. jdoe" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
              <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Juan Dela Cruz" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
              <input type="email" className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. juan@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
              <select className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Password {editUser && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}
              </label>
              <input type="password" className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            {editUser && (
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="activeChk" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                <label htmlFor="activeChk" className="text-sm text-gray-700">Active</label>
              </div>
            )}
          </div>
          {formError   && <div className="px-4 pb-2 text-xs text-red-600 font-medium">{formError}</div>}
          {formSuccess && <div className="px-4 pb-2 text-xs text-green-600 font-medium">{formSuccess}</div>}
          <div className="px-4 pb-3 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-1.5 rounded transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (editUser ? 'Save Changes' : 'Create User')}
            </button>
            <button onClick={() => { setShowForm(false); setFormError(''); setFormSuccess(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-300 hover:border-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">{loadError}</div>
      )}

      {/* Users Table */}
      <div className="border border-gray-300 rounded overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-200">
            <tr>
              {['Name', 'Username', 'Email', 'Role', 'Status', ...(isAdmin ? ['Actions'] : [])].map(h => (
                <th key={h} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={isAdmin ? 6 : 5} className="px-3 py-4 text-center text-gray-400">Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-3 py-4 text-center text-gray-400">No users found.</td></tr>}
            {users.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-1.5 font-medium">{u.name}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-500 font-mono">{u.username}</td>
                <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{u.email || <span className="text-gray-300 italic">—</span>}</td>
                <td className="border border-gray-200 px-3 py-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="border border-gray-200 px-3 py-1.5">
                  {u.active
                    ? <span className="text-green-600 font-semibold">Active</span>
                    : <span className="text-red-500 font-semibold">Inactive</span>}
                </td>
                {isAdmin && (
                  <td className="border border-gray-200 px-3 py-1.5">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold">
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChatBotContent() {
  const [headers, setHeaders]   = useState([]);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [editRow, setEditRow]   = useState(null); // { _row, ...fields }
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  const API = `${API_BASE}/chatbot`;

  const load = () => {
    setLoading(true); setError('');
    fetch(API, { credentials: 'include' })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); }
        catch { throw new Error(`Server error (${r.status}): ${text.slice(0, 120)}`); }
      })
      .then(d => {
        if (d.success) { setHeaders(d.headers); setRows(d.data); }
        else setError(d.error || 'Failed to load.');
        setLoading(false);
      })
      .catch(e => { setError(e.message || 'Cannot reach server.'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  function openAdd() {
    const blank = {};
    headers.forEach(h => { blank[h] = ''; });
    setForm(blank); setEditRow(null); setFormError(''); setShowForm(true);
  }

  function openEdit(row) {
    const f = {};
    headers.forEach(h => { f[h] = row[h] ?? ''; });
    setForm(f); setEditRow(row); setFormError(''); setShowForm(true);
  }

  async function handleSave() {
    setSaving(true); setFormError('');
    const values = headers.map(h => form[h] ?? '');
    try {
      let res;
      if (editRow) {
        res = await fetch(`${API}/${editRow._row}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });
      } else {
        res = await fetch(API, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });
      }
      const d = await res.json();
      if (d.success) { setShowForm(false); load(); }
      else setFormError(d.error || 'Failed to save.');
    } catch { setFormError('Server error.'); }
    setSaving(false);
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete this row?`)) return;
    try {
      const res = await fetch(`${API}/${row._row}`, { method: 'DELETE', credentials: 'include' });
      const d = await res.json();
      if (d.success) load();
      else alert(d.error || 'Failed to delete.');
    } catch { alert('Server error.'); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">Chat Bot</h2>
        {!showForm && (
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors">
            + Add Row
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="border border-gray-300 rounded mb-5 overflow-hidden">
          <div className="bg-gray-200 border-b border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 uppercase tracking-wide">
            {editRow ? 'Edit Row' : 'New Row'}
          </div>
          <div className="p-4 bg-white grid grid-cols-2 gap-3">
            {headers.map(h => (
              <div key={h}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{h}</label>
                <input
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-400"
                  value={form[h] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [h]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {formError && <div className="px-4 pb-2 text-xs text-red-600 font-medium">{formError}</div>}
          <div className="px-4 pb-3 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-1.5 rounded transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : (editRow ? 'Save Changes' : 'Add Row')}
            </button>
            <button onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-300 hover:border-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      {/* Grid */}
      <div className="border border-gray-300 rounded overflow-hidden overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-200">
            <tr>
              {headers.map(h => (
                <th key={h} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
              ))}
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={headers.length + 1} className="px-3 py-4 text-center text-gray-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={headers.length + 1} className="px-3 py-4 text-center text-gray-400">No data found.</td></tr>}
            {rows.map((row, i) => (
              <tr key={row._row} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {headers.map(h => (
                  <td key={h} className="border border-gray-200 px-3 py-1.5 text-gray-700">{row[h]}</td>
                ))}
                <td className="border border-gray-200 px-3 py-1.5 flex gap-3">
                  <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline font-semibold">Edit</button>
                  <button onClick={() => handleDelete(row)} className="text-red-500 hover:underline font-semibold">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SERVICE_CONFIGS = [
  {
    icon: FileText, label: 'View Bill', desc: 'Check your current water bill',
    tabName: 'BillInquiries',
    headers: ['Name', 'Conscode', 'Account Number', 'Notes', 'Status'],
    fields: [
      { key: 'name',          label: 'Full Name',       type: 'text',     required: true  },
      { key: 'conscode',      label: 'Conscode',        type: 'text',     required: true  },
      { key: 'accountNumber', label: 'Account Number',  type: 'text',     required: false },
      { key: 'notes',         label: 'Notes',           type: 'textarea', required: false },
    ],
  },
  {
    icon: CreditCard, label: 'Pay Water Bill', desc: 'Pay your outstanding balance',
    tabName: 'PaymentRecords',
    headers: ['Name', 'Conscode', 'Account Number', 'Amount Paid', 'Payment Date', 'Mode of Payment', 'Reference Number', 'Remarks'],
    fields: [
      { key: 'name',            label: 'Full Name',        type: 'text',     required: true  },
      { key: 'conscode',        label: 'Conscode',         type: 'text',     required: false },
      { key: 'accountNumber',   label: 'Account Number',   type: 'text',     required: false },
      { key: 'amountPaid',      label: 'Amount Paid (₱)',  type: 'number',   required: true  },
      { key: 'paymentDate',     label: 'Payment Date',     type: 'date',     required: true  },
      { key: 'modeOfPayment',   label: 'Mode of Payment',  type: 'select',   required: true,
        options: ['Cash', 'GCash', 'Maya', 'Bank Transfer', 'Other'] },
      { key: 'referenceNumber', label: 'Reference Number', type: 'text',     required: false },
      { key: 'remarks',         label: 'Remarks',          type: 'textarea', required: false },
    ],
  },
  {
    icon: AlertTriangle, label: 'Report a Leak', desc: 'Report water leak in your area',
    tabName: 'LeakReports',
    headers: ['Name', 'Contact Number', 'Address', 'Location of Leak', 'Description', 'Urgency', 'Ticket Number'],
    fields: [
      { key: 'name',           label: 'Full Name',        type: 'text',     required: true  },
      { key: 'contactNumber',  label: 'Contact Number',   type: 'text',     required: true  },
      { key: 'address',        label: 'Address',          type: 'text',     required: true  },
      { key: 'leakLocation',   label: 'Location of Leak', type: 'map',      required: true  },
      { key: 'description',    label: 'Description',      type: 'textarea', required: true  },
      { key: 'urgency',        label: 'Urgency',          type: 'select',   required: true,
        options: ['Low', 'Medium', 'High — Needs Immediate Attention'] },
    ],
  },
  {
    icon: ClipboardList, label: 'Billing Concerns', desc: 'Raise a billing dispute or inquiry',
    tabName: 'BillingConcerns',
    headers: ['Name', 'Account Number', 'Contact Number', 'Concern Type', 'Description', 'Ticket Number'],
    fields: [
      { key: 'name',          label: 'Full Name',      type: 'text',     required: true  },
      { key: 'accountNumber', label: 'Account Number', type: 'text',     required: true  },
      { key: 'contactNumber', label: 'Contact Number', type: 'text',     required: true  },
      { key: 'concernType',   label: 'Concern Type',   type: 'select',   required: true,
        options: ['Overcharge', 'Incorrect Meter Reading', 'Penalty Dispute', 'Duplicate Bill', 'Others'] },
      { key: 'description',   label: 'Description',    type: 'textarea', required: true  },
    ],
  },
  {
    icon: Home, label: 'New Service Application', desc: 'Apply for a new water connection',
    tabName: 'ServiceApplications',
    headers: ['Applicant Name', 'Address', 'Contact Number', 'Email', 'Property Type', 'Connection Type'],
    fields: [
      { key: 'applicantName',  label: 'Applicant Name',  type: 'text',   required: true  },
      { key: 'address',        label: 'Address',         type: 'text',   required: true  },
      { key: 'contactNumber',  label: 'Contact Number',  type: 'text',   required: true  },
      { key: 'email',          label: 'Email',           type: 'email',  required: false },
      { key: 'propertyType',   label: 'Property Type',   type: 'select', required: true,
        options: ['Residential', 'Commercial', 'Industrial'] },
      { key: 'connectionType', label: 'Connection Type', type: 'select', required: true,
        options: ['New Connection', 'Transfer of Account', 'Additional Connection'] },
    ],
  },
  {
    icon: RefreshCw, label: 'Reconnect Service', desc: 'Request service reconnection',
    tabName: 'ReconnectRequests',
    headers: ['Name', 'Conscode', 'Account Number', 'Contact Number', 'Address', 'Reason for Disconnection'],
    fields: [
      { key: 'name',          label: 'Full Name',                type: 'text',     required: true  },
      { key: 'conscode',      label: 'Conscode',                 type: 'text',     required: false },
      { key: 'accountNumber', label: 'Account Number',           type: 'text',     required: false },
      { key: 'contactNumber', label: 'Contact Number',           type: 'text',     required: true  },
      { key: 'address',       label: 'Address',                  type: 'text',     required: true  },
      { key: 'reason',        label: 'Reason for Disconnection', type: 'textarea', required: true  },
    ],
  },
  {
    icon: Droplets, label: 'Low Pressure / No Water Report', desc: 'Report water supply issues',
    tabName: 'WaterIssues',
    headers: ['Name', 'Contact Number', 'Address', 'Issue Type', 'Date/Time Noticed', 'Description', 'Ticket Number'],
    fields: [
      { key: 'name',          label: 'Full Name',         type: 'text',           required: true  },
      { key: 'contactNumber', label: 'Contact Number',    type: 'text',           required: true  },
      { key: 'address',       label: 'Address',           type: 'text',           required: true  },
      { key: 'issueType',     label: 'Issue Type',        type: 'select',         required: true,
        options: ['Low Water Pressure', 'No Water Supply', 'Discolored Water', 'Other'] },
      { key: 'dateNoticed',   label: 'Date/Time Noticed', type: 'datetime-local', required: true  },
      { key: 'description',   label: 'Description',       type: 'textarea',       required: false },
    ],
  },
  {
    icon: MessageSquare, label: 'Customer Support Chat', desc: 'Send a message to our support team',
    tabName: 'SupportRequests',
    headers: ['Name', 'Contact Number', 'Subject', 'Message'],
    fields: [
      { key: 'name',          label: 'Full Name',      type: 'text',     required: true },
      { key: 'contactNumber', label: 'Contact Number', type: 'text',     required: true },
      { key: 'subject',       label: 'Subject',        type: 'text',     required: true },
      { key: 'message',       label: 'Message',        type: 'textarea', required: true },
    ],
  },
  {
    icon: Wrench, label: 'Request a Plumber', desc: 'Request a plumber for repairs or installation',
    tabName: 'PlumberRequests',
    headers: ['Full Name', 'Address', 'Phone Number', 'Email', 'Nature of Repair', 'Urgency'],
    fields: [
      { key: 'name',          label: 'Full Name',         type: 'text',     required: true  },
      { key: 'address',       label: 'Address',           type: 'text',     required: true  },
      { key: 'phoneNumber',   label: 'Phone Number',      type: 'text',     required: true  },
      { key: 'email',         label: 'Email Address',     type: 'email',    required: true  },
      { key: 'natureRepair',  label: 'Nature of Repair',  type: 'textarea', required: true  },
      { key: 'urgency',       label: 'Urgency',           type: 'select',   required: true,
        options: ['Low — Schedule at convenience', 'Medium — Within the week', 'High — Urgent, needs immediate attention'] },
    ],
  },
];

function LocationPicker({ value, onChange }) {
  const [loading, setLoading]   = useState(false);
  const [coords, setCoords]     = useState(null);
  const [geoError, setGeoError] = useState('');

  function pinMyLocation() {
    setLoading(true); setGeoError('');
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setCoords({ lat, lng });
        onChange(`${lat.toFixed(6)}, ${lng.toFixed(6)} — https://maps.google.com/?q=${lat},${lng}`);
        setLoading(false);
      },
      (err) => { setGeoError('Could not get location: ' + err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-2">
      <input type="text" value={value} onChange={e => { onChange(e.target.value); setCoords(null); }}
        placeholder="Describe the leak location, or pin it below"
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
      <button type="button" onClick={pinMyLocation} disabled={loading}
        className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50">
        {loading ? '⏳ Getting location…' : '📍 Pin My Current Location'}
      </button>
      {geoError && <p className="text-xs text-red-500">{geoError}</p>}
      {coords && (
        <div className="rounded overflow-hidden border border-gray-200">
          <iframe title="Pinned Location" width="100%" height="180" frameBorder="0"
            src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`} allowFullScreen />
          <p className="text-xs text-gray-500 px-2 py-1 bg-gray-50">📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</p>
        </div>
      )}
    </div>
  );
}

function ServiceFormScreen({ config, onClose }) {
  const [form, setForm]       = useState(Object.fromEntries(config.fields.map(f => [f.key, ''])));
  const [submitting, setSub]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');
  const [billData, setBillData] = useState(null);
  const [billNotFound, setBillNotFound] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [leakReportSubmitted, setLeakReportSubmitted] = useState(false);
  const [waterIssueSubmitted, setWaterIssueSubmitted] = useState(false);
  const [waterIssueTicketNumber, setWaterIssueTicketNumber] = useState('');
  const [billingConcernSubmitted, setBillingConcernSubmitted] = useState(false);
  const [billingConcernTicketNumber, setBillingConcernTicketNumber] = useState('');
  const barcodeRef = useRef(null);

  const inputCls = 'w-full border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900';
  const labelCls = 'block text-xs font-semibold text-blue-900 mb-1 uppercase tracking-wide';

  // Generate barcode when billData is set
  useEffect(() => {
    if (billData && barcodeRef.current) {
      const conscode = billData['Conscode'] || billData['conscode'] || '';
      if (conscode) {
        try {
          JsBarcode(barcodeRef.current, conscode, {
            format: 'CODE128',
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 10,
          });
        } catch (err) {
          console.error('Error generating barcode:', err);
        }
      }
    }
  }, [billData]);

  // Generate ticket number for leak reports
  const generateTicketNumber = () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
    return `LEAK-${date}-${random}`;
  };

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBillData(null); setBillNotFound(false); setLeakReportSubmitted(false); setWaterIssueSubmitted(false); setBillingConcernSubmitted(false);
    
    // Special handling for "View Bill" service
    if (config.label === 'View Bill') {
      const conscode = form.conscode?.trim();
      if (!conscode) {
        setError('Please enter a Conscode');
        return;
      }
      
      setSub(true);
      let billStatus = 'Failed';
      try {
        // Fetch the latest bill data
        const res = await fetch(`${API_BASE}/sheets/latest-bill`);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch {
          throw new Error(`Server error (${res.status}): ${text.replace(/<[^>]+>/g, '').trim().slice(0, 200)}`);
        }
        if (!data.success) throw new Error(data.error || 'Failed to fetch bill data.');
        
        // Search for the conscode in the rows
        const { headers, rows } = data;
        const conscodeIndex = headers.findIndex(h => h && h.toLowerCase() === 'conscode');
        
        if (conscodeIndex === -1) {
          throw new Error('Conscode column not found in bill data.');
        }
        
        const matchedRow = rows.find(row => row[conscodeIndex] && row[conscodeIndex].toString().trim().toLowerCase() === conscode.toLowerCase());
        
        if (!matchedRow) {
          // Bill not found - save with Failed status and return
          billStatus = 'Failed';
          const rowData = [form.name || '', form.conscode || '', form.accountNumber || '', form.notes || '', billStatus];
          await fetch(`${API_BASE}/sheets/service-request`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
          });
          setBillNotFound(true);
          setSub(false);
          return;
        }
        
        // Build the bill data object
        const bill = {};
        headers.forEach((header, index) => {
          bill[header] = matchedRow[index] || '';
        });
        
        // Bill found successfully - save with Success status
        billStatus = 'Success';
        const rowData = [form.name || '', form.conscode || '', form.accountNumber || '', form.notes || '', billStatus];
        await fetch(`${API_BASE}/sheets/service-request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
        });
        
        setBillData(bill);
      } catch (err) { 
        // Error occurred - save with Failed status
        billStatus = 'Failed';
        const rowData = [form.name || '', form.conscode || '', form.accountNumber || '', form.notes || '', billStatus];
        try {
          await fetch(`${API_BASE}/sheets/service-request`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
          });
        } catch (saveErr) {
          console.error('Failed to save inquiry:', saveErr);
        }
        setError(err.message); 
      }
      setSub(false);
      return;
    }
    
    // Special handling for "Report a Leak" service
    if (config.label === 'Report a Leak') {
      setSub(true);
      try {
        // Generate ticket number
        const ticket = generateTicketNumber();
        setTicketNumber(ticket);
        
        // Fetch Hotlines tab to get the LeakReports hotline
        const hotlinesRes = await fetch(`${API_BASE}/sheets/get-tab?tab=Hotlines`);
        const hotlinesText = await hotlinesRes.text();
        let hotlinesData;
        try { hotlinesData = JSON.parse(hotlinesText); } catch {
          throw new Error('Failed to fetch hotlines data');
        }
        
        // Look for LeakReports row in Hotlines tab
        let hotlineNumber = '';
        if (hotlinesData.success && hotlinesData.rows) {
          const hotlineRow = hotlinesData.rows.find(row => 
            row[0] && row[0].toString().toLowerCase().includes('leak')
          );
          if (hotlineRow && hotlineRow[2]) {
            hotlineNumber = hotlineRow[2].toString().trim();
          }
        }
        
        if (!hotlineNumber) {
          console.warn('Hotline number not found for LeakReports');
        }
        
        // Save to LeakReports with ticket number
        const rowData = [
          form.name || '',
          form.contactNumber || '',
          form.address || '',
          form.leakLocation || '',
          form.description || '',
          form.urgency || '',
          ticket
        ];
        
        const saveRes = await fetch(`${API_BASE}/sheets/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
        });
        
        const saveText = await saveRes.text();
        let saveData;
        try { saveData = JSON.parse(saveText); } catch {
          throw new Error('Failed to save leak report');
        }
        
        if (!saveData.success) throw new Error(saveData.error || 'Failed to save leak report');
        
        // Send SMS notification to hotline if available
        if (hotlineNumber) {
          const smsMessage = `Leak Report Received\nTicket: ${ticket}\nLocation: ${form.address}\nUrgency: ${form.urgency}\nReporter: ${form.name} (${form.contactNumber})`;
          
          try {
            await fetch(`${API_BASE}/sms/send-single`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: hotlineNumber,
                message: smsMessage,
              }),
            });
          } catch (smsErr) {
            console.error('Failed to send SMS notification:', smsErr);
            // Don't throw error - SMS failure shouldn't prevent form submission
          }
        }
        
        // Show confirmation modal with ticket number
        setLeakReportSubmitted(true);
      } catch (err) {
        setError(err.message);
      }
      setSub(false);
      return;
    }
    
    // Special handling for "Low Pressure / No Water Report" service
    if (config.label === 'Low Pressure / No Water Report') {
      setSub(true);
      try {
        // Generate ticket number
        const ticket = generateTicketNumber().replace('LEAK', 'WATER');
        setWaterIssueTicketNumber(ticket);
        
        // Fetch Hotlines tab to get the water issues hotline
        const hotlinesRes = await fetch(`${API_BASE}/sheets/get-tab?tab=Hotlines`);
        const hotlinesText = await hotlinesRes.text();
        let hotlinesData;
        try { hotlinesData = JSON.parse(hotlinesText); } catch {
          throw new Error('Failed to fetch hotlines data');
        }
        
        // Look for Water or WaterIssues row in Hotlines tab
        let hotlineNumber = '';
        if (hotlinesData.success && hotlinesData.rows) {
          const hotlineRow = hotlinesData.rows.find(row => 
            row[0] && (row[0].toString().toLowerCase().includes('water') || row[0].toString().toLowerCase().includes('pressure'))
          );
          if (hotlineRow && hotlineRow[2]) {
            hotlineNumber = hotlineRow[2].toString().trim();
          }
        }
        
        if (!hotlineNumber) {
          console.warn('Hotline number not found for Water Issues');
        }
        
        // Save to WaterIssues with ticket number
        const rowData = [
          form.name || '',
          form.contactNumber || '',
          form.address || '',
          form.issueType || '',
          form.dateNoticed || '',
          form.description || '',
          ticket
        ];
        
        const saveRes = await fetch(`${API_BASE}/sheets/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
        });
        
        const saveText = await saveRes.text();
        let saveData;
        try { saveData = JSON.parse(saveText); } catch {
          throw new Error('Failed to save water issue report');
        }
        
        if (!saveData.success) throw new Error(saveData.error || 'Failed to save water issue report');
        
        // Send SMS notification to hotline if available
        if (hotlineNumber) {
          const smsMessage = `Water Issue Report\nTicket: ${ticket}\nIssue: ${form.issueType}\nLocation: ${form.address}\nReporter: ${form.name} (${form.contactNumber})`;
          
          try {
            await fetch(`${API_BASE}/sms/send-single`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: hotlineNumber,
                message: smsMessage,
              }),
            });
          } catch (smsErr) {
            console.error('Failed to send SMS notification:', smsErr);
            // Don't throw error - SMS failure shouldn't prevent form submission
          }
        }
        
        // Show confirmation modal with ticket number
        setWaterIssueSubmitted(true);
      } catch (err) {
        setError(err.message);
      }
      setSub(false);
      return;
    }
    
    // Special handling for "Billing Concerns" service
    if (config.label === 'Billing Concerns') {
      setSub(true);
      try {
        // Generate ticket number
        const ticket = generateTicketNumber().replace('LEAK', 'BILL');
        setBillingConcernTicketNumber(ticket);
        
        // Fetch Hotlines tab to get the billing concerns hotline
        const hotlinesRes = await fetch(`${API_BASE}/sheets/get-tab?tab=Hotlines`);
        const hotlinesText = await hotlinesRes.text();
        let hotlinesData;
        try { hotlinesData = JSON.parse(hotlinesText); } catch {
          throw new Error('Failed to fetch hotlines data');
        }
        
        // Look for Billing row in Hotlines tab (column A = "Billing")
        let hotlineNumber = '';
        if (hotlinesData.success && hotlinesData.rows) {
          const hotlineRow = hotlinesData.rows.find(row => 
            row[0] && row[0].toString().trim() === 'Billing'
          );
          if (hotlineRow && hotlineRow[2]) {
            hotlineNumber = hotlineRow[2].toString().trim();
          }
        }
        
        if (!hotlineNumber) {
          console.warn('Hotline number not found for Billing Concerns (looking for "Billing" in column A)');
        }
        
        // Save to BillingConcerns with ticket number
        const rowData = [
          form.name || '',
          form.accountNumber || '',
          form.contactNumber || '',
          form.concernType || '',
          form.description || '',
          ticket
        ];
        
        const saveRes = await fetch(`${API_BASE}/sheets/service-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
        });
        
        const saveText = await saveRes.text();
        let saveData;
        try { saveData = JSON.parse(saveText); } catch {
          throw new Error('Failed to save billing concern');
        }
        
        if (!saveData.success) throw new Error(saveData.error || 'Failed to save billing concern');
        
        // Send SMS notification to hotline if available
        if (hotlineNumber) {
          const smsMessage = `Billing Concern Report\nTicket: ${ticket}\nConcern: ${form.concernType}\nAccount: ${form.accountNumber}\nReporter: ${form.name} (${form.contactNumber})`;
          
          try {
            await fetch(`${API_BASE}/sms/send-single`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: hotlineNumber,
                message: smsMessage,
              }),
            });
          } catch (smsErr) {
            console.error('Failed to send SMS notification:', smsErr);
            // Don't throw error - SMS failure shouldn't prevent form submission
          }
        }
        
        // Show confirmation modal with ticket number
        setBillingConcernSubmitted(true);
      } catch (err) {
        setError(err.message);
      }
      setSub(false);
      return;
    }
    
    // Default handling for other services
    const rowData = config.fields.map(f => form[f.key] || '');
    setSub(true);
    try {
      const res  = await fetch(`${API_BASE}/sheets/service-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabName: config.tabName, headers: config.headers, rowData }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error(`Server error (${res.status}): ${text.replace(/<[^>]+>/g, '').trim().slice(0, 200)}`);
      }
      if (!data.success) throw new Error(data.error || 'Submission failed.');
      setSuccess(true);
    } catch (err) { setError(err.message); }
    setSub(false);
  }
  
  // Display bill if found
  if (billData) {
    // Parse currency values and calculate total
    const parseAmount = (val) => {
      if (!val) return 0;
      const str = String(val).replace(/[^\d.]/g, '');
      return parseFloat(str) || 0;
    };
    
    const waterFee = parseAmount(billData['Water Fee'] || billData['water_fee'] || billData['WaterFee']);
    const installFee = parseAmount(billData['Installation Fee'] || billData['installation_fee'] || billData['InstallationFee']);
    const meterMaint = parseAmount(billData['Meter Maintenance'] || billData['meter_maintenance'] || billData['MeterMaintenance']);
    const total = (waterFee + installFee + meterMaint).toFixed(2);
    
    return (
      <div className="fixed inset-0 z-[200] bg-gray-100 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        <div className="min-h-full flex flex-col max-w-sm mx-auto w-full">
          {/* Top bar */}
          <div className="bg-gradient-to-r from-cyan-400 to-blue-950 px-5 py-4 flex items-center gap-3">
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-white/80" strokeWidth={1.5} />
              <h2 className="text-base font-bold text-white">Your Water Bill</h2>
            </div>
          </div>

          {/* Content - Receipt Style */}
          <div className="flex-1 px-4 py-6">
            {/* Receipt Paper */}
            <div 
              className="mx-auto w-full max-w-2xl rounded-sm shadow-lg p-6 border border-yellow-100 font-mono text-sm text-center"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.02) 1px, rgba(0,0,0,0.02) 2px),
                  repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.01) 1px, rgba(0,0,0,0.01) 2px)
                `,
                backgroundColor: '#fffdf7',
              }}
            >
              {/* Header */}
              <div className="mb-4 pb-3 border-b-2 border-dashed border-gray-400">
                <p className="font-bold text-lg tracking-wider">WATER BILL</p>
                <p className="text-xs text-gray-600 mt-1">Billing Statement</p>
              </div>

              {/* Customer Info */}
              <div className="mb-4 pb-3 border-b border-dashed border-gray-300 text-left space-y-1">
                <p><span className="font-semibold">Name:</span> <span className="float-right">{billData['Name'] || billData['name'] || '—'}</span></p>
                <p><span className="font-semibold">Conscode:</span> <span className="float-right">{billData['Conscode'] || billData['conscode'] || '—'}</span></p>
                {(billData['Account Number'] || billData['account_number']) && (
                  <p><span className="font-semibold">Account:</span> <span className="float-right">{billData['Account Number'] || billData['account_number']}</span></p>
                )}
              </div>

              {/* Consumption & Important Fields */}
              {(billData['Consumption'] || billData['consumption']) && (
                <div className="mb-4 pb-3 border-b border-dashed border-gray-300 text-left">
                  <p className="font-semibold">Consumption: <span className="float-right">{billData['Consumption'] || billData['consumption']} m³</span></p>
                </div>
              )}

              {/* Charges */}
              <div className="mb-4 pb-3 border-b-2 border-dashed border-gray-400 text-left space-y-2">
                <p className="font-semibold text-center mb-2">CHARGES</p>
                <p><span>Water Fee:</span> <span className="float-right">₱{waterFee.toFixed(2)}</span></p>
                {installFee > 0 && (
                  <p><span>Installation Fee:</span> <span className="float-right">₱{installFee.toFixed(2)}</span></p>
                )}
                {meterMaint > 0 && (
                  <p><span>Meter Maintenance:</span> <span className="float-right">₱{meterMaint.toFixed(2)}</span></p>
                )}
              </div>

              {/* Total */}
              <div className="mb-4 pb-3 border-b-2 border-dashed border-gray-400">
                <p className="text-lg font-bold">TOTAL: <span className="float-right">₱{total}</span></p>
              </div>

              {/* Dates */}
              <div className="mb-4 text-left space-y-1 text-xs">
                {(billData['Due Date'] || billData['due_date']) && (
                  <p><span className="font-semibold">Due Date:</span> <span className="float-right">{billData['Due Date'] || billData['due_date']}</span></p>
                )}
                {(billData['Disconnection Date'] || billData['discon_date']) && (
                  <p className="text-red-600"><span className="font-semibold">Cutoff Date:</span> <span className="float-right">{billData['Disconnection Date'] || billData['discon_date']}</span></p>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t-2 border-dashed border-gray-400 text-xs text-gray-600">
                <p>Thank you for paying on time</p>
                
                {/* Barcode */}
                <div className="mt-4 flex justify-center">
                  <svg ref={barcodeRef}></svg>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-6 pb-6">
              <button onClick={() => { setBillData(null); }} 
                className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm py-3 rounded-lg transition-colors">
                Back to Form
              </button>
              <button onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold text-sm py-3 rounded-lg hover:bg-gray-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
      <div className="min-h-full flex flex-col max-w-lg mx-auto w-full">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-cyan-400 to-blue-950 px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <config.icon className="w-5 h-5 text-white/80" strokeWidth={1.5} />
            <h2 className="text-base font-bold text-white">{config.label}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-6">
          {config.desc && (
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{config.desc}</p>
          )}

        {leakReportSubmitted ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="bg-green-600 rounded-full p-4 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-900">Leak Report Submitted</p>
              <p className="text-sm text-gray-500 mt-2">Thank you! Our team has been notified.</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 w-full mt-2 border-2 border-dashed border-blue-900">
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Your Ticket Number</p>
              <p className="text-2xl font-bold text-blue-900 font-mono">{ticketNumber}</p>
              <p className="text-xs text-gray-500 mt-2">Please keep this number for your records</p>
            </div>
            <button onClick={onClose} className="mt-6 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition-colors w-full">
              Back to Services
            </button>
          </div>
        ) : waterIssueSubmitted ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="bg-blue-600 rounded-full p-4 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-900">Water Issue Report Submitted</p>
              <p className="text-sm text-gray-500 mt-2">Thank you! Our team has been notified and will address this shortly.</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 w-full mt-2 border-2 border-dashed border-blue-900">
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Your Ticket Number</p>
              <p className="text-2xl font-bold text-blue-900 font-mono">{waterIssueTicketNumber}</p>
              <p className="text-xs text-gray-500 mt-2">Please keep this number for your records</p>
            </div>
            <button onClick={onClose} className="mt-6 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition-colors w-full">
              Back to Services
            </button>
          </div>
        ) : billingConcernSubmitted ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="bg-purple-600 rounded-full p-4 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-900">Billing Concern Submitted</p>
              <p className="text-sm text-gray-500 mt-2">Thank you! We will review your concern and get back to you shortly.</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 w-full mt-2 border-2 border-dashed border-blue-900">
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Your Ticket Number</p>
              <p className="text-2xl font-bold text-blue-900 font-mono">{billingConcernTicketNumber}</p>
              <p className="text-xs text-gray-500 mt-2">Please keep this number for your records</p>
            </div>
            <button onClick={onClose} className="mt-6 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition-colors w-full">
              Back to Services
            </button>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-12">
            <div className="bg-blue-900 rounded-full p-4 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-bold text-blue-900">Request Submitted</p>
            <p className="text-sm text-gray-500">Your request has been recorded and forwarded to our team.</p>
            <button onClick={onClose} className="mt-4 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition-colors">
              Back to Services
            </button>
          </div>
        ) : billNotFound ? (
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-12">
            <div className="bg-orange-100 rounded-full p-4 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4v2m0-10a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-orange-600">Bill Not Found</p>
            <p className="text-sm text-gray-500">No bill record found for Conscode: <span className="font-semibold">{form.conscode}</span></p>
            <button onClick={() => { setBillNotFound(false); setForm(Object.fromEntries(config.fields.map(f => [f.key, '']))); }} className="mt-4 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm px-8 py-2.5 rounded-lg transition-colors">
              Try Again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {config.fields.map(f => (
              <div key={f.key}>
                <label className={labelCls}>
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea rows={3} required={f.required} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls} />
                ) : f.type === 'select' ? (
                  <select required={f.required} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls}>
                    <option value="">— Select —</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'map' ? (
                  <LocationPicker value={form[f.key]} onChange={v => setForm(p => ({ ...p, [f.key]: v }))} />
                ) : (
                  <input type={f.type} required={f.required} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls} />
                )}
              </div>
            ))}
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2 pb-6">
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-lg transition-colors">
                {submitting ? 'Searching…' : 'Submit Request'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-600 font-semibold text-sm py-3 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}

function ServiceDashboardContent() {
  const [activeConfig, setActiveConfig] = useState(null);

  return (
    <div className="min-h-full p-6 max-w-4xl mx-auto bg-gradient-to-b from-cyan-400 via-blue-600 to-blue-950">
      <div className="mb-6 text-center">
        <img src="/assets/images/header1.png" alt="Bogo Water District Logo" className="mx-auto mb-3" style={{ width: 100, height: 100, objectFit: 'contain' }} />
        <h2 className="text-2xl font-bold text-white tracking-wide">Service Dashboard</h2>
        <p className="inline-block text-sm text-white font-semibold mt-2 px-4 py-1 bg-blue-600 rounded-full">Bogo Water District — Online Services</p>
        <p className="text-xs text-white/60 mt-3 leading-relaxed max-w-md mx-auto">
          Select a service below to submit a request. Fill in the required fields and tap <span className="text-white font-semibold">Submit</span> — your request will be recorded and forwarded to our team. For urgent concerns, please call our office directly.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-[10px]">
        {SERVICE_CONFIGS.map(cfg => (
          <button
            key={cfg.label}
            onClick={() => setActiveConfig(cfg)}
            className="flex flex-col items-center justify-center text-center p-2 aspect-square rounded-2xl bg-white/10 backdrop-blur-md transition-all duration-150 shadow-sm hover:bg-white/20 hover:shadow-lg"
          >
            <cfg.icon className="w-[29px] h-[29px] text-white mb-2" strokeWidth={1.5} />
            <p className="text-xs font-semibold leading-tight text-white">{cfg.label}</p>
          </button>
        ))}
      </div>
      {activeConfig && (
        <ServiceFormScreen config={activeConfig} onClose={() => setActiveConfig(null)} />
      )}
    </div>
  );
}

const contentMap = {
  dashboard: DashboardContent,
  consumers: ConsumersContent,
  bills:     BillsContent,
  tools:     ToolsContent,
  logs:      LogsContent,
  users:     UsersContent,
  chatbot:   ChatBotContent,
  service:   ServiceDashboardContent,
};

export default function SMSBlastPage({ employee, authToken, onMenuChange }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const ActiveContent = contentMap[activeMenu];

  function handleMenuChange(id) {
    setActiveMenu(id);
    onMenuChange?.(id);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className={`flex-col items-center w-[100px] md:w-[280px] bg-gray-900 border-r border-gray-700 shrink-0 py-4 gap-1 ${activeMenu === 'service' ? 'hidden md:flex' : 'flex'}`}>
        {menuItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeMenu === id;
          return (
            <button
              key={id}
              onClick={() => handleMenuChange(id)}
              className={`relative flex flex-col items-center justify-center w-[84px] md:w-[248px] h-14 md:h-16 rounded-xl gap-1 transition-all duration-150
                ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              title={label}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
                {id === 'chatbot' && (
                  <span className="absolute left-full ml-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none pointer-events-none whitespace-nowrap">
                    New Feature
                  </span>
                )}
              </div>
              <span className="hidden md:block text-sm font-semibold tracking-wide leading-none">{label}</span>
            </button>
          );
        })}
      </aside>

      {/* Content Area */}
      <main className="flex-1 bg-gray-50 overflow-y-auto pb-16 md:pb-0">
        <ActiveContent employee={employee} authToken={authToken} />
      </main>
    </div>
  );
}
