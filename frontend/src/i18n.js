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
        fallbackLng: 'pt-BR',
        debug: true,

        interpolation: {
            escapeValue: false,
        }
    });

export default i18n;
