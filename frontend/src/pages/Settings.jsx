import React, { useState, useEffect, useCallback } from 'react';
import { FaCog, FaBell, FaLock, FaPalette, FaUser, FaSave, FaArrowLeft, FaShieldAlt, FaStar, FaSearch, FaUserFriends, FaFire } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProfile, getUserSettings, updateUserSettings, getCloseFriendsManage, toggleCloseFriend, patchUser } from '../services/api';

const Settings = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('general');
    const { t, i18n } = useTranslation();

    // Close Friends state
    const [followers, setFollowers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingFollowers, setLoadingFollowers] = useState(false);

    // Settings state - mapped from backend ConfiguracaoUsuario
    const [settings, setSettings] = useState({
        // Notifications
        notificacoes_novas_publicacoes: true,
        notificacoes_comentarios: true,
        notificacoes_seguidor_novo: true,
        notificacoes_reacoes: true,
        notificacoes_mensagens_diretas: true,
        // Appearance
        tema_interface: 2, // 1=Light, 2=Dark, 3=System
        idioma: i18n.language || 'pt-BR',
        mostrar_feed_algoritmico: true,
    });

    // Fetch current user profile
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await getProfile();
                setCurrentUser(response.data);
            } catch (err) {
                console.error('Error fetching user profile:', err);
            }
        };
        fetchUser();
    }, []);

    // Fetch settings from API
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const response = await getUserSettings();
                setSettings(prev => ({ ...prev, ...response.data }));
                // Update i18n instance if backend language matches one of the options
                if (response.data.idioma && (response.data.idioma === 'pt-BR' || response.data.idioma === 'en')) {
                    i18n.changeLanguage(response.data.idioma);
                }
                // Sync theme from backend to localStorage on load
                if (response.data.tema_interface) {
                    const themeMap = { 1: 'light', 2: 'dark', 3: 'system' };
                    const backendTheme = themeMap[response.data.tema_interface] || 'dark';
                    localStorage.setItem('theme', backendTheme);
                }
            } catch (err) {
                console.error('Error fetching settings:', err);
                setError(t('settings.errorLoad'));
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Fetch followers for Close Friends management
    const fetchFollowers = useCallback(async () => {
        try {
            setLoadingFollowers(true);
            const response = await getCloseFriendsManage();
            setFollowers(response.data);
        } catch (err) {
            console.error('Error fetching followers:', err);
        } finally {
            setLoadingFollowers(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'closefriends') {
            fetchFollowers();
        }
    }, [activeTab, fetchFollowers]);

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        if (key === 'idioma') {
            i18n.changeLanguage(value);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await updateUserSettings(settings);

            // Sync theme with localStorage and apply immediately
            // tema_interface: 1=Light, 2=Dark, 3=System
            const themeMap = { 1: 'light', 2: 'dark', 3: 'system' };
            const newTheme = themeMap[settings.tema_interface] || 'dark';
            localStorage.setItem('theme', newTheme);

            // Apply theme to document
            const root = document.documentElement;
            if (newTheme === 'dark') {
                root.classList.add('dark');
            } else if (newTheme === 'light') {
                root.classList.remove('dark');
            } else {
                // System preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }
            }

            setSuccess(t('settings.successSave'));
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
            setError(t('settings.errorSave'));
            setTimeout(() => setError(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    // Toggle close friend status with optimistic UI
    const handleToggleCloseFriend = async (userId) => {
        // Optimistic update
        setFollowers(prev => prev.map(f =>
            f.id_usuario === userId
                ? { ...f, is_close_friend: !f.is_close_friend }
                : f
        ));

        try {
            await toggleCloseFriend(userId);
        } catch (err) {
            // Revert on error
            setFollowers(prev => prev.map(f =>
                f.id_usuario === userId
                    ? { ...f, is_close_friend: !f.is_close_friend }
                    : f
            ));
            console.error('Error toggling close friend:', err);
        }
    };

    // Handle Privacy Toggle
    const handlePrivacyChange = async () => {
        if (!currentUser) return;

        const isPrivate = currentUser.privacidade_padrao === 2;
        const newStatus = isPrivate ? 1 : 2; // 1 = Public, 2 = Private

        // Optimistic update
        setCurrentUser(prev => ({ ...prev, privacidade_padrao: newStatus }));

        try {
            await patchUser(currentUser.id_usuario, { privacidade_padrao: newStatus });
            setSuccess(t('settings.privacySuccess', { status: newStatus === 2 ? t('settings.statusPrivate') : t('settings.statusPublic') }));
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error updating privacy:', err);
            setError(t('settings.privacyError'));
            // Revert
            setCurrentUser(prev => ({ ...prev, privacidade_padrao: isPrivate ? 2 : 1 }));
            setTimeout(() => setError(''), 3000);
        }
    };

    // Filter followers by search query
    const filteredFollowers = followers.filter(f =>
        f.nome_usuario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.nome_completo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const ToggleSwitch = ({ enabled, onToggle }) => (
        <button
            onClick={onToggle}
            className={`flex-shrink-0 relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
            <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'left-7' : 'left-1'}`}
            />
        </button>
    );

    const SettingRow = ({ icon: Icon, label, description, children }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                    <Icon className="text-primary" />
                </div>
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{label}</h3>
                    {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
            </div>
            {children}
        </div>
    );

    const TabButton = ({ id, icon: Icon, label, active }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${active
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
        >
            <Icon />
            {label}
        </button>
    );

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <FaArrowLeft className="text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <FaCog className="text-primary" />
                    {t('settings.title')}
                </h1>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-3 mb-6">
                <TabButton id="general" icon={FaCog} label={t('settings.tabGeneral')} active={activeTab === 'general'} />
                <TabButton id="closefriends" icon={FaUserFriends} label={t('settings.tabCloseFriends')} active={activeTab === 'closefriends'} />
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="mb-6 p-4 bg-green-900/30 text-green-300 rounded-lg border border-green-500/30">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-6 p-4 bg-red-900/30 text-red-300 rounded-lg border border-red-500/30">
                    {error}
                </div>
            )}

            {/* General Settings Tab */}
            {activeTab === 'general' && (
                <>
                    {/* Notifications Section */}
                    <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FaBell className="text-primary" />
                            {t('settings.notifications')}
                        </h2>

                        <SettingRow icon={FaUser} label={t('settings.notifFollowers')} description={t('settings.notifFollowersDesc')}>
                            <ToggleSwitch enabled={settings.notificacoes_seguidor_novo} onToggle={() => handleToggle('notificacoes_seguidor_novo')} />
                        </SettingRow>

                        <SettingRow icon={FaBell} label={t('settings.notifComments')} description={t('settings.notifCommentsDesc')}>
                            <ToggleSwitch enabled={settings.notificacoes_comentarios} onToggle={() => handleToggle('notificacoes_comentarios')} />
                        </SettingRow>

                        <SettingRow icon={FaBell} label={t('settings.notifLikes')} description={t('settings.notifLikesDesc')}>
                            <ToggleSwitch enabled={settings.notificacoes_reacoes} onToggle={() => handleToggle('notificacoes_reacoes')} />
                        </SettingRow>

                        <SettingRow icon={FaBell} label={t('settings.notifMessages')} description={t('settings.notifMessagesDesc')}>
                            <ToggleSwitch enabled={settings.notificacoes_mensagens_diretas} onToggle={() => handleToggle('notificacoes_mensagens_diretas')} />
                        </SettingRow>

                        <SettingRow icon={FaBell} label={t('settings.notifPosts')} description={t('settings.notifPostsDesc')}>
                            <ToggleSwitch enabled={settings.notificacoes_novas_publicacoes} onToggle={() => handleToggle('notificacoes_novas_publicacoes')} />
                        </SettingRow>
                    </div>

                    {/* Privacy Section */}
                    <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FaLock className="text-primary" />
                            {t('settings.privacy')}
                        </h2>

                        <SettingRow
                            icon={FaLock}
                            label={t('settings.privAccount')}
                            description={t('settings.privAccountDesc')}
                        >
                            <ToggleSwitch
                                enabled={currentUser?.privacidade_padrao === 2}
                                onToggle={handlePrivacyChange}
                            />
                        </SettingRow>

                    </div>

                    {/* Appearance Section */}
                    <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FaPalette className="text-primary" />
                            {t('settings.appearance')}
                        </h2>

                        <SettingRow icon={FaPalette} label={t('settings.theme')} description={t('settings.themeDesc')}>
                            <select
                                value={settings.tema_interface}
                                onChange={(e) => handleSelectChange('tema_interface', parseInt(e.target.value))}
                                className="bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                            >
                                <option value={2}>{t('settings.themeDark')}</option>
                                <option value={1}>{t('settings.themeLight')}</option>
                                <option value={3}>{t('settings.themeSystem')}</option>
                            </select>
                        </SettingRow>

                        <SettingRow icon={FaPalette} label={t('settings.language')} description={t('settings.languageDesc')}>
                            <select
                                value={i18n.language || settings.idioma}
                                onChange={(e) => handleSelectChange('idioma', e.target.value)}
                                className="bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary"
                            >
                                <option value="pt-BR">Português (BR)</option>
                                <option value="en">English</option>
                            </select>
                        </SettingRow>
                    </div>

                    {/* Feed Content Section */}
                    <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FaFire className="text-primary" />
                            {t('settings.feed')}
                        </h2>

                        <SettingRow
                            icon={FaFire}
                            label={t('settings.feedForYou')}
                            description={t('settings.feedForYouDesc')}
                        >
                            <ToggleSwitch
                                enabled={settings.mostrar_feed_algoritmico}
                                onToggle={() => handleToggle('mostrar_feed_algoritmico')}
                            />
                        </SettingRow>
                    </div>

                    {/* Admin Section - Only visible for admins */}
                    {currentUser?.is_admin && (
                        <div className="bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm rounded-2xl p-6 mb-6">
                            <h2 className="text-lg font-semibold text-amber-500 mb-4 flex items-center gap-2">
                                <FaShieldAlt />
                                {t('settings.adminTitle')}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">
                                {t('settings.adminDesc')}
                            </p>
                            <button
                                onClick={() => navigate('/admin')}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold rounded-xl hover:opacity-90 transition-all"
                            >
                                <FaShieldAlt />
                                {t('settings.btnAdmin')}
                            </button>
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                {t('settings.saving')}
                            </>
                        ) : (
                            <>
                                <FaSave />
                                {t('settings.btnSave')}
                            </>
                        )}
                    </button>
                </>
            )}

            {/* Close Friends Tab */}
            {activeTab === 'closefriends' && (
                <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <FaStar className="text-amber-400" />
                        {t('settings.cfTitle')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        {t('settings.cfDesc')}
                    </p>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('settings.cfSearchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>

                    {/* Followers List */}
                    {loadingFollowers ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : filteredFollowers.length === 0 ? (
                        <div className="text-center py-10">
                            <FaUserFriends className="text-4xl text-gray-500 mx-auto mb-3" />
                            <p className="text-gray-400">
                                {followers.length === 0
                                    ? t('settings.cfNoFollowers')
                                    : t('settings.cfNotFound')
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredFollowers.map((follower) => (
                                <div
                                    key={follower.id_usuario}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
                                            {follower.avatar_url ? (
                                                <img
                                                    src={follower.avatar_url}
                                                    alt={follower.nome_usuario}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-white font-bold text-lg">
                                                    {follower.nome_usuario.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* User Info */}
                                        <div>
                                            <h3 className="font-medium text-white">
                                                {follower.nome_completo}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                @{follower.nome_usuario}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Star Toggle Button */}
                                    <button
                                        onClick={() => handleToggleCloseFriend(follower.id_usuario)}
                                        className={`p-3 rounded-xl transition-all transform hover:scale-110 ${follower.is_close_friend
                                            ? 'bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                                            }`}
                                        title={follower.is_close_friend ? t('settings.cfRemoveTooltip') : t('settings.cfAddTooltip')}
                                    >
                                        <FaStar className={`text-xl ${follower.is_close_friend ? 'fill-current' : ''}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Close Friends Counter */}
                    {followers.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-white/10 text-center">
                            <span className="text-gray-400">
                                <span className="text-amber-400 font-bold">
                                    {followers.filter(f => f.is_close_friend).length}
                                </span>
                                {' '}{t('settings.cfSelectedCount')}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Settings;
