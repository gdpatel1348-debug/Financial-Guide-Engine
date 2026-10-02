import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { numberToIndianWords } from '../../../frontend/assets/js/utils/amountInWords.js';

describe('numberToIndianWords Unit Tests', () => {
  test('converts thousands correctly', () => {
    assert.strictEqual(numberToIndianWords(25000), 'Twenty-Five Thousand Rupees Only');
    assert.strictEqual(numberToIndianWords('25000'), 'Twenty-Five Thousand Rupees Only');
    assert.strictEqual(numberToIndianWords(1000), 'One Thousand Rupees Only');
    assert.strictEqual(numberToIndianWords(99999), 'Ninety-Nine Thousand Nine Hundred Ninety-Nine Rupees Only');
  });

  test('converts lakhs correctly with Indian grouping', () => {
    assert.strictEqual(numberToIndianWords(1800000), 'Eighteen Lakh Rupees Only');
    assert.strictEqual(numberToIndianWords(150000), 'One Lakh Fifty Thousand Rupees Only');
    assert.strictEqual(numberToIndianWords(9900000), 'Ninety-Nine Lakh Rupees Only');
  });

  test('converts crores correctly with Indian grouping', () => {
    assert.strictEqual(numberToIndianWords(10000000), 'One Crore Rupees Only');
    assert.strictEqual(numberToIndianWords(15000000), 'One Crore Fifty Lakh Rupees Only');
    assert.strictEqual(
      numberToIndianWords(12345678),
      'One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Rupees Only'
    );
    assert.strictEqual(numberToIndianWords(500000000), 'Fifty Crore Rupees Only');
  });

  test('handles small numbers and hundreds', () => {
    assert.strictEqual(numberToIndianWords(1), 'One Rupees Only');
    assert.strictEqual(numberToIndianWords(50), 'Fifty Rupees Only');
    assert.strictEqual(numberToIndianWords(100), 'One Hundred Rupees Only');
    assert.strictEqual(numberToIndianWords(105), 'One Hundred Five Rupees Only');
  });

  test('returns empty string for zero, empty, negative, and non-numeric inputs', () => {
    assert.strictEqual(numberToIndianWords(0), '');
    assert.strictEqual(numberToIndianWords('0'), '');
    assert.strictEqual(numberToIndianWords(''), '');
    assert.strictEqual(numberToIndianWords(null), '');
    assert.strictEqual(numberToIndianWords(undefined), '');
    assert.strictEqual(numberToIndianWords(-5000), '');
    assert.strictEqual(numberToIndianWords('invalid text'), '');
    assert.strictEqual(numberToIndianWords(NaN), '');
  });
});
