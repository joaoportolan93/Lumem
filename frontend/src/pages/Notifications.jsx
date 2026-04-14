import React, { useState, useEffect } from 'react';
import { FaBell, FaHeart, FaComment, FaUserPlus, FaCheck, FaArrowLeft, FaShieldAlt, FaAt } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { acceptFollowRequest, getFollowRequests, getNotifications, markAllNotificationsRead, rejectFollowRequest, acceptCommunityInvite, rejectCommunityInvite } from '../services/api';
import { useTranslation } from 'react-i18next';

const Notifications = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [followRequests, setFollowRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
        fetchFollowRequests();
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await getNotifications();
            setNotifications(response.data.results ? response.data.results : response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(t('notifications.errorLoading'));
        } finally {
            setLoading(false);
        }
    };

    const fetchFollowRequests = async () => {
        setRequestsLoading(true);
        try {
            const response = await getFollowRequests();
            setFollowRequests(response.data);
        } catch (err) {
            console.error('Error fetching follow requests:', err);
        } finally {
            setRequestsLoading(false);
        }
    };

    const handleAcceptRequest = async (userId) => {
        try {
            await acceptFollowRequest(userId);
            setFollowRequests(prev => prev.filter(r => r.id_usuario !== userId));
        } catch (err) {
            console.error('Error accepting request:', err);
        }
    };

    const handleRejectRequest = async (userId) => {
        try {
            await rejectFollowRequest(userId);
            setFollowRequests(prev => prev.filter(r => r.id_usuario !== userId));
        } catch (err) {
            console.error('Error rejecting request:', err);
        }
    };

    const handleCommunityInvite = async (e, idReferencia, action) => {
        e.preventDefault();
        e.stopPropagation();

        if (typeof idReferencia !== 'string' || !idReferencia.includes('::')) {
            setError(t('notifications.errorInviteAction') || 'Dados do convite inválidos');
            return;
        }

        try {
            const [communityId, inviteId] = idReferencia.split('::');
            if (action === 'accept') {
                await acceptCommunityInvite(communityId, inviteId);
            } else {
                await rejectCommunityInvite(communityId, inviteId);
            }
            setNotifications(prev => prev.filter(n => n.id_referencia !== idReferencia));
        } catch (error) {
            console.error('Error handling community invite:', error);
            setError(t('notifications.errorInviteAction') || 'Erro ao processar convite');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'follower':
                return <FaUserPlus className="text-blue-400" />;
            case 'like':
                return <FaHeart className="text-red-400" />;
            case 'comment':
                return <FaComment className="text-green-400" />;
            case 'community_invite':
                return <FaShieldAlt className="text-blue-500" />;
            case 'mention':
                return <FaAt className="text-indigo-400" />;
            default:
                return <FaBell className="text-primary" />;
        }
    };

    const getNotificationLink = (notification) => {
        if (notification.tipo_notificacao_display === 'community_invite') {
            if (notification.id_referencia) {
                const [communityId] = notification.id_referencia.split('::');
                return `/community/${communityId}`;
            }
            return '#';
        }
        if (notification.tipo_notificacao_display === 'mention' && notification.id_referencia?.includes('::')) {
            const [postId] = notification.id_referencia.split('::');
            return `/post/${postId}`;
        }
        return notification.id_referencia ? `/post/${notification.id_referencia}` : `/user/${notification.usuario_origem?.id_usuario}`;
    };

    const getMessage = (notification) => {
        switch (notification.tipo_notificacao_display) {
            case 'follower':
                return t('notifications.startedFollowing');
            case 'like':
                return t('notifications.likedDream', { content: notification.conteudo || t('notifications.yourDream') });
            case 'comment':
                return t('notifications.commented', { content: notification.conteudo || '' });
            case 'community_invite':
                return t('notifications.communityInvite', { community: notification.conteudo || '' });
            case 'mention':
                return t('notifications.mentionedYou', { content: notification.conteudo || t('notifications.yourDream') });
            default:
                return notification.conteudo || t('notifications.interacted');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('notifications.timeNow');
        if (diffMins < 60) return t('notifications.timeMins', { min: diffMins });
        if (diffHours < 24) return t('notifications.timeHours', { hours: diffHours });
        if (diffDays < 7) return t('notifications.timeDays', { days: diffDays });
        return date.toLocaleDateString(t('notifications.dateFormat'));
    };

    const markAllAsRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const unreadCount = notifications.filter(n => !n.lida).length;

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <FaArrowLeft className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <FaBell className="text-primary" />
                        {t('notifications.title')}
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </h1>
                </div>

                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                        <FaCheck />
                        {t('notifications.markAllRead')}
                    </button>
                )}
            </div>

            {/* Follow Requests Section */}
            {requestsLoading ? (
                <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/10">
                    <div className="flex justify-center py-4">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            ) : followRequests.length > 0 && (
                <div className="bg-white dark:bg-white/5 shadow-card dark:shadow-none backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <FaUserPlus className="text-primary" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {t('notifications.followerRequests')}
                        </h2>
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {followRequests.length}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {followRequests.map(request => (
                            <div key={request.id_usuario} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                <Link to={`/user/${request.id_usuario}`} className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
                                        {request.avatar_url ? (
                                            <img src={request.avatar_url} alt={request.nome_usuario} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-white font-bold text-lg">{request.nome_usuario.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{request.nome_completo}</p>
                                        <p className="text-sm text-gray-400">@{request.nome_usuario}</p>
                                    </div>
                                </Link>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRejectRequest(request.id_usuario)}
                                        className="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                                    >
                                        {t('notifications.btnReject')}
                                    </button>
                                    <button
                                        onClick={() => handleAcceptRequest(request.id_usuario)}
                                        className="px-4 py-2 border border-green-500 text-green-500 rounded-lg hover:bg-green-500/10 transition-colors"
                                    >
                                        {t('notifications.btnAccept')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="text-center py-12">
                    <p className="text-red-400">{t('notifications.errorLoading')}</p>
                    <button onClick={fetchNotifications} className="text-primary mt-2 hover:underline">
                        {t('notifications.btnRetry')}
                    </button>
                </div>
            )}

            {/* Notifications List */}
            {!loading && !error && (
                <div className="space-y-2">
                    {notifications.length === 0 ? (
                        <div className="text-center py-12">
                            <FaBell className="text-6xl text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 text-lg">{t('notifications.emptyTitle')}</p>
                            <p className="text-gray-400 dark:text-gray-500">{t('notifications.emptyDesc')}</p>
                        </div>
                    ) : (
                        notifications.map(notification => (
                            <Link
                                key={notification.id_notificacao}
                                to={getNotificationLink(notification)}
                                className={`flex items-start gap-4 p-4 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-white/5 ${!notification.lida ? 'bg-gray-100 dark:bg-white/5 border-l-4 border-primary' : ''
                                    }`}
                            >
                                {/* User Avatar */}
                                <div className="relative">
                                    <img
                                        src={notification.usuario_origem?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                        alt={notification.usuario_origem?.nome_completo}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-gray-900 shadow flex items-center justify-center">
                                        {getIcon(notification.tipo_notificacao_display)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-gray-900 dark:text-white">
                                        <span className="font-semibold">
                                            {notification.usuario_origem?.nome_completo || t('notifications.someone')}
                                        </span>{' '}
                                        <span className="text-gray-600 dark:text-gray-300">{getMessage(notification)}</span>
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{formatDate(notification.data_criacao)}</p>
                                    
                                    {notification.tipo_notificacao_display === 'community_invite' && (
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={(e) => handleCommunityInvite(e, notification.id_referencia, 'reject')}
                                                className="px-4 py-1.5 border border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-500/10 transition-colors"
                                            >
                                                {t('notifications.btnReject')}
                                            </button>
                                            <button
                                                onClick={(e) => handleCommunityInvite(e, notification.id_referencia, 'accept')}
                                                className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                                            >
                                                {t('notifications.btnAccept')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Unread Indicator */}
                                {!notification.lida && (
                                    <div className="w-3 h-3 bg-primary rounded-full flex-shrink-0 mt-2"></div>
                                )}
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Notifications;

