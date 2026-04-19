/* ============================================================
 * GitTrace — Compare Bar
 * ------------------------------------------------------------
 * Slide-down bar below metadata with second repo search input.
 * ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRelatedRepos } from '../../api/githubExtra';

export default function CompareBar({ onCompare, currentOwner, currentRepo, currentLanguage }) {
  const [url, setUrl] = useState('');
  const [isTracing, setIsTracing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch suggestions when user types or focuses
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (url && url.length > 1) {
        // Here we could fuzzy match their own repos if we fetched them
        // For now rely on fetchRelatedRepos which does a GitHub API search
        const results = await fetchRelatedRepos(currentOwner, currentRepo, currentLanguage);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [url, currentOwner, currentRepo, currentLanguage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      setIsTracing(true);
      onCompare(url.trim());
      // Reset is managed by parent unmounting this component
    }
  };

  const handleSelect = (fullName) => {
    setUrl(fullName);
    setIsTracing(true);
    onCompare(fullName);
    setShowDropdown(false);
  };

  return (
    <div className="compare-bar-slim" ref={wrapRef} style={{ padding: '8px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Compare with another repo →</span>
      <form style={{ display: 'flex', gap: '8px', position: 'relative' }} onSubmit={handleSubmit}>
        <input
          id="compare-repo-input"
          type="text"
          style={{ width: '300px', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', color: '#D1D5DB', padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
          placeholder="Paste GitHub URL or owner/repo..."
          value={url}
          onChange={e => { setUrl(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
        />
        
        {/* Dropdown styling identical to breadcrumb dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="breadcrumb-dropdown" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px', zIndex: 100 }}>
            {suggestions.map(s => (
              <div key={s.full_name} className="breadcrumb-dropdown__item" onClick={() => handleSelect(s.full_name)}>
                {s.full_name}
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={isTracing || !url.trim()}
          style={{ background: '#374151', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', padding: '0 12px', borderRadius: '6px', fontSize: '12px', cursor: (isTracing || !url.trim()) ? 'not-allowed' : 'pointer' }}
        >
          {isTracing ? 'Tracing…' : 'Trace'}
        </button>
      </form>
    </div>
  );
}
