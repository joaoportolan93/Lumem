import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaCalendarAlt, FaBirthdayCake, FaArrowLeft, FaLock, FaImage, FaUsers, FaCrown, FaShieldAlt, FaBan } from 'react-icons/fa';
import { getUser, getProfile, followUser, unfollowUser, unblockUser, getUserPosts, getUserCommunityPosts, getUserMediaPosts, getUserMemberCommunities, getUserAdminCommunities } from '../services/api';
import { useTranslation } from 'react-i18next';
import DreamCard from '../components/DreamCard';
import FollowersModal from '../components/FollowersModal';

const UserProfile = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const [user, setUser] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [followStatus, setFollowStatus] = useState('none'); // 'following', 'pending', 'none'
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('dreams');
    const [userDreams, setUserDreams] = useState([]);
    const [dreamsLoading, setDreamsLoading] = useState(true);
    const [communityPosts, setCommunityPosts] = useState([]);
    const [communityLoading, setCommunityLoading] = useState(false);
    const [mediaPosts, setMediaPosts] = useState([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [communitySubTab, setCommunitySubTab] = useState('posts');
    const [memberCommunities, setMemberCommunities] = useState([]);
    const [memberCommLoading, setMemberCommLoading] = useState(false);
    const [adminCommunities, setAdminCommunities] = useState([]);
    const [adminCommLoading, setAdminCommLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showFollowersModal, setShowFollowersModal] = useState(false);
    const [followersModalTab, setFollowersModalTab] = useState('followers');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [userRes, profileRes] = await Promise.all([
                    getUser(id),
                    getProfile()
                ]);
                setUser(userRes.data);
                setCurrentUser(profileRes.data);
                setFollowStatus(userRes.data.follow_status || 'none');
                setIsBlocked(userRes.data.is_blocked || false);

                // Don't fetch posts if user is blocked
                if (userRes.data.is_blocked) {
                    setLoading(false);
                    setDreamsLoading(false);
                    return;
                }

                // Fetch user's dreams only if can see them (not private or is following)
                const isPrivate = userRes.data.privacidade_padrao === 2;
                const canSee = !isPrivate || userRes.data.follow_status === 'following' || userRes.data.id_usuario === profileRes.data.id_usuario;

                if (canSee) {
                    const dreamsRes = await getUserPosts(id);
                    setUserDreams(dreamsRes.data);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            } finally {
                setLoading(false);
                setDreamsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    // Lazy fetch community posts
    useEffect(() => {
        if (activeTab === 'communities' && user) {
            const isPrivate = user.privacidade_padrao === 2;
            const canSee = !isPrivate || followStatus === 'following' || user.id_usuario === currentUser?.id_usuario;
            if (!canSee) return;

            if (communitySubTab === 'posts' && communityPosts.length === 0) {
                const fetchCommunityPosts = async () => {
                    setCommunityLoading(true);
                    try {
                        const res = await getUserCommunityPosts(id);
                        setCommunityPosts(res.data);
                    } catch (error) {
                        console.error('Error fetching community posts:', error);
                    } finally {
                        setCommunityLoading(false);
                    }
                };
                fetchCommunityPosts();
            }
            if (communitySubTab === 'member' && memberCommunities.length === 0) {
                const fetchMemberComms = async () => {
                    setMemberCommLoading(true);
                    try {
                        const res = await getUserMemberCommunities(id);
                        setMemberCommunities(res.data);
                    } catch (error) {
                        console.error('Error fetching member communities:', error);
                    } finally {
                        setMemberCommLoading(false);
                    }
                };
                fetchMemberComms();
            }
            if (communitySubTab === 'admin' && adminCommunities.length === 0) {
                const fetchAdminComms = async () => {
                    setAdminCommLoading(true);
                    try {
                        const res = await getUserAdminCommunities(id);
                        setAdminCommunities(res.data);
                    } catch (error) {
                        console.error('Error fetching admin communities:', error);
                    } finally {
                        setAdminCommLoading(false);
                    }
                };
                fetchAdminComms();
            }
        }
    }, [activeTab, communitySubTab, user]);

    // Lazy fetch media posts
    useEffect(() => {
        if (activeTab === 'media' && mediaPosts.length === 0 && user) {
            const isPrivate = user.privacidade_padrao === 2;
            const canSee = !isPrivate || followStatus === 'following' || user.id_usuario === currentUser?.id_usuario;
            if (!canSee) return;

            const fetchMediaPosts = async () => {
                setMediaLoading(true);
                try {
                    const res = await getUserMediaPosts(id);
                    setMediaPosts(res.data);
                } catch (error) {
                    console.error('Error fetching media posts:', error);
                } finally {
                    setMediaLoading(false);
                }
            };
            fetchMediaPosts();
        }
    }, [activeTab, user]);

    const handleFollowToggle = async () => {
        setFollowLoading(true);
        try {
            if (followStatus === 'following' || followStatus === 'pending') {
                await unfollowUser(id);
                setFollowStatus('none');
                if (followStatus === 'following') {
                    setUser(prev => ({
                        ...prev,
                        seguidores_count: prev.seguidores_count - 1
                    }));
                }
            } else {
                const response = await followUser(id);
                const newStatus = response.data.follow_status || 'following';
                setFollowStatus(newStatus);
                if (newStatus === 'following') {
                    setUser(prev => ({
                        ...prev,
                        seguidores_count: prev.seguidores_count + 1
                    }));
                }
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            setFollowLoading(false);
        }
    };

    const formatDate = (dateString, type = 'join') => {
        if (!dateString) return t('userProfile.dateNotProvided');
        const dateValue = dateString.includes('T') ? dateString : `${dateString}T12:00:00`;
        const date = new Date(dateValue);
        const months = [
            t('months.january'), t('months.february'), t('months.march'), t('months.april'),
            t('months.may'), t('months.june'), t('months.july'), t('months.august'),
            t('months.september'), t('months.october'), t('months.november'), t('months.december')
        ];

        if (type === 'birth') {
            return t('userProfile.bornOn', { day: date.getDate(), month: months[date.getMonth()], year: date.getFullYear() });
        }
        return t('userProfile.memberSince', { month: months[date.getMonth()], year: date.getFullYear() });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">{t('userProfile.errNotFound')}</p>
                <Link to="/" className="text-purple-400 hover:underline mt-4 inline-block">
                    {t('userProfile.btnBackToFeed')}
                </Link>
            </div>
        );
    }

    const isOwnProfile = currentUser?.id_usuario === user.id_usuario;
    const avatarUrl = user.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg';
    const isPrivate = user.privacidade_padrao === 2;
    const canSeePosts = !isBlocked && (!isPrivate || followStatus === 'following' || isOwnProfile);

    const handleUnblock = async () => {
        try {
            await unblockUser(user.id_usuario);
            setIsBlocked(false);
            // Fetch posts now that we unblocked
            const dreamsRes = await getUserPosts(id);
            setUserDreams(dreamsRes.data);
        } catch (error) {
            console.error('Error unblocking user:', error);
        }
    };

    // Helper to render the locked content message
    const renderLockedMessage = () => (
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center">
            <FaLock className="text-4xl text-gray-500 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-white mb-2">{t('userProfile.lockedTitle')}</h4>
            <p className="text-gray-400 mb-4">
                {t('userProfile.lockedDesc', { username: user.nome_usuario })}
            </p>
            {followStatus === 'pending' && (
                <p className="text-amber-400 text-sm">{t('userProfile.pendingRequest')}</p>
            )}
        </div>
    );

    return (
        <div className="min-h-screen">
            {/* Back Button */}
            <Link to="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors">
                <FaArrowLeft />
                <span>{t('userProfile.btnBack')}</span>
            </Link>

            {/* Banned User Alert */}
            {user.is_banned && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-bold text-red-500">{t('userProfile.userBanned')}</h3>
                    </div>
                    <p className="text-gray-300">
                        {t('userProfile.userBannedReason')} <strong className="text-red-400">{user.ban_reason}</strong>
                    </p>
                </div>
            )}

            {/* Profile Header */}
            <div className="relative bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-8 mb-6 overflow-hidden text-white">
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
                        <h1 className="text-3xl font-bold mb-2">
                            {user.nome_completo || t('userProfile.defaultName')}
                        </h1>
                        <h2 className="text-lg mb-4 opacity-90 flex items-center gap-2 justify-center md:justify-start">
                            @{user.nome_usuario || 'username'}
                            {user.privacidade_padrao === 2 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                                    <FaLock size={10} /> {t('userProfile.privateAccount')}
                                </span>
                            )}
                        </h2>
                        <p className="mb-4 leading-relaxed max-w-2xl">
                            {user.bio || t('userProfile.defaultBio')}
                        </p>

                        <div className="flex gap-6 flex-wrap mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 text-sm">
                                <FaCalendarAlt className="opacity-90" />
                                <span>{formatDate(user.data_criacao, 'join')}</span>
                            </div>
                            {user.data_nascimento && (
                                <div className="flex items-center gap-2 text-sm">
                                    <FaBirthdayCake className="opacity-90" />
                                    <span>{formatDate(user.data_nascimento, 'birth')}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-8 mb-6 justify-center md:justify-start">
                            <div className="text-center md:text-left">
                                <div className="text-xl font-bold">{userDreams.length}</div>
                                <div className="text-sm opacity-90">{t('userProfile.statDreams')}</div>
                            </div>
                            <button
                                onClick={() => { if (canSeePosts || isOwnProfile) { setFollowersModalTab('followers'); setShowFollowersModal(true); } }}
                                className={`text-center md:text-left ${(canSeePosts || isOwnProfile) ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'} transition-opacity`}
                            >
                                <div className="text-xl font-bold">{user.seguidores_count || 0}</div>
                                <div className="text-sm opacity-90">{t('userProfile.statFollowers')}</div>
                            </button>
                            <button
                                onClick={() => { if (canSeePosts || isOwnProfile) { setFollowersModalTab('following'); setShowFollowersModal(true); } }}
                                className={`text-center md:text-left ${(canSeePosts || isOwnProfile) ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'} transition-opacity`}
                            >
                                <div className="text-xl font-bold">{user.seguindo_count || 0}</div>
                                <div className="text-sm opacity-90">{t('userProfile.statFollowing')}</div>
                            </button>
                        </div>

                        {!isOwnProfile && !isBlocked && (
                            <button
                                onClick={handleFollowToggle}
                                disabled={followLoading}
                                className={`px-8 py-3 rounded-full font-semibold transition-all ${followStatus === 'following'
                                    ? 'bg-white/20 backdrop-blur-sm text-white border-2 border-white hover:bg-white/30'
                                    : followStatus === 'pending'
                                        ? 'bg-gray-400/30 backdrop-blur-sm text-white border-2 border-gray-300'
                                        : 'bg-white text-[#764ba2] hover:bg-white/90'
                                    } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {followLoading
                                    ? t('userProfile.followLoading')
                                    : followStatus === 'following'
                                        ? t('userProfile.followFollowing')
                                        : followStatus === 'pending'
                                            ? t('userProfile.followPending')
                                            : t('userProfile.followFollow')
                                }
                            </button>
                        )}

                        {isOwnProfile && (
                            <Link
                                to="/profile"
                                className="px-6 py-3 bg-white text-[#764ba2] rounded-full font-semibold hover:bg-white/90 transition-colors"
                            >
                                {t('userProfile.btnViewOwnProfile')}
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Blocked User Screen */}
            {isBlocked && !isOwnProfile && (
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white dark:bg-[#1a163a]/95 border border-gray-200 dark:border-white/10 rounded-2xl p-12 text-center">
                        <FaBan className="text-5xl text-red-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('userProfile.blockedTitle', { username: user.nome_usuario })}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            {t('userProfile.blockedDesc')}
                        </p>
                        <button
                            onClick={handleUnblock}
                            className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold transition-colors"
                        >
                            {t('userProfile.btnUnblock', { username: user.nome_usuario })}
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs & Content */}
            {!isBlocked && <div className="max-w-4xl mx-auto px-4">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-white/10 mb-8">
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'dreams'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('dreams')}
                    >
                        {t('userProfile.tabDreams')}
                    </button>
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'communities'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('communities')}
                    >
                        {t('userProfile.tabCommunities')}
                    </button>
                    <button
                        className={`px-6 py-4 text-base transition-colors ${activeTab === 'media'
                            ? 'border-b-4 border-purple-500 text-purple-400 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:text-purple-400'
                            }`}
                        onClick={() => setActiveTab('media')}
                    >
                        {t('userProfile.tabMedia')}
                    </button>
                </div>

                {/* Dreams Tab Content */}
                {activeTab === 'dreams' && (
                    <>
                        {!canSeePosts ? renderLockedMessage() : dreamsLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : userDreams.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {userDreams.map(dream => (
                                    <DreamCard
                                        key={dream.id_publicacao}
                                        dream={dream}
                                        currentUserId={currentUser?.id_usuario}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 dark:text-gray-400">{t('userProfile.emptyDreams')}</p>
                            </div>
                        )}
                    </>
                )}

                {/* Communities Tab Content */}
                {activeTab === 'communities' && (
                    <>
                        {!canSeePosts ? renderLockedMessage() : (
                            <>
                                {/* Community Sub-Tabs */}
                                <div className="flex gap-2 mb-6">
                                    {[{ key: 'posts', label: t('userProfile.subtabPosts') }, { key: 'member', label: t('userProfile.subtabMember') }, { key: 'admin', label: t('userProfile.subtabAdmin') }].map(sub => (
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
                                                    currentUserId={currentUser?.id_usuario}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500 dark:text-gray-400">{t('userProfile.emptyCommunityPosts')}</p>
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
                                                            {comm.membros_count || 0} {t('userProfile.membersCount')}
                                                        </p>
                                                    </div>
                                                    {comm.user_role && (
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${comm.user_role === 'admin'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : comm.user_role === 'moderator'
                                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}>
                                                            {comm.user_role === 'admin' && <><FaCrown className="inline mr-1" />{t('userProfile.roleAdmin')}</>}
                                                            {comm.user_role === 'moderator' && <><FaShieldAlt className="inline mr-1" />{t('userProfile.roleMod')}</>}
                                                            {comm.user_role === 'member' && t('userProfile.roleMember')}
                                                        </span>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <FaUsers className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400 text-lg">{t('userProfile.emptyMemberCommunities')}</p>
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
                                                            {comm.membros_count || 0} {t('userProfile.membersCount')}
                                                        </p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${comm.user_role === 'admin'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        }`}>
                                                        {comm.user_role === 'admin' ? <><FaCrown className="inline mr-1" />{t('userProfile.roleAdmin')}</> : <><FaShieldAlt className="inline mr-1" />{t('userProfile.roleMod')}</>}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <FaCrown className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400 text-lg">{t('userProfile.emptyAdminCommunities')}</p>
                                        </div>
                                    )
                                )}
                            </>
                        )}
                    </>
                )}

                {/* Media Tab Content */}
                {activeTab === 'media' && (
                    <>
                        {!canSeePosts ? renderLockedMessage() : mediaLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        ) : mediaPosts.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {mediaPosts.map(post => (
                                    <DreamCard
                                        key={post.id_publicacao}
                                        dream={post}
                                        currentUserId={currentUser?.id_usuario}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FaImage className="text-6xl text-gray-500 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                                    {t('userProfile.emptyMedia')}
                                </p>
                                <p className="text-gray-400 dark:text-gray-500">
                                    {t('userProfile.emptyMediaSub')}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>}

            {/* Followers/Following Modal */}
            <FollowersModal
                isOpen={showFollowersModal}
                onClose={() => setShowFollowersModal(false)}
                userId={user.id_usuario}
                initialTab={followersModalTab}
                currentUserId={currentUser?.id_usuario}
            />
        </div>
    );
};

export default UserProfile;
