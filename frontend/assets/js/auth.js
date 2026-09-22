/**
 * auth.js — Authentication utilities
 */
import { api, ApiError } from '/assets/js/api.js';

/** Redirect to /index.html if the user is not authenticated */
export async function requireAuth() {
  try {
    const data = await api.auth.me();
    return data?.user || data;
  } catch (e) {
    window.location.href = '/index.html';
    return null;
  }
}

/** Redirect to /dashboard.html if already authenticated */
export async function requireGuest() {
  try {
    await api.auth.me();
    window.location.href = '/dashboard.html';
  } catch {
    // Not logged in — stay on page
  }
}

export async function logout() {
  try { await api.auth.logout(); } catch {}
  // Clear any user-scoped browser storage
  try { sessionStorage.clear(); } catch {}
  // Only remove keys this app might have set; leave unrelated data untouched
  try {
    const keysToRemove = Object.keys(localStorage).filter(k =>
      k.startsWith('financial_guidance:') || k.startsWith('fg:')
    );
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
  window.location.href = '/index.html';
}

/**
 * Populate the navbar user chip if #user-chip element exists
 */
export function renderUserChip(user) {
  const el = document.getElementById('user-chip');
  if (!el || !user) return;
  const u = user.user || user;
  const name = u.name || u.profile?.full_name || u.profile?.fullName;
  const email = u.email || '';
  if (name && typeof name === 'string') {
    el.textContent = name.split(' ')[0];
  } else if (email && typeof email === 'string') {
    el.textContent = email.split('@')[0];
  } else {
    el.textContent = '';
  }
}
