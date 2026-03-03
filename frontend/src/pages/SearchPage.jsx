import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaSearch, FaUser, FaHashtag, FaMoon } from 'react-icons/fa';
import DreamCard from '../components/DreamCard';
import { search } from '../services/api';
import { useTranslation } from 'react-i18next';

const SearchPage = () => {
    const { t } = useTranslation();
    const [results, setResults] = useState({ posts: [], users: [], hashtags: [] });
    const [counts, setCounts] = useState({ posts: 0, users: 0, hashtags: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, posts, users, hashtags

    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const query = queryParams.get('q');

    useEffect(() => {
        if (query) {
            fetchResults();
        } else {
            setLoading(false);
        }
    }, [query]);

    const fetchResults = async () => {
        setLoading(true);
        try {
            const response = await search(query, 'all');
            setResults(response.data.results || { posts: [], users: [], hashtags: [] });
            setCounts(response.data.counts || { posts: 0, users: 0, hashtags: 0 });
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'all', label: t('search.tabAll') },
        { id: 'posts', label: t('search.tabDreams') },
        { id: 'users', label: t('search.tabPeople') },
        { id: 'hashtags', label: t('search.tabHashtags') },
    ];

    if (!query) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-text-secondary dark:text-gray-400">
                <FaSearch size={48} className="mb-4 opacity-50" />
                <h2 className="text-xl font-semibold">{t('search.typeToSearch')}</h2>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <h1 className="text-2xl font-bold mb-6 text-text-primary dark:text-white px-4">
                {t('search.resultsFor', { query })}
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 px-4 mb-6 border-b border-border dark:border-white/10 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 px-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-secondary dark:text-gray-400 hover:text-text-primary dark:hover:text-white'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="px-4 space-y-8">
                    {/* Users Section */}
                    {(activeTab === 'all' || activeTab === 'users') && results.users?.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm border border-border dark:border-white/5"
                        >
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary dark:text-white">
                                <FaUser className="text-secondary" /> {t('search.people')}
                            </h3>
                            <div className="space-y-4">
                                {results.users.map((user) => (
                                    <div key={user.id_usuario} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/user/${user.id_usuario}`)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt={user.nome_usuario} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <FaUser />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-text-primary dark:text-white group-hover:text-primary transition-colors">
                                                    {user.nome_completo}
                                                </p>
                                                <p className="text-sm text-text-secondary dark:text-gray-400">@{user.nome_usuario}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Hashtags Section */}
                    {(activeTab === 'all' || activeTab === 'hashtags') && results.hashtags?.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm border border-border dark:border-white/5"
                        >
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary dark:text-white">
                                <FaHashtag className="text-secondary" /> {t('search.hashtags')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {results.hashtags.map((tag) => (
                                    <button
                                        key={tag.id_hashtag}
                                        onClick={() => navigate(`/search?q=%23${tag.texto_hashtag}`)}
                                        className="px-3 py-1 bg-background dark:bg-white/5 rounded-full text-sm text-primary hover:bg-primary/10 transition-colors"
                                    >
                                        #{tag.texto_hashtag} <span className="text-xs text-gray-500 ml-1">({tag.contagem_uso})</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Posts Section */}
                    {(activeTab === 'all' || activeTab === 'posts') && (
                        <div className="space-y-4">
                            {activeTab !== 'all' && (
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary dark:text-white">
                                    <FaMoon className="text-secondary" /> {t('search.dreams')}
                                </h3>
                            )}
                            {results.posts?.length > 0 ? (
                                results.posts.map((post) => (
                                    <DreamCard key={post.id_publicacao} dream={post} />
                                ))
                            ) : (
                                activeTab === 'posts' && (
                                    <p className="text-center text-text-secondary dark:text-gray-400 py-8">
                                        {t('search.noDreamsFound')}
                                    </p>
                                )
                            )}
                        </div>
                    )}

                    {/* Empty State for All */}
                    {activeTab === 'all' &&
                        !results.users?.length &&
                        !results.hashtags?.length &&
                        !results.posts?.length && (
                            <div className="text-center py-10">
                                <p className="text-lg text-text-secondary dark:text-gray-400">{t('search.nothingFound', { query })}</p>
                            </div>
                        )}
                </div>
            )}
        </div>
    );
};

export default SearchPage;
