import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes, FaSearch, FaUserPlus, FaUserCheck, FaSpinner } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserFollowers, getUserFollowing, followUser, unfollowUser } from '../services/api';
import { useTranslation } from 'react-i18next';

const FollowersModal = ({ isOpen, onClose, userId, initialTab = 'followers', currentUserId }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [followLoading, setFollowLoading] = useState(null); // userId being toggled

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setSearchQuery('');
            fetchData();
        }
    }, [isOpen, userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [followersRes, followingRes] = await Promise.all([
                getUserFollowers(userId),
                getUserFollowing(userId)
            ]);
            setFollowers(followersRes.data);
            setFollowing(followingRes.data);
        } catch (error) {
            console.error('Error fetching followers/following:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (targetUserId, isCurrentlyFollowing) => {
        setFollowLoading(targetUserId);
        try {
            if (isCurrentlyFollowing) {
                await unfollowUser(targetUserId);
            } else {
                await followUser(targetUserId);
            }
            // Update local state
            const updateList = (list) =>
                list.map(u => u.id_usuario === targetUserId
                    ? { ...u, is_following: !isCurrentlyFollowing }
                    : u
                );
            setFollowers(prev => updateList(prev));
            setFollowing(prev => updateList(prev));
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            setFollowLoading(null);
        }
    };

    const currentList = activeTab === 'followers' ? followers : following;
    const filteredList = currentList.filter(u =>
        u.nome_usuario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.nome_completo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="relative w-full max-w-md bg-white dark:bg-[#1a163a] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-3">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('connections.title')}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 dark:border-white/10 px-6">
                            <button
                                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${activeTab === 'followers'
                                        ? 'text-purple-500'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                onClick={() => setActiveTab('followers')}
                            >
                                {t('connections.tabFollowers')}
                                {activeTab === 'followers' && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-purple-500 rounded-full"
                                    />
                                )}
                            </button>
                            <button
                                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${activeTab === 'following'
                                        ? 'text-purple-500'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                onClick={() => setActiveTab('following')}
                            >
                                {t('connections.tabFollowing')}
                                {activeTab === 'following' && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-purple-500 rounded-full"
                                    />
                                )}
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-3">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                                <input
                                    type="text"
                                    placeholder={t('connections.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* User List */}
                        <div className="px-6 pb-6 max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
                                </div>
                            ) : filteredList.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {searchQuery
                                            ? t('connections.noResults')
                                            : activeTab === 'followers'
                                                ? t('connections.noFollowers')
                                                : t('connections.noFollowing')
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {filteredList.map(user => (
                                        <div
                                            key={user.id_usuario}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <Link
                                                to={`/user/${user.id_usuario}`}
                                                onClick={onClose}
                                                className="flex-shrink-0"
                                            >
                                                <img
                                                    src={user.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                                    alt={user.nome_usuario}
                                                    className="w-11 h-11 rounded-full object-cover border-2 border-gray-200 dark:border-white/10"
                                                />
                                            </Link>
                                            <Link
                                                to={`/user/${user.id_usuario}`}
                                                onClick={onClose}
                                                className="flex-1 min-w-0"
                                            >
                                                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate hover:text-purple-500 transition-colors">
                                                    {user.nome_completo}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    @{user.nome_usuario}
                                                </p>
                                            </Link>
                                            {user.id_usuario !== currentUserId && (
                                                <button
                                                    onClick={() => handleFollowToggle(user.id_usuario, user.is_following)}
                                                    disabled={followLoading === user.id_usuario}
                                                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${user.is_following
                                                            ? 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                                                            : 'bg-purple-500 text-white hover:bg-purple-600'
                                                        } ${followLoading === user.id_usuario ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {followLoading === user.id_usuario ? (
                                                        <FaSpinner className="animate-spin" size={12} />
                                                    ) : user.is_following ? (
                                                        <>
                                                            <FaUserCheck size={12} />
                                                            {t('connections.btnFollowing')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaUserPlus size={12} />
                                                            {t('connections.btnFollow')}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FollowersModal;
