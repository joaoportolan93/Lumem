import React, { useState, useRef, useEffect } from 'react';
import {
    FaSearch, FaHome, FaBell, FaCog, FaCloud, FaUser, FaEdit,
    FaSignOutAlt, FaBars, FaTimes, FaMoon, FaUserFriends,
    FaBookmark, FaPlus
} from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import { logout, getProfile } from '../services/api';

const Header = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchQuery('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Fetch user profile on mount
    useEffect(() => {
        const fetchProfileAndNotifications = async () => {
            try {
                const profileRes = await getProfile();
                setUser(profileRes.data);

                // Fetch unread notifications to implement red-dot
                const { getNotifications } = await import('../services/api');
                const notifRes = await getNotifications();
                const unread = notifRes.data.filter(n => !n.lida).length;
                setHasUnreadNotifs(unread > 0);
            } catch (error) {
                console.error('Error fetching header data:', error);
            }
        };
        fetchProfileAndNotifications();
    }, []);

    const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Prevent scrolling when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMobileMenuOpen]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        navigate('/login');
    };

    const avatarUrl = user?.avatar_url || 'https://randomuser.me/api/portraits/women/44.jpg';

    return (
        <>
            <header className="fixed top-0 left-0 right-0 h-[60px] bg-white dark:bg-cosmic-bg dark:border-b dark:border-white/10 shadow-sm z-50 flex items-center justify-between px-4 lg:px-6 transition-colors duration-300">

                {/* Logo & Hambúrguer Section */}
                <div className="flex items-center gap-3 w-auto md:w-[250px]">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden text-text-secondary dark:text-gray-300 hover:text-primary transition-colors cursor-pointer"
                    >
                        <FaBars size={22} />
                    </button>

                    <Link to="/" className="flex items-center gap-2">
                        <div className="text-2xl text-primary">
                            <FaCloud />
                        </div>
                        {/* Texto some no mobile muito pequeno para economizar espaço se houver muitos ícones, ou fica */}
                        <span className="text-lg font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent hidden sm:block">
                            Lumem
                        </span>
                    </Link>
                </div>

                {/* Search Bar (Oculta no Mobile) */}
                <div className="hidden md:flex flex-1 max-w-[500px] mx-4">
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('header.searchPlaceholder')}
                            className="w-full h-[40px] bg-background-input dark:bg-white/10 dark:text-white dark:placeholder-gray-400 rounded-full pl-5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                        <button
                            onClick={handleSearch}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary dark:text-gray-400 text-sm hover:text-primary transition-colors"
                        >
                            <FaSearch />
                        </button>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4 sm:gap-5">

                    <Link to="/notifications" className="text-text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-white transition-colors relative">
                        <FaBell size={20} />
                        {hasUnreadNotifs && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-cosmic-bg"></span>
                        )}
                    </Link>

                    <Link to="/settings" className="hidden md:flex text-text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-white transition-colors">
                        <FaCog size={20} />
                    </Link>

                    {/* Profile with Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="w-[35px] h-[35px] rounded-full border-2 border-secondary overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        >
                            <img
                                src={avatarUrl}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg py-2 z-50 border border-gray-200 dark:border-gray-700">
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <p className="font-semibold text-gray-800 dark:text-white truncate">
                                        {user?.nome_completo || 'Usuário'}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        @{user?.nome_usuario || 'username'}
                                    </p>
                                </div>
                                <Link
                                    to="/profile"
                                    className="flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    <FaUser size={16} />
                                    {t('header.profile')}
                                </Link>
                                <Link
                                    to="/edit-profile"
                                    className="flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    onClick={() => setShowDropdown(false)}
                                >
                                    <FaEdit size={16} />
                                    {t('header.editProfile')}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 w-full px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <FaSignOutAlt size={16} />
                                    {t('header.logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ====== MOBILE LATERAL MENU (HAMBURGUER OVERLAY) ====== */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        {/* Fundo Escuro (Overlay) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] md:hidden"
                        />

                        {/* Menu Lateral Deslizante */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                            className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[80vw] bg-white dark:bg-cosmic-bg shadow-2xl z-[90] md:hidden flex flex-col border-r border-border dark:border-white/10"
                        >
                            {/* Cabecalho do Menu Mobile */}
                            <div className="flex items-center justify-between p-5 border-b border-border dark:border-white/10 shrink-0">
                                <div className="flex items-center gap-2">
                                    <FaCloud className="text-2xl text-primary" />
                                    <span className="text-lg font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                                        Lumem
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-text-secondary dark:text-gray-400 hover:text-red-500 transition-colors p-2"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Links de Navagação e Ações */}
                            <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-3">

                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        navigate('/', { state: { openCreateModal: true } });
                                    }}
                                    className="w-full py-3 mb-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-all font-sans"
                                >
                                    <FaPlus />
                                    {t('sidebar.newDream')}
                                </button>

                                <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors font-medium">
                                    <FaHome size={20} /> {t('sidebar.home')}
                                </Link>

                                <Link to="/explore" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors font-medium">
                                    <FaMoon size={20} /> {t('sidebar.explore')}
                                </Link>

                                <Link to="/communities" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors font-medium">
                                    <FaUserFriends size={20} /> {t('sidebar.communities')}
                                </Link>

                                <Link to="/saved" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors font-medium">
                                    <FaBookmark size={20} /> {t('sidebar.saved')}
                                </Link>

                                <div className="border-t border-border dark:border-white/10 my-2"></div>

                                <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary transition-colors font-medium">
                                    <FaCog size={20} /> {t('settings.title')}
                                </Link>

                                <div className="mt-4 px-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-between">
                                    <span className="text-sm font-medium text-text-secondary dark:text-gray-300">{t('header.siteTheme')}</span>
                                    <ThemeToggle />
                                </div>

                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Header;
