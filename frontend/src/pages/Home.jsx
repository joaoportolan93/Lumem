import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMoon, FaPlus, FaUserFriends, FaFire } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DreamCard from '../components/DreamCard';
import CreateDreamModal from '../components/CreateDreamModal';
import { getDreams, getProfile, getUserSettings } from '../services/api';

const Home = () => {
    const { t } = useTranslation();
    const [dreams, setDreams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDream, setEditingDream] = useState(null);
    const [activeTab, setActiveTab] = useState('following');
    const [showAlgorithmicFeed, setShowAlgorithmicFeed] = useState(true);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const sentinelaRef = useRef(null);

    const location = useLocation();
    const navigate = useNavigate();

    // Open create modal if navigated with openCreateModal state (from sidebar button)
    useEffect(() => {
        if (location.state?.openCreateModal) {
            setIsModalOpen(true);
            // Clear the state so it doesn't re-trigger on refresh
            navigate('/', { replace: true, state: {} });
        }
    }, [location.state]);

    const fetchDreams = useCallback(async (tab = activeTab, pageNum = 1, append = false) => {
        if (pageNum === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        setError('');

        try {
            const response = await getDreams(tab, null, pageNum);
            const data = response.data;

            // Suporta tanto resposta paginada do DRF quanto a do algoritmo customizado
            let newDreams = [];
            let moreAvailable = false;

            if (data.results) {
                newDreams = data.results;
                // Paginação do DRF (next != null) ou do algoritmo (has_more)
                moreAvailable = data.has_more !== undefined ? data.has_more : !!data.next;
            } else if (Array.isArray(data)) {
                newDreams = data;
                moreAvailable = false;
            }

            if (append) {
                setDreams(prev => [...prev, ...newDreams]);
            } else {
                setDreams(newDreams);
            }
            setHasMore(moreAvailable);

        } catch (err) {
            console.error('Error fetching dreams:', err);
            if (pageNum === 1) {
                setError(t('home.errorLoading'));
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [activeTab, t]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [profileRes, settingsRes] = await Promise.all([
                    getProfile(),
                    getUserSettings()
                ]);

                setCurrentUserId(profileRes.data.id_usuario);

                const allowForYou = settingsRes.data.mostrar_feed_algoritmico ?? true;
                setShowAlgorithmicFeed(allowForYou);

                if (!allowForYou && activeTab === 'foryou') {
                    setActiveTab('following');
                }
            } catch (err) {
                console.error('Error fetching initial data: ', err);
                try {
                    const res = await getProfile();
                    setCurrentUserId(res.data.id_usuario);
                } catch (e) {
                    console.error(e);
                }
            }
        };

        fetchDreams(activeTab, 1, false);
        fetchInitialData();
    }, []); // eslint-disable-line

    // Fetch dreams when tab changes
    useEffect(() => {
        setPage(1);
        setHasMore(true);
        setDreams([]);
        fetchDreams(activeTab, 1, false);
    }, [activeTab]); // eslint-disable-line

    // Infinite scroll via IntersectionObserver
    useEffect(() => {
        if (!hasMore || loadingMore || loading) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !loadingMore) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchDreams(activeTab, nextPage, true);
                }
            },
            { rootMargin: '200px' }
        );

        const currentRef = sentinelaRef.current;
        if (currentRef) observer.observe(currentRef);

        return () => {
            if (currentRef) observer.unobserve(currentRef);
        };
    }, [hasMore, loadingMore, loading, page, activeTab, fetchDreams]);

    const handleDreamCreated = () => {
        setPage(1);
        setHasMore(true);
        fetchDreams(activeTab, 1, false);
        setEditingDream(null);
    };

    const handleDeleteDream = (dreamId) => {
        setDreams(prev => prev.filter(d => d.id_publicacao !== dreamId));
    };

    const handleEditDream = (dream) => {
        setEditingDream(dream);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingDream(null);
        setIsModalOpen(true);
    };

    const handleTabChange = (tab) => {
        if (tab !== activeTab) {
            setActiveTab(tab);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('home.feedTitle')}</h1>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all"
                >
                    <FaPlus />
                    {t('sidebar.newDream')}
                </button>
            </div>

            {/* Feed Tabs */}
            <div className="flex border-b border-gray-200 dark:border-white/10">
                <button
                    onClick={() => handleTabChange('following')}
                    className={`flex items-center gap-2 px-6 py-4 text-base font-medium transition-all relative ${activeTab === 'following'
                        ? 'text-purple-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                >
                    <FaUserFriends className={activeTab === 'following' ? 'text-purple-400' : ''} />
                    {t('home.tabFollowing')}
                    {activeTab === 'following' && (
                        <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-full" />
                    )}
                </button>
                {showAlgorithmicFeed && (
                    <button
                        onClick={() => handleTabChange('foryou')}
                        className={`flex items-center gap-2 px-6 py-4 text-base font-medium transition-all relative ${activeTab === 'foryou'
                            ? 'text-orange-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        <FaFire className={activeTab === 'foryou' ? 'text-orange-400' : ''} />
                        {t('home.tabForYou')}
                        {activeTab === 'foryou' && (
                            <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-t-full" />
                        )}
                    </button>
                )}
            </div>

            {/* Loading State (initial load) */}
            {loading && (
                <div className="flex items-center justify-center min-h-[200px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="p-4 bg-red-900/30 text-red-300 rounded-lg">
                    {error}
                </div>
            )}

            {/* Dreams Feed */}
            {!loading && !error && dreams.length === 0 ? (
                <div className="text-center py-12">
                    <FaMoon className="text-6xl text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                        {activeTab === 'following'
                            ? t('home.emptyFollowing')
                            : t('home.emptyForYou')
                        }
                    </p>
                    <p className="text-gray-400 dark:text-gray-500">
                        {activeTab === 'following'
                            ? t('home.emptyFollowingDesc')
                            : t('home.emptyForYouDesc')
                        }
                    </p>
                </div>
            ) : !loading && !error && (
                <div className="flex flex-col divide-y divide-gray-200 dark:divide-white/10">
                    {dreams.map(dream => (
                        <DreamCard
                            key={dream.id_publicacao}
                            dream={dream}
                            currentUserId={currentUserId}
                            onDelete={handleDeleteDream}
                            onEdit={handleEditDream}
                        />
                    ))}
                </div>
            )}

            {/* Infinite scroll sentinel */}
            {!loading && hasMore && (
                <div ref={sentinelaRef} className="flex items-center justify-center py-8">
                    {loadingMore && (
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    )}
                </div>
            )}

            {/* End of feed message */}
            {!loading && !hasMore && dreams.length > 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    {t('home.feedEnd', 'Você viu todos os sonhos disponíveis ✨')}
                </div>
            )}

            <CreateDreamModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingDream(null); }}
                onSuccess={handleDreamCreated}
                editingDream={editingDream}
            />

            {/* Mobile Footer Links (visíveis quando a SidebarRight é ocultada no mobile) */}
            <div className="flex flex-wrap lg:hidden gap-x-4 gap-y-2 text-xs text-text-secondary/50 dark:text-white/20 px-2 mt-8 pb-4 text-center justify-center">
                <button onClick={() => navigate('/about')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerAbout', 'Sobre')}</button>
                <button onClick={() => navigate('/privacy')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerPrivacy', 'Privacidade')}</button>
                <button onClick={() => navigate('/terms')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerTerms', 'Termos')}</button>
                <button onClick={() => navigate('/help')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerHelp', 'Ajuda')}</button>
                <span>© {new Date().getFullYear()} Lumem</span>
            </div>
        </div>
    );
};

export default Home;
