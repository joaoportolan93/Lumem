import React, { useState, useEffect } from 'react';
import { FaHome, FaMoon, FaUserFriends, FaBookmark, FaPlus } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTrends } from '../services/api';

const SidebarLeft = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isActive = (path) => location.pathname === path;

    // State to hold trending hashtags from backend
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    const menuItems = [
        { icon: FaHome, label: t('sidebar.home'), path: '/' },
        { icon: FaMoon, label: t('sidebar.explore'), path: '/explore' },
        { icon: FaUserFriends, label: t('sidebar.communities'), path: '/communities' },
        { icon: FaBookmark, label: t('sidebar.saved'), path: '/saved' },
    ];

    // Fetch trends on component mount
    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const res = await getTrends();
                // We only want the top 4 hashtags for the sidebar
                setTrends(res.data.hashtags.slice(0, 4));
            } catch (err) {
                console.error('Error fetching trends for sidebar:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, []);

    return (
        <aside className="hidden md:flex flex-col w-[250px] fixed left-0 top-[60px] bottom-0 bg-white dark:bg-cosmic-bg dark:border-white/10 p-5 overflow-y-auto border-r border-border transition-colors duration-300">
            {/* Navigation Menu */}
            <nav className="flex flex-col gap-2 mb-6">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive(item.path)
                            ? 'bg-primary-light text-primary dark:bg-white/10 dark:text-primary-light'
                            : 'text-text-secondary dark:text-gray-400 hover:bg-background-input dark:hover:bg-white/5 hover:text-text-main dark:hover:text-white'
                            }`}
                    >
                        <item.icon size={20} className={isActive(item.path) ? 'text-primary' : 'text-gray-400'} />
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* New Dream Button */}
            <button
                onClick={() => navigate('/', { state: { openCreateModal: true } })}
                className="w-full h-[45px] bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-full flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-all transform hover:scale-[1.02] mb-8"
            >
                <FaPlus />
                {t('sidebar.newDream')}
            </button>

            {/* Trends Section */}
            <div>
                <h3 className="text-sm font-bold text-text-main dark:text-white mb-4 px-2">{t('sidebar.trends')}</h3>
                <div className="flex flex-col gap-4 px-2">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : trends.length === 0 ? (
                        <p className="text-xs text-text-secondary dark:text-gray-400">{t('sidebar.noTrends')}</p>
                    ) : (
                        trends.map((trend, index) => (
                            <div key={index} className="flex flex-col cursor-pointer group">
                                <span className="text-accent-blue font-medium text-sm group-hover:underline">
                                    #{trend.texto_hashtag}
                                </span>
                                <span className="text-xs text-text-secondary dark:text-gray-400">
                                    {trend.contagem_uso} {trend.contagem_uso === 1 ? t('sidebar.dreamSingular') : t('sidebar.dreamPlural')}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </aside>
    );
};

export default SidebarLeft;
