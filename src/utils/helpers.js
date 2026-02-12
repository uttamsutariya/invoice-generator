export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatCurrency(amount, symbol = '$') {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return `${symbol} ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertHundreds(num) {
  let str = '';
  if (num > 99) {
    str += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num > 19) {
    str += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  if (num > 0) {
    str += ones[num] + ' ';
  }
  return str;
}

export function numberToWords(num) {
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(-num);

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let words = '';

  if (intPart === 0) {
    words = 'Zero';
  } else {
    // Indian numbering: crore, lakh, thousand, hundred
    const crore = Math.floor(intPart / 10000000);
    const lakh = Math.floor((intPart % 10000000) / 100000);
    const thousand = Math.floor((intPart % 100000) / 1000);
    const remainder = intPart % 1000;

    if (crore > 0) words += convertHundreds(crore) + 'Crore ';
    if (lakh > 0) words += convertHundreds(lakh) + 'Lakh ';
    if (thousand > 0) words += convertHundreds(thousand) + 'Thousand ';
    if (remainder > 0) words += convertHundreds(remainder);
  }

  words = words.trim();

  if (decPart > 0) {
    words += ' and ' + convertHundreds(decPart).trim() + ' Paise';
  }

  return words;
}

export function numberToWordsInternational(num, currencyName = 'Dollars') {
  if (num === 0) return `Zero ${currencyName} Only`;

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let words = '';

  const billion = Math.floor(intPart / 1000000000);
  const million = Math.floor((intPart % 1000000000) / 1000000);
  const thousand = Math.floor((intPart % 1000000) / 1000);
  const remainder = intPart % 1000;

  if (billion > 0) words += convertHundreds(billion) + 'Billion ';
  if (million > 0) words += convertHundreds(million) + 'Million ';
  if (thousand > 0) words += convertHundreds(thousand) + 'Thousand ';
  if (remainder > 0) words += convertHundreds(remainder);

  words = words.trim() + ` ${currencyName}`;

  if (decPart > 0) {
    words += ' and ' + convertHundreds(decPart).trim() + ' Cents';
  }

  return words + ' Only';
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollars' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollars' },
  { code: 'EUR', symbol: '€', name: 'Euros' },
  { code: 'GBP', symbol: '£', name: 'British Pounds' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollars' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollars' },
];

export function getCurrencyByCode(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}
