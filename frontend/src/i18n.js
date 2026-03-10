import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationPT from './locales/pt-BR/translation.json';
import translationEN from './locales/en/translation.json';

const resources = {
    'pt-BR': { translation: translationPT },
    'en': { translation: translationEN }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        supportedLngs: ['pt-BR', 'en'],
        debug: false,

        detection: {
            // Order: check localStorage first (user preference), then browser language
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
            // Map "pt", "pt-BR", "pt-PT" etc. to "pt-BR"
            convertDetectedLanguage: (lng) => {
                if (lng.startsWith('pt')) return 'pt-BR';
                return lng;
            },
        },

        interpolation: {
            escapeValue: false,
        }
    });

export default i18n;
