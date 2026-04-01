import React from 'react';
import { useTranslation } from 'react-i18next';

const Terms = () => {
    const { t } = useTranslation();

    const sections = t('legal.terms.sections', { returnObjects: true });

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl p-6 md:p-8 shadow-card">
                <h1 className="text-3xl font-bold text-text-main dark:text-white mb-4">{t('legal.terms.title')}</h1>
                <p className="text-text-secondary dark:text-gray-300 leading-relaxed mb-6">{t('legal.terms.intro')}</p>

                <div className="space-y-6">
                    {sections.map((section, index) => (
                        <section key={`${section.heading}-${index}`}>
                            <h2 className="text-xl font-semibold text-text-main dark:text-white mb-2">{section.heading}</h2>
                            <p className="text-text-secondary dark:text-gray-300 leading-relaxed">{section.body}</p>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Terms;
