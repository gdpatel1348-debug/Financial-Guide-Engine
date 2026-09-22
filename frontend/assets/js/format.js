/**
 * format.js — Formatting utilities
 */

/** Format a number as Indian Rupees (INR) */
export function formatINR(value, opts = {}) {
  const num = Number(value);
  if (isNaN(num)) return '—';
  const abs = Math.abs(num);
  let formatted;
  if (abs >= 1e7) {
    formatted = (num / 1e7).toFixed(2) + ' Cr';
  } else if (abs >= 1e5) {
    formatted = (num / 1e5).toFixed(2) + ' L';
  } else {
    formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }
  return opts.noSymbol ? formatted : '₹' + formatted;
}

/** Full INR with paise, no abbreviation */
export function formatINRFull(value) {
  const num = Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/** Format a decimal (e.g. "0.120000") as a percentage string */
export function formatPct(value, decimals = 1) {
  const num = Number(value);
  if (isNaN(num)) return '—';
  return (num * 100).toFixed(decimals) + '%';
}

/** Format an ISO date string to a readable date */
export function formatDate(iso, opts = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...opts
  });
}

/** Format an ISO timestamp to a readable date+time */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Severity to icon mapping */
export function severityIcon(s) {
  switch ((s || '').toUpperCase()) {
    case 'INFO':               return 'ℹ️';
    case 'INFORMATION_NEEDED': return '📋';
    case 'REVIEW_RECOMMENDED': return '🔍';
    case 'ATTENTION':          return '⚡';
    case 'WARNING':            return '⚠️';
    case 'CRITICAL':           return '🚨';
    case 'OK':                 return '✅';
    default:                   return 'ℹ️';
  }
}

/** Toast notification helper */
export function toast(message, type = 'info', durationMs = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s ease';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, durationMs);
}

/** Pluralize helper */
export function plural(n, singular, pluralForm) {
  return `${n} ${n === 1 ? singular : (pluralForm || singular + 's')}`;
}
