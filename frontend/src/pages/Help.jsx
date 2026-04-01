import React from 'react';
import { useTranslation } from 'react-i18next';

const Help = () => {
    const { t } = useTranslation();

    const topics = t('legal.help.topics', { returnObjects: true });

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="bg-white dark:bg-[#1a1b1e] rounded-2xl p-6 md:p-8 shadow-card">
                <h1 className="text-3xl font-bold text-text-main dark:text-white mb-4">{t('legal.help.title')}</h1>
                <p className="text-text-secondary dark:text-gray-300 leading-relaxed mb-6">{t('legal.help.intro')}</p>

                <div className="space-y-6">
                    {topics.map((topic, index) => (
                        <section key={`${topic.heading}-${index}`}>
                            <h2 className="text-xl font-semibold text-text-main dark:text-white mb-2">{topic.heading}</h2>
                            <p className="text-text-secondary dark:text-gray-300 leading-relaxed">{topic.body}</p>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Help;
