import 'i18next';

import type tr from '@/core/i18n/tr.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof tr };
    returnNull: false;
  }
}
