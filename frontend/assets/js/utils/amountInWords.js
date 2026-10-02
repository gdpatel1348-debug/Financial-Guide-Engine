/**
 * amountInWords.js
 * 
 * Utility to convert integer rupee amounts to Indian Numbering System words
 * (Thousand -> Lakh -> Crore) and automatically wire live "Amount in Words"
 * confirmation lines under ₹ currency inputs across the application.
 */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertBelowThousand(n) {
  let str = '';

  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) str += ' ';
  }

  if (n >= 20) {
    const tensPart = TENS[Math.floor(n / 10)];
    const onesPart = ONES[n % 10];
    str += onesPart ? `${tensPart}-${onesPart}` : tensPart;
  } else if (n >= 10) {
    str += TEENS[n - 10];
  } else if (n > 0) {
    str += ONES[n];
  }

  return str;
}

function numberToIndianWordsBase(num) {
  if (num <= 0) return '';
  const parts = [];

  const hundreds = num % 1000;
  num = Math.floor(num / 1000);

  const thousands = num % 100;
  num = Math.floor(num / 100);

  const lakhs = num % 100;
  num = Math.floor(num / 100);

  const crores = num;

  if (crores > 0) {
    parts.push(numberToIndianWordsBase(crores) + ' Crore');
  }
  if (lakhs > 0) {
    parts.push(convertBelowThousand(lakhs) + ' Lakh');
  }
  if (thousands > 0) {
    parts.push(convertBelowThousand(thousands) + ' Thousand');
  }
  if (hundreds > 0) {
    parts.push(convertBelowThousand(hundreds));
  }

  return parts.join(' ').trim();
}

/**
 * Pure function: Converts rupee amount to words in Indian numbering system
 * @param {number|string} amount 
 * @returns {string} e.g. "Twenty-Five Thousand Rupees Only"
 */
export function numberToIndianWords(amount) {
  if (amount === null || amount === undefined || amount === '') return '';

  const rawNum = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(rawNum) || !isFinite(rawNum)) return '';

  const rounded = Math.round(rawNum);
  if (rounded <= 0) return '';

  const words = numberToIndianWordsBase(rounded);
  return words ? `${words} Rupees Only` : '';
}

/**
 * Debounce helper for live updates
 */
function debounce(fn, delay = 150) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Updates or creates the amount-in-words line for a single input element
 * @param {HTMLInputElement} inputEl 
 */
export function updateWordsForInput(inputEl) {
  if (!inputEl) return;

  // Find or create associated .amount-in-words display span/div
  let displayEl = inputEl.parentNode ? inputEl.parentNode.querySelector('.amount-in-words') : null;

  // If input is inside .input-prefix-wrap, check container parent (.form-group)
  if (!displayEl && inputEl.closest('.form-group')) {
    displayEl = inputEl.closest('.form-group').querySelector('.amount-in-words');
  }

  if (!displayEl) {
    displayEl = document.createElement('div');
    displayEl.className = 'amount-in-words';
    displayEl.setAttribute('aria-live', 'polite');

    // Insert after input-prefix-wrap or input
    const wrap = inputEl.closest('.input-prefix-wrap') || inputEl;
    if (wrap.parentNode) {
      wrap.parentNode.insertBefore(displayEl, wrap.nextSibling);
    }
  }

  const text = numberToIndianWords(inputEl.value);
  if (text) {
    displayEl.textContent = text;
    displayEl.style.display = 'block';
  } else {
    displayEl.textContent = '';
    displayEl.style.display = 'none';
  }
}

/**
 * Centrally attaches "Amount in Words" listeners to all tagged currency inputs
 * @param {HTMLElement|Document} root 
 */
export function attachAmountInWords(root = document) {
  const selector = 'input[data-amount-words="true"], input.currency-input, input[data-currency="true"]';
  const inputs = root.querySelectorAll(selector);

  inputs.forEach(inputEl => {
    // Avoid double listener attachment
    if (inputEl.dataset.wordsAttached === 'true') {
      updateWordsForInput(inputEl);
      return;
    }
    inputEl.dataset.wordsAttached = 'true';

    const handler = debounce(() => updateWordsForInput(inputEl), 150);

    inputEl.addEventListener('input', handler);
    inputEl.addEventListener('change', handler);

    // Initial update if input already has a pre-filled value
    updateWordsForInput(inputEl);
  });
}

// Auto-run on DOMContentLoaded if loaded in a browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => attachAmountInWords());
  } else {
    attachAmountInWords();
  }

  // Also set up a MutationObserver to automatically catch dynamically added ₹ inputs (e.g. list forms)
  try {
    const observer = new MutationObserver(debounce(() => {
      attachAmountInWords();
    }, 200));

    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
}
