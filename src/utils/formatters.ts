/**
 * Indian Localization and Business Formatters
 */

// Formats currency as Indian Rupee (INR - ₹) with standard Indian comma grouping (e.g. ₹1,00,000.00)
export function formatINR(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '₹0.00';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Compact currency formatting for charts/cards (e.g., ₹1.5L or ₹2.4Cr)
export function formatINRCompact(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '₹0';

  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  if (Math.abs(num) >= 1000) {
    return `₹${(num / 1000).toFixed(1)} K`;
  }
  return formatINR(num);
}

// Formats date into DD/MM/YYYY in Asia/Kolkata timezone
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).format(date);
  } catch {
    return '—';
  }
}

// Formats date & time into DD/MM/YYYY, hh:mm A in Asia/Kolkata timezone
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }).format(date);
  } catch {
    return '—';
  }
}

// Formats Indian mobile number: +91 XXXXX XXXXX or standardizes 10-digit number
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

// Validates 6-digit Indian PIN code
export function isValidPinCode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin.trim());
}

// Validates 10-digit Indian Mobile Number
export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return (digits.length === 10 && /^[6-9]/.test(digits)) || 
         (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2)));
}

// List of Indian States and Union Territories for select dropdowns
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];
