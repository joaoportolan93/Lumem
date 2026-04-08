import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendarAlt, FaEdit, FaEllipsisH, FaBirthdayCake, FaMoon, FaLock, FaImage, FaUsers, FaCrown, FaShieldAlt } from 'react-icons/fa';
import { getProfile, getMyDreams, getDreams, getMyCommunityPosts, getMyMediaPosts, getUserCommunities, getMyAdminCommunities } from '../services/api';
import DreamCard from '../components/DreamCard';
import FollowersModal from '../components/FollowersModal';
import { useTranslation } from 'react-i18next';

const Profile = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dreams');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dreams, setDreams] = useState([]);
    const [dreamsLoading, setDreamsLoading] = useState(true);
    const [savedDreams, setSavedDreams] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [communityPosts, setCommunityPosts] = useState([]);
    const [communityLoading, setCommunityLoading] = useState(false);
    const [mediaPosts, setMediaPosts] = useState([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [communitySubTab, setCommunitySubTab] = useState('posts');
    const [memberCommunities, setMemberCommunities] = useState([]);
    const [memberCommLoading, setMemberCommLoading] = useState(false);
    const [adminCommunities, setAdminCommunities] = useState([]);
    const [adminCommLoading, setAdminCommLoading] = useState(false);
    const [showFollowersModal, setShowFollowersModal] = useState(false);
    const [followersModalTab, setFollowersModalTab] = useState('followers');

    useEffect(() => {
        if (activeTab === 'saved' && savedDreams.length === 0) {
            const fetchSaved = async () => {
                setSavedLoading(true);
                try {
                    const res = await getDreams('saved');
                    setSavedDreams(res.data.results ? res.data.results : res.data);
                } catch (error) {
                    console.error('Error fetching saved dreams:', error);
                } finally {
                    setSavedLoading(false);
                }
            };
            fetchSaved();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'communities' && communitySubTab === 'posts' && communityPosts.length === 0) {
            const fetchCommunityPosts = async () => {
                setCommunityLoading(true);
                try {
                    const res = await getMyCommunityPosts();
                    setCommunityPosts(res.data.results || res.data);
                } catch (error) {
                    console.error('Error fetching community posts:', error);
                } finally {
                    setCommunityLoading(false);
                }
            };
            fetchCommunityPosts();
        }
        if (activeTab === 'communities' && communitySubTab === 'member' && memberCommunities.length === 0) {
            const fetchMemberComms = async () => {
                setMemberCommLoading(true);
                try {
                    const res = await getUserCommunities();
                    setMemberCommunities(res.data.results || res.data);
                } catch (error) {
                    console.error('Error fetching member communities:', error);
                } finally {
                    setMemberCommLoading(false);
                }
            };
            fetchMemberComms();
        }
        if (activeTab === 'communities' && communitySubTab === 'admin' && adminCommunities.length === 0) {
            const fetchAdminComms = async () => {
                setAdminCommLoading(true);
                try {
                    const res = await getMyAdminCommunities();
                    setAdminCommunities(res.data.results || res.data);
                } catch (error) {
                    console.error('Error fetching admin communities:', error);
                } finally {
                    setAdminCommLoading(false);
                }
            };
            fetchAdminComms();
        }
    }, [activeTab, communitySubTab]);

    useEffect(() => {
        if (activeTab === 'media' && mediaPosts.length === 0) {
            const fetchMediaPosts = async () => {
                setMediaLoading(true);
                try {
                    const res = await getMyMediaPosts();
                    setMediaPosts(res.data.results ? res.data.results : res.data);
                } catch (error) {
                    console.error('Error fetching media posts:', error);
                } finally {
                    setMediaLoading(false);
                }
            };
            fetchMediaPosts();
        }
    }, [activeTab]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, dreamsRes] = await Promise.all([
                    getProfile(),
                    getMyDreams()
                ]);
                setUser(profileRes.data);
                setDreams(dreamsRes.data.results ? dreamsRes.data.results : dreamsRes.data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
                setDreamsLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatDate = (dateString, type = 'join') => {
        if (!dateString) return t('profile.dateNotInfo');
        // Fix timezone offset issue
        const dateValue = dateString.includes('T') ? dateString : `${dateString}T12:00:00`;
        const date = new Date(dateValue);
        const months = t('profile.months', { returnObjects: true });

        if (type === 'birth') {
            return t('profile.bornOn', { day: date.getDate(), month: months[date.getMonth()], year: date.getFullYear() });
        }
        return t('profile.memberSince', { month: months[date.getMonth()], year: date.getFullYear() });
    };

    const handleDeleteDream = (dreamId) => {
        setDreams(prev => prev.filter(d => d.id_publicacao !== dreamId));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    const avatarUrl = user?.avatar_url || 'https://randomuser.me/api/portraits/women/44.jpg';

    return (
        <div className="min-h-screen">
            {/* Profile Header */}
            <div className="relative bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-8 mb-6 overflow-hidden text-white max-w-5xl mx-auto">
                {/* Background Image Overlay */}
                <div
                    className="absolute top-0 left-0 right-0 bottom-0 opacity-20 z-0"
                    style={{
                        backgroundImage: "url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1471&q=80')",
                        backgroundPosition: 'center',
                        backgroundSize: 'cover'
                    }}
                />

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
                    <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-32 h-32 rounded-full border-4 border-white object-cover"
                    />

                    <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                            {user?.nome_completo || t('profile.defaultUser')}
                            {user?.privacidade_padrao === 2 && <FaLock className="text-2xl opacity-80" title={t('profile.privateAccount')} />}
                        </h1>
                        <h2 className="text-lg mb-4 opacity-90">
                            @{user?.nome_usuario || 'username'}
                        </h2>
                        <p className="mb-4 leading-relaxed max-w-2xl">
                            {user?.bio || t('profile.noBio')}
                        </p>

                        <div className="flex gap-6 flex-wrap mb-4 justify-center md:justify-start">
                            {user?.privacidade_padrao === 2 && (
                                <div className="flex items-center gap-2 text-sm bg-black/20 px-3 py-1 rounded-full">
                                    <FaLock className="text-xs" />
                                    <span>{t('profile.privateAccount')}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <FaCalendarAlt className="opacity-90" />
                                <span>{formatDate(user?.data_criacao, 'join')}</span>
                            </div>
                            {user?.data_nascimento && (
                                <div className="flex items-center gap-2 text-sm">
                                    <FaBirthdayCake className="opacity-90" />
                                    <span>{formatDate(user?.data_nascimento, 'birth')}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-8 mb-6 justify-center md:justify-start">
                            <div className="text-center md:text-left">
                                <div className="text-xl font-bold">{dreams.length}</div>
                                <div className="text-sm opacity-90">{t('profile.statDreams')}</div>
                            </div>
                            <button
                                onClick={() => { setFollowersModalTab('followers'); setShowFollowersModal(true); }}
                                className="text-center md:text-left hover:opacity-70 cursor-pointer transition-opacity"
                            >
                                <div className="text-xl font-bold">{user?.seguidores_count || 0}</div>
                                <div className="text-sm opacity-90">{t('profile.statFollowers')}</div>
                            </button>
                            <button
                                onClick={() => { setFollowersModalTab('following'); setShowFollowersModal(true); }}
                                className="text-center md:text-left hover:opacity-70 cursor-pointer transition-opacity"
                            >
                                <div className="text-xl font-bold">{user?.seguindo_count || 0}</div>
                                <div className="text-sm opacity-90">{t('profile.statFollowing')}</div>
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <Link
                                to="/edit-profile"
                                className="flex items-center gap-2 px-6 py-3 bg-white text-[#764ba2] rounded-full font-semibold transition-transform hover:-translate-y-0.5"
                            >
                                <FaEdit />
                                {t('profile.btnEdit')}
                            </Link>

                        </div>
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className="max-w-4xl mx-auto px-4">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-white/10 mb-8">
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'dreams'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('dreams')}
                    >
                        {t('profile.tabDreams')}
                    </button>
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'communities'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('communities')}
                    >
                        {t('profile.tabCommunities')}
                    </button>
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'media'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('media')}
                    >
                        {t('profile.tabMedia')}
                    </button>
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'saved'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('saved')}
                    >
                        {t('profile.tabSaved')}
                    </button>
                </div>

                {/* Dreams Tab Content */}
                {activeTab === 'dreams' && (
                    <>
                        {dreamsLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : dreams.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {dreams.map(dream => (
                                    <DreamCard
                                        key={dream.id_publicacao}
                                        dream={dream}
                                        currentUserId={user?.id_usuario}
                                        onDelete={handleDeleteDream}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FaMoon className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                                    {t('profile.emptyDreams')}
                                </p>
                                <p className="text-gray-400 dark:text-gray-500 mb-6">
                                    {t('profile.emptyDreamsDesc')}
                                </p>
                                <Link
                                    to="/"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all"
                                >
                                    {t('profile.btnCreateDream')}
                                </Link>
                            </div>
                        )}
                    </>
                )}

                {/* Communities Tab Content */}
                {activeTab === 'communities' && (
                    <>
                        {/* Community Sub-Tabs */}
                        <div className="flex gap-2 mb-6">
                            {[{ key: 'posts', label: t('profile.subTabPosts') }, { key: 'member', label: t('profile.subTabMember') }, { key: 'admin', label: t('profile.subTabAdmin') }].map(sub => (
                                <button
                                    key={sub.key}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${communitySubTab === sub.key
                                        ? 'bg-purple-500 text-white shadow-lg'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                    onClick={() => setCommunitySubTab(sub.key)}
                                >
                                    {sub.label}
                                </button>
                            ))}
                        </div>

                        {/* Posts Sub-Tab */}
                        {communitySubTab === 'posts' && (
                            communityLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                                </div>
                            ) : communityPosts.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {communityPosts.map(post => (
                                        <DreamCard
                                            key={post.id_publicacao}
                                            dream={post}
                                            currentUserId={user?.id_usuario}
                                            onDelete={handleDeleteDream}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{t('profile.emptyCommPosts')}</p>
                                    <p className="text-gray-400 dark:text-gray-500">{t('profile.emptyCommPostsDesc')}</p>
                                </div>
                            )
                        )}

                        {/* Member Sub-Tab */}
                        {communitySubTab === 'member' && (
                            memberCommLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                                </div>
                            ) : memberCommunities.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {memberCommunities.map(comm => (
                                        <Link
                                            key={comm.id_comunidade}
                                            to={`/community/${comm.id_comunidade}`}
                                            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all hover:shadow-lg group"
                                        >
                                            <img
                                                src={comm.imagem || 'https://via.placeholder.com/60?text=C'}
                                                alt={comm.nome}
                                                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-400 transition-colors">{comm.nome}</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    <FaUsers className="inline mr-1" />
                                                    {comm.membros_count || 0} {t('profile.members')}
                                                </p>
                                            </div>
                                            {comm.user_role && (
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${comm.user_role === 'admin'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : comm.user_role === 'moderator'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {comm.user_role === 'admin' && <><FaCrown className="inline mr-1" />{t('profile.roleAdmin')}</>}
                                                    {comm.user_role === 'moderator' && <><FaShieldAlt className="inline mr-1" />{t('profile.roleMod')}</>}
                                                    {comm.user_role === 'member' && t('profile.roleMember')}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <FaUsers className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{t('profile.emptyComms')}</p>
                                    <Link to="/communities" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-full hover:opacity-90 transition-all">
                                        {t('profile.btnExploreComms')}
                                    </Link>
                                </div>
                            )
                        )}

                        {/* Admin/Mod Sub-Tab */}
                        {communitySubTab === 'admin' && (
                            adminCommLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                                </div>
                            ) : adminCommunities.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {adminCommunities.map(comm => (
                                        <Link
                                            key={comm.id_comunidade}
                                            to={`/community/${comm.id_comunidade}`}
                                            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all hover:shadow-lg group"
                                        >
                                            <img
                                                src={comm.imagem || 'https://via.placeholder.com/60?text=C'}
                                                alt={comm.nome}
                                                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-400 transition-colors">{comm.nome}</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    <FaUsers className="inline mr-1" />
                                                    {comm.membros_count || 0} {t('profile.members')}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${comm.user_role === 'admin'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {comm.user_role === 'admin' ? <><FaCrown className="inline mr-1" />{t('profile.roleAdmin')}</> : <><FaShieldAlt className="inline mr-1" />{t('profile.roleMod')}</>}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <FaCrown className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{t('profile.emptyAdmin')}</p>
                                    <p className="text-gray-400 dark:text-gray-500">{t('profile.emptyAdminDesc')}</p>
                                </div>
                            )
                        )}
                    </>
                )}

                {/* Media Tab Content */}
                {activeTab === 'media' && (
                    <>
                        {mediaLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : mediaPosts.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {mediaPosts.map(post => (
                                    <DreamCard
                                        key={post.id_publicacao}
                                        dream={post}
                                        currentUserId={user?.id_usuario}
                                        onDelete={handleDeleteDream}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FaImage className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                                    {t('profile.emptyMedia')}
                                </p>
                                <p className="text-gray-400 dark:text-gray-500">
                                    {t('profile.emptyMediaDesc')}
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Saved Tab Content */}
                {activeTab === 'saved' && (
                    <>
                        {savedLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : savedDreams.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {savedDreams.map(dream => (
                                    <DreamCard
                                        key={dream.id_publicacao}
                                        dream={{ ...dream, is_saved: true }} // Ensure is_saved is true for visual feedback
                                        currentUserId={user?.id_usuario}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                                    {t('profile.emptySaved')}
                                </p>
                                <p className="text-gray-400 dark:text-gray-500">
                                    {t('profile.emptySavedDesc')}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Followers/Following Modal */}
            <FollowersModal
                isOpen={showFollowersModal}
                onClose={() => setShowFollowersModal(false)}
                userId={user?.id_usuario}
                initialTab={followersModalTab}
                currentUserId={user?.id_usuario}
            />
        </div>
    );
};

export default Profile;
