/* ============================================================
 * GitTrace — Inline Diff Viewer
 * ------------------------------------------------------------
 * Accordion diff panel rendered below a commit card when expanded.
 * Fetches commit detail, shows file tabs, unified diff with
 * syntax highlighting via highlight.js from CDN.
 * ============================================================ */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { githubFetch } from '../../utils/githubFetch';

// Parse unified diff patch text into structured lines
function parsePatch(patchText) {
  if (!patchText) return [];
  const lines = patchText.split('\n');
  const result = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        result.push({
          type: 'hunk',
          content: line,
          context: match[3] || '',
        });
      }
      continue;
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'add',
        lineNumber: newLine,
        content: line.slice(1),
      });
      newLine++;
    } else if (line.startsWith('-')) {
      result.push({
        type: 'remove',
        lineNumber: oldLine,
        content: line.slice(1),
      });
      oldLine++;
    } else {
      result.push({
        type: 'context',
        oldLineNumber: oldLine,
        newLineNumber: newLine,
        content: line.startsWith(' ') ? line.slice(1) : line,
      });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

// Try to detect language from filename extension
function detectLanguage(filename) {
  if (!filename) return '';
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', go: 'go', rs: 'rust',
    cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', swift: 'swift',
    kt: 'kotlin', vue: 'xml', html: 'xml', css: 'css', scss: 'scss',
    json: 'json', yml: 'yaml', yaml: 'yaml', md: 'markdown',
    sh: 'bash', bash: 'bash', sql: 'sql', xml: 'xml',
  };
  return map[ext] || '';
}

// Try to highlight a code line using hljs if loaded
function highlightLine(code, lang) {
  if (typeof window !== 'undefined' && window.hljs && lang) {
    try {
      const result = window.hljs.highlight(code, { language: lang, ignoreIllegals: true });
      return result.value;
    } catch {
      // fallback
    }
  }
  // Escape HTML
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function DiffViewer({ commit, repoInfo }) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [totalStats, setTotalStats] = useState({ additions: 0, deletions: 0 });
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [error, setError] = useState(null);

  // Fetch commit detail
  useEffect(() => {
    if (!repoInfo || !commit?.sha) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    githubFetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits/${commit.sha}`
    )
      .then(res => {
        if (!res) throw new Error('Request failed or rate limited');
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setFiles(data.files || []);
        setTotalStats(data.stats || { additions: 0, deletions: 0 });
        setActiveFileIdx(0);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [commit?.sha, repoInfo]);

  const activeFile = files[activeFileIdx] || null;
  const diffLines = useMemo(
    () => parsePatch(activeFile?.patch),
    [activeFile?.patch]
  );
  const lang = useMemo(
    () => detectLanguage(activeFile?.filename),
    [activeFile?.filename]
  );

  const diffUrl = repoInfo
    ? `https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${commit.sha}`
    : '#';

  return (
    <div className="diff-panel" id={`diff-${commit.sha?.slice(0, 7)}`}>
      {/* Loading */}
      {loading && (
        <div className="diff-panel__loading">
          <div className="skeleton skeleton-line" style={{ width: '80%', height: '13px' }} />
          <div className="skeleton skeleton-line" style={{ width: '60%', height: '13px' }} />
          <div className="skeleton skeleton-line" style={{ width: '70%', height: '13px' }} />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="diff-panel__error">
          Could not load diff: {error}
        </div>
      )}

      {/* Diff content */}
      {!loading && !error && (
        <>
          {/* Header bar */}
          <div className="diff-header">
            <span className="diff-header__stats">
              {files.length} file{files.length !== 1 ? 's' : ''} changed
              <span className="diff-header__add"> +{totalStats.additions}</span>
              <span className="diff-header__del"> −{totalStats.deletions}</span>
            </span>
            <a
              href={diffUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="diff-header__link"
              onClick={e => e.stopPropagation()}
            >
              View full diff on GitHub ↗
            </a>
          </div>

          {/* File tabs */}
          {files.length > 0 && (
            <div className="diff-tabs">
              {files.slice(0, 8).map((f, i) => (
                <button
                  key={f.filename}
                  className={`diff-file-pill${i === activeFileIdx ? ' diff-file-pill--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setActiveFileIdx(i); }}
                >
                  <span className="diff-file-pill__name">
                    {f.filename.split('/').pop()}
                  </span>
                  <span className="diff-file-pill__stats">
                    <span className="diff-file-pill__add">+{f.additions}</span>
                    <span className="diff-file-pill__del">−{f.deletions}</span>
                  </span>
                </button>
              ))}
              {files.length > 8 && (
                <span className="diff-file-pill diff-file-pill--more">
                  +{files.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Diff lines */}
          {activeFile && (
            <div className="diff-content">
              {activeFile.patch ? (
                diffLines.map((line, i) => {
                  if (line.type === 'hunk') {
                    return (
                      <div key={i} className="diff-line diff-line--hunk">
                        <span className="diff-line__num diff-line__num--hunk" />
                        <span className="diff-line__code">{line.content}</span>
                      </div>
                    );
                  }
                  if (line.type === 'add') {
                    return (
                      <div key={i} className="diff-line diff-line--add">
                        <span className="diff-line__num diff-line__num--add">{line.lineNumber}</span>
                        <span className="diff-line__prefix">+</span>
                        <span
                          className="diff-line__code"
                          dangerouslySetInnerHTML={{ __html: highlightLine(line.content, lang) }}
                        />
                      </div>
                    );
                  }
                  if (line.type === 'remove') {
                    return (
                      <div key={i} className="diff-line diff-line--remove">
                        <span className="diff-line__num diff-line__num--remove">{line.lineNumber}</span>
                        <span className="diff-line__prefix">−</span>
                        <span
                          className="diff-line__code"
                          dangerouslySetInnerHTML={{ __html: highlightLine(line.content, lang) }}
                        />
                      </div>
                    );
                  }
                  // context
                  return (
                    <div key={i} className="diff-line diff-line--context">
                      <span className="diff-line__num">{line.newLineNumber}</span>
                      <span className="diff-line__prefix"> </span>
                      <span
                        className="diff-line__code"
                        dangerouslySetInnerHTML={{ __html: highlightLine(line.content, lang) }}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="diff-panel__binary">
                  Binary file or no diff available
                </div>
              )}
            </div>
          )}

          {/* No files */}
          {files.length === 0 && (
            <div className="diff-panel__empty">
              No file changes in this commit
            </div>
          )}
        </>
      )}
    </div>
  );
}
