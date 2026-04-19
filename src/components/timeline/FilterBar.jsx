/* ============================================================
 * GitTrace — Filter Bar Component
 * ------------------------------------------------------------
 * Filter controls above the commit timeline:
 *  A) Keyword search (debounced 200ms)
 *  B) Author filter (multi-select)
 *  C) Date range + preset pills
 *  D) Change size filter
 *  E) Clear all filters
 * ============================================================ */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SIZE_OPTIONS = [
  { label: 'Any size', min: 0, max: Infinity },
  { label: 'Small (<100 lines)', min: 0, max: 99 },
  { label: 'Medium (100–999)', min: 100, max: 999 },
  { label: 'Large (1000+)', min: 1000, max: 4999 },
  { label: 'Massive (5000+)', min: 5000, max: Infinity },
];

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'This year', days: null }, // special: since Jan 1 of current year
];

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getYearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function FilterBar({ commits, onFilteredCommits }) {
  const [query, setQuery] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sizeIdx, setSizeIdx] = useState(0);

  const debouncedQuery = useDebounce(query, 200);

  // Extract unique authors
  const authors = useMemo(() => {
    if (!commits || commits.length === 0) return [];
    const map = new Map();
    for (const c of commits) {
      const name = c.author?.name || 'Unknown';
      if (!map.has(name)) {
        map.set(name, {
          name,
          avatar_url: c.author?.avatar_url || '',
        });
      }
    }
    return Array.from(map.values());
  }, [commits]);

  // Is any filter active?
  const isActive = debouncedQuery || selectedAuthors.length > 0 || dateFrom || dateTo || sizeIdx > 0;

  // Apply filters
  const filtered = useMemo(() => {
    if (!commits || commits.length === 0) return [];

    let result = commits;

    // A) Keyword search
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(c => {
        const msg = (c.message || '').toLowerCase();
        const author = (c.author?.name || '').toLowerCase();
        const files = (c.files || []).map(f => (f.filename || '').toLowerCase()).join(' ');
        return msg.includes(q) || author.includes(q) || files.includes(q);
      });
    }

    // B) Author filter
    if (selectedAuthors.length > 0) {
      result = result.filter(c =>
        selectedAuthors.includes(c.author?.name || 'Unknown')
      );
    }

    // C) Date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(c => {
        const d = new Date(c.author?.date);
        return !isNaN(d) && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      result = result.filter(c => {
        const d = new Date(c.author?.date);
        return !isNaN(d) && d <= to;
      });
    }

    // D) Change size
    if (sizeIdx > 0) {
      const { min, max } = SIZE_OPTIONS[sizeIdx];
      result = result.filter(c => {
        const total = (c.stats?.additions ?? 0) + (c.stats?.deletions ?? 0) ||
          (c.files || []).reduce((s, f) => s + (f.additions ?? 0) + (f.deletions ?? 0), 0);
        return total >= min && total <= max;
      });
    }

    return result;
  }, [commits, debouncedQuery, selectedAuthors, dateFrom, dateTo, sizeIdx]);

  // Notify parent
  useEffect(() => {
    onFilteredCommits(filtered, isActive);
  }, [filtered, isActive]);

  const clearAll = () => {
    setQuery('');
    setSelectedAuthors([]);
    setDateFrom('');
    setDateTo('');
    setSizeIdx(0);
  };

  const toggleAuthor = (name, e) => {
    if (e?.ctrlKey || e?.metaKey) {
      // Multi-select
      setSelectedAuthors(prev =>
        prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
      );
    } else {
      // Single select toggle
      setSelectedAuthors(prev =>
        prev.length === 1 && prev[0] === name ? [] : [name]
      );
    }
  };

  const applyPreset = (preset) => {
    if (preset.days === null) {
      // This year
      setDateFrom(getYearStart());
      setDateTo('');
    } else {
      setDateFrom(getDateNDaysAgo(preset.days));
      setDateTo('');
    }
  };

  const matchCount = commits?.length ?? 0;
  const filteredCount = filtered.length;

  return (
    <div className="filter-bar" id="filter-bar">
      {/* A) Keyword search */}
      <div className="filter-bar__group">
        <input
          type="text"
          className="filter-input"
          placeholder="Search commits..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          id="filter-search-input"
        />
      </div>

      {/* B) Author filter */}
      <div className="filter-bar__group">
        <select
          className="filter-dropdown"
          value={selectedAuthors.length === 1 ? selectedAuthors[0] : ''}
          onChange={e => {
            const v = e.target.value;
            setSelectedAuthors(v ? [v] : []);
          }}
          id="filter-author-select"
        >
          <option value="">All authors</option>
          {authors.map(a => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* C) Date range */}
      <div className="filter-bar__group filter-bar__group--dates">
        <input
          type="date"
          className="filter-date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          placeholder="From"
          title="From date"
          id="filter-date-from"
        />
        <span className="filter-date-sep">–</span>
        <input
          type="date"
          className="filter-date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          placeholder="To"
          title="To date"
          id="filter-date-to"
        />
      </div>

      {/* Date presets */}
      <div className="filter-bar__presets">
        {DATE_PRESETS.map(p => (
          <button
            key={p.label}
            className="filter-preset"
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* D) Change size */}
      <div className="filter-bar__group">
        <select
          className="filter-dropdown"
          value={sizeIdx}
          onChange={e => setSizeIdx(parseInt(e.target.value))}
          id="filter-size-select"
        >
          {SIZE_OPTIONS.map((opt, i) => (
            <option key={opt.label} value={i}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Match count */}
      {isActive && (
        <span className="filter-count">
          {filteredCount} of {matchCount} commits
        </span>
      )}

      {/* E) Clear all */}
      {isActive && (
        <button className="filter-clear" onClick={clearAll} id="filter-clear-btn">
          ✕ Clear filters
        </button>
      )}
    </div>
  );
}
