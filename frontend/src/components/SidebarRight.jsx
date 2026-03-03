import React from 'react';
import { FaCloud, FaFeather } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import SuggestionsCard from './SuggestionsCard';

const SidebarRight = () => {
    const { t } = useTranslation();
    const insights = [
        { title: t('sidebarRight.flyTitle'), desc: t('sidebarRight.flyDesc'), icon: FaCloud },
        { title: t('sidebarRight.fallTitle'), desc: t('sidebarRight.fallDesc'), icon: FaFeather },
    ];

    return (
        <aside className="hidden lg:flex flex-col w-[320px] fixed right-0 top-[60px] bottom-0 bg-background-main dark:bg-transparent p-5 overflow-y-auto transition-colors duration-300">
            {/* Suggestions Card — shared component */}
            <div className="mb-6">
                <SuggestionsCard variant="sidebar" maxUsers={5} />
            </div>

            {/* Insights Card */}
            <div className="bg-white dark:bg-cosmic-card dark:border dark:border-white/5 rounded-xl p-5 shadow-card transition-colors duration-300">
                <h3 className="text-text-main dark:text-white font-bold text-sm mb-4">{t('sidebarRight.insightsTitle')}</h3>
                <div className="flex flex-col gap-6">
                    {insights.map((item, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-text-main dark:text-white font-bold text-sm">
                                <item.icon className="text-primary" />
                                {item.title}
                            </div>
                            <p className="text-xs text-text-secondary dark:text-gray-400 leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};

export default SidebarRight;
