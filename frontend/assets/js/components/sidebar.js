import { api } from '../api.js';
import { logout } from '../auth.js';
import { toast } from '../format.js';

/**
 * Escapes HTML characters safely
 */
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Navigation specification adhering to the recommended structure:
 * - Overview
 * - Planning
 * - Analysis
 * - Insights
 * - Reports
 * - Account
 */
const SECTIONS = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '📊', href: '/dashboard.html' },
      { key: 'action-center', label: 'Action Center', icon: '⚡', href: '/action-center.html' }
    ]
  },
  {
    title: 'Planning',
    items: [
      { key: 'wizard', label: 'Intake Wizard', icon: '🧙', href: '/wizard.html' },
      { key: 'goals', label: 'Goals', icon: '🎯', href: '/goals.html' },
      { key: 'assets', label: 'Assets & Portfolio', icon: '💰', href: '/assets.html' },
      { key: 'insurance', label: 'Insurance', icon: '🛡️', href: '/insurance.html' },
      { key: 'liabilities', label: 'Liabilities', icon: '💳', href: '/liabilities.html' },
      { key: 'cash-flow', label: 'Cash Flow', icon: '📈', href: '/cash-flow.html' }
    ]
  },
  {
    title: 'Analysis',
    items: [
      { key: 'analysis', label: 'Current Analysis', icon: '🔍', href: '/analysis.html' },
      { key: 'scenarios', label: 'Scenario Comparison', icon: '⚖️', href: '/scenarios.html' },
      { key: 'history', label: 'Plan History & Replay', icon: '🗂️', href: '/history.html' }
    ]
  },
  {
    title: 'Insights',
    items: [
      { key: 'tax-center', label: 'Tax Center', icon: '📑', href: '/tax-center.html' },
      { key: 'assumptions', label: 'Assumptions & Data', icon: '⚙️', href: '/assumptions.html' },
      { key: 'insights-overlap', label: 'Portfolio Overlap', icon: '🔀', href: '/analysis.html#chart-mf-overlap-analysis' }
    ]
  },
  {
    title: 'Reports',
    items: [
      { key: 'reports', label: 'Reports', icon: '📋', href: '/reports.html' },
      { key: 'download-pdf', label: 'Download Latest Report', icon: '📄', isAction: true }
    ]
  },
  {
    title: 'Account',
    items: [
      { key: 'account-profile', label: 'Profile & Preferences', icon: '👤', href: '/profile.html' },
      { key: 'account-security', label: 'Security', icon: '🔒', href: '#', disabled: true, badge: 'Soon' },
      { key: 'account-logout', label: 'Sign Out', icon: '🚪', isLogout: true }
    ]
  }
];

/**
 * Renders the responsive sidebar into the designated element
 * @param {Object} options
 * @param {string} options.activeKey - The key corresponding to the currently active page/item
 * @param {string} [options.containerSelector] - Selector for the sidebar element (default: 'aside.sidebar')
 */
export function renderAppSidebar({ activeKey, containerSelector = 'aside.sidebar' }) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const html = SECTIONS.map(sec => {
    const itemsHtml = sec.items.map(item => {
      const isActive = item.key === activeKey;
      const badgeHtml = item.badge
        ? `<span class="sidebar-badge sidebar-badge-soon">${esc(item.badge)}</span>`
        : '';

      if (item.disabled) {
        return `
          <li>
            <a href="#" class="disabled" tabindex="-1" aria-disabled="true">
              <span class="sidebar-nav-label-wrap">
                <span class="sidebar-icon">${item.icon}</span>
                <span>${esc(item.label)}</span>
              </span>
              ${badgeHtml}
            </a>
          </li>
        `;
      }

      if (item.isLogout) {
        return `
          <li>
            <button type="button" class="sidebar-action-btn" id="sidebar-logout-btn">
              <span class="sidebar-nav-label-wrap">
                <span class="sidebar-icon">${item.icon}</span>
                <span>${esc(item.label)}</span>
              </span>
            </button>
          </li>
        `;
      }

      if (item.isAction) {
        return `
          <li>
            <button type="button" class="sidebar-action-btn" id="sidebar-download-pdf-btn">
              <span class="sidebar-nav-label-wrap">
                <span class="sidebar-icon">${item.icon}</span>
                <span>${esc(item.label)}</span>
              </span>
            </button>
          </li>
        `;
      }

      return `
        <li>
          <a href="${esc(item.href)}" class="${isActive ? 'active' : ''}">
            <span class="sidebar-nav-label-wrap">
              <span class="sidebar-icon">${item.icon}</span>
              <span>${esc(item.label)}</span>
            </span>
            ${badgeHtml}
          </a>
        </li>
      `;
    }).join('');

    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">${esc(sec.title)}</div>
        <ul class="sidebar-nav">${itemsHtml}</ul>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Bind actions
  const logoutBtn = container.querySelector('#sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  const pdfBtn = container.querySelector('#sidebar-download-pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', async () => {
      pdfBtn.disabled = true;
      const originalText = pdfBtn.innerHTML;
      pdfBtn.innerHTML = `
        <span class="sidebar-nav-label-wrap">
          <span class="sidebar-icon">⏳</span>
          <span>Preparing PDF…</span>
        </span>
      `;
      try {
        const history = await api.analysis.history();
        if (!history || history.length === 0) {
          toast('No financial plan found. Run an analysis first.', 'info');
          return;
        }
        const latestId = history[0].id;
        window.open(api.report.pdfUrl(latestId), '_blank');
      } catch (e) {
        toast(e.message || 'Failed to download PDF report.', 'error');
      } finally {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalText;
      }
    });
  }
}
