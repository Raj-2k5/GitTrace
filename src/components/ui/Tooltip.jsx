import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/* ============================================================
 * GitTrace — Tooltip Portal (Feature 4)
 * ------------------------------------------------------------
 * A global tooltip component that attaches to DOM elements
 * with data-tooltip, data-tooltip-desc, and data-tooltip-shortcut.
 * ============================================================ */

let activeTimeouts = {};

function positionTooltip(triggerElement, tooltipElement) {
  const triggerRect = triggerElement.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const GAP = 8; // px gap between trigger and tooltip
  const MARGIN = 12; // min distance from viewport edge

  // Default: centered above the trigger
  let top = triggerRect.top - tooltipRect.height - GAP;
  let left = triggerRect.left 
             + (triggerRect.width / 2) 
             - (tooltipRect.width / 2);

  // Flip BELOW if not enough space above
  if (top < MARGIN) {
    top = triggerRect.bottom + GAP;
  }

  // Clamp LEFT edge — never go off left side
  if (left < MARGIN) {
    left = MARGIN;
  }

  // Right-align preference hint for buttons on right half of screen
  const buttonCenterX = triggerRect.left + triggerRect.width / 2;
  if (buttonCenterX > viewportWidth / 2) {
    // Right-align: tooltip right edge = trigger right edge
    left = triggerRect.right - tooltipRect.width;
    // Then apply the clamp to prevent going off left edge
    left = Math.max(MARGIN, left);
  }

  // Clamp RIGHT edge — never go off right side
  if (left + tooltipRect.width > viewportWidth - MARGIN) {
    left = viewportWidth - tooltipRect.width - MARGIN;
  }

  // Final clamp: if tooltip would go off bottom after flip,
  // position it above even if tight
  if (top + tooltipRect.height > viewportHeight - MARGIN) {
    top = triggerRect.top - tooltipRect.height - GAP;
  }

  tooltipElement.style.position = 'fixed';
  tooltipElement.style.top = `${Math.max(MARGIN, top)}px`;
  tooltipElement.style.left = `${Math.max(MARGIN, left)}px`;
  tooltipElement.style.zIndex = '9999';
}

export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState(null);
  const [isPositioned, setIsPositioned] = useState(false);
  const tooltipRef = useRef(null);

  const hide = () => {
    setTooltip(null);
    setIsPositioned(false);
  };

  useEffect(() => {
    if ('ontouchstart' in window) return; // Ignore on touch devices

    const handleMouseEnter = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (!target) return;

      const title = target.getAttribute('data-tooltip');
      const desc = target.getAttribute('data-tooltip-desc');
      const shortcut = target.getAttribute('data-tooltip-shortcut');

      if (!title) return;

      if (activeTimeouts[target]) clearTimeout(activeTimeouts[target]);

      activeTimeouts[target] = setTimeout(() => {
        setTooltip({
          title,
          desc,
          shortcut,
          target
        });

        // Auto dismiss after 4 seconds
        setTimeout(() => {
          setTooltip((prev) => prev && prev.title === title ? null : prev);
          setIsPositioned(false);
        }, 4000);
      }, 400); // 400ms delay
    };

    const handleMouseLeave = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && activeTimeouts[target]) {
        clearTimeout(activeTimeouts[target]);
      }
      hide();
    };

    // Use event delegation on document body
    document.body.addEventListener('mouseover', handleMouseEnter, true);
    document.body.addEventListener('mouseout', handleMouseLeave, true);

    return () => {
      document.body.removeEventListener('mouseover', handleMouseEnter, true);
      document.body.removeEventListener('mouseout', handleMouseLeave, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (tooltip && tooltipRef.current && tooltip.target) {
      positionTooltip(tooltip.target, tooltipRef.current);
      setIsPositioned(true);
    }
  }, [tooltip]);

  if (!tooltip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="global-tooltip"
      style={{
        position: 'fixed',
        zIndex: 9999,
        background: '#1E293B',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '8px 12px',
        maxWidth: '220px',
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        top: 0,
        left: 0,
        opacity: isPositioned ? 1 : 0,
        transition: 'opacity 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#F9FAFB' }}>{tooltip.title}</div>
      {tooltip.desc && <div style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF', lineHeight: 1.5 }}>{tooltip.desc}</div>}
      {tooltip.shortcut && (
        <div style={{ alignSelf: 'flex-end', fontSize: '10px', fontFamily: 'monospace', color: '#6B7280', background: '#111827', borderRadius: '4px', padding: '1px 5px', marginTop: '4px' }}>
          {tooltip.shortcut}
        </div>
      )}
    </div>,
    document.body
  );
}
