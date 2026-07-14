import { settings } from './settings.svelte';

/** Minimal reactive i18n for the admin portal (English + Marathi).
 *
 * `t(key)` reads `settings.lang` (a rune) at call time, so any `t(...)` used in
 * a template re-runs when the language changes. No external i18n dependency —
 * the portal only ships `zod`. */

type Dict = Record<string, string>;

const en: Dict = {
  'brand.subtitle': 'Drycleaners & Laundry',
  'nav.dashboard': 'Dashboard',
  'nav.orders': 'Orders',
  'nav.newOrder': 'New Order',
  'nav.customers': 'Customers',
  'nav.settings': 'Settings',
  'action.signOut': 'Sign out',

  'dashboard.title': 'Dashboard',
  'dashboard.totalOrders': 'Total orders',
  'dashboard.showing': 'Showing',
  'dashboard.recentSuffix': 'recent',
  'dashboard.newOrder': '+ New Order',
  'dashboard.recentOrders': 'Recent orders',
  'dashboard.noOrders': 'No orders yet.',
  'table.code': 'Code',
  'table.customer': 'Customer',
  'table.service': 'Service',
  'table.total': 'Total',
  'table.status': 'Status',
  'action.open': 'Open →',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.accent': 'Accent color',
  'settings.background': 'Background',
  'settings.font': 'Font',
  'settings.cornerStyle': 'Corner style',
  'settings.borderSoft': 'Soft',
  'settings.borderSharp': 'Sharp',
  'settings.borderPill': 'Pill',
  'settings.textSize': 'Text size',
  'settings.preview': 'The quick brown fox jumps over the lazy dog.',
  'settings.language': 'Language',
  'settings.reset': 'Reset to defaults',
  'settings.savedNote': 'Changes are saved to this browser automatically.',
  'lang.english': 'English',
  'lang.marathi': 'मराठी',
  'accent.blue': 'Blue',
  'accent.teal': 'Teal',
  'accent.green': 'Green',
  'accent.purple': 'Purple',
  'accent.orange': 'Orange',
  'accent.pink': 'Pink',
};

const mr: Dict = {
  'brand.subtitle': 'ड्रायक्लीनर्स आणि लाँड्री',
  'nav.dashboard': 'डॅशबोर्ड',
  'nav.orders': 'ऑर्डर्स',
  'nav.newOrder': 'नवीन ऑर्डर',
  'nav.customers': 'ग्राहक',
  'nav.settings': 'सेटिंग्ज',
  'action.signOut': 'साइन आउट',

  'dashboard.title': 'डॅशबोर्ड',
  'dashboard.totalOrders': 'एकूण ऑर्डर्स',
  'dashboard.showing': 'दाखवत आहे',
  'dashboard.recentSuffix': 'अलीकडील',
  'dashboard.newOrder': '+ नवीन ऑर्डर',
  'dashboard.recentOrders': 'अलीकडील ऑर्डर्स',
  'dashboard.noOrders': 'अद्याप ऑर्डर नाही.',
  'table.code': 'कोड',
  'table.customer': 'ग्राहक',
  'table.service': 'सेवा',
  'table.total': 'एकूण',
  'table.status': 'स्थिती',
  'action.open': 'उघडा →',

  'settings.title': 'सेटिंग्ज',
  'settings.appearance': 'स्वरूप',
  'settings.theme': 'थीम',
  'settings.system': 'सिस्टम',
  'settings.light': 'उजळ',
  'settings.dark': 'गडद',
  'settings.accent': 'अ‍ॅक्सेंट रंग',
  'settings.background': 'पार्श्वभूमी',
  'settings.font': 'फॉन्ट',
  'settings.cornerStyle': 'कोपरा शैली',
  'settings.borderSoft': 'मऊ',
  'settings.borderSharp': 'तीक्ष्ण',
  'settings.borderPill': 'पिल',
  'settings.textSize': 'मजकूर आकार',
  'settings.preview': 'नमुना मजकूर असा दिसतो.',
  'settings.language': 'भाषा',
  'settings.reset': 'डीफॉल्टवर रीसेट करा',
  'settings.savedNote': 'बदल आपोआप या ब्राउझरमध्ये जतन होतात.',
  'lang.english': 'English',
  'lang.marathi': 'मराठी',
  'accent.blue': 'निळा',
  'accent.teal': 'टील',
  'accent.green': 'हिरवा',
  'accent.purple': 'जांभळा',
  'accent.orange': 'केशरी',
  'accent.pink': 'गुलाबी',
};

const dicts: Record<string, Dict> = { en, mr };

export function t(key: string): string {
  const d = dicts[settings.lang] ?? en;
  return d[key] ?? en[key] ?? key;
}
