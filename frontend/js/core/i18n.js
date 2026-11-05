// i18n runtime: store + translator; dictionaries live in i18n-en.js / i18n-es.js

const TRANSLATIONS = {
  en: I18N_EN,
  es: I18N_ES,
};

window.__t = (key, fallback) => {
  try { return Alpine.store('i18n').t(key); } catch(e) { return fallback || key; }
};

function registerI18nStore() {
  Alpine.store('i18n', {
    lang: localStorage.getItem('lang') || 'en',

    t(key) {
      const map = TRANSLATIONS[this.lang] || TRANSLATIONS.en;
      return map[key] || TRANSLATIONS.en[key] || key;
    },

    toggle() {
      this.lang = this.lang === 'en' ? 'es' : 'en';
      localStorage.setItem('lang', this.lang);
      document.documentElement.lang = this.lang;
    },

    init() {
      document.documentElement.lang = this.lang;
    },
  });
}

if (window.Alpine) {
  registerI18nStore();
} else {
  document.addEventListener('alpine:init', registerI18nStore);
}
