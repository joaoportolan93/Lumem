import React from 'react';
import { useTranslation } from 'react-i18next';

const About = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl p-6 md:p-8 shadow-card">
                <h1 className="text-3xl font-bold text-text-main dark:text-white mb-4">{t('legal.about.title')}</h1>
                <p className="text-text-secondary dark:text-gray-300 leading-relaxed mb-6">{t('legal.about.intro')}</p>

                <div className="space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold text-text-main dark:text-white mb-2">{t('legal.about.missionTitle')}</h2>
                        <p className="text-text-secondary dark:text-gray-300 leading-relaxed">{t('legal.about.missionBody')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-text-main dark:text-white mb-2">{t('legal.about.responsibilityTitle')}</h2>
                        <p className="text-text-secondary dark:text-gray-300 leading-relaxed">{t('legal.about.responsibilityBody')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-text-main dark:text-white mb-2">{t('legal.about.contactTitle')}</h2>
                        <p className="text-text-secondary dark:text-gray-300 leading-relaxed">{t('legal.about.contactBody')}</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default About;
