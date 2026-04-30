import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaArrowLeft, FaHeart, FaRegHeart, FaComment, FaShare, FaEllipsisH, FaEdit, FaTrash, FaFlag, FaBookmark, FaRegBookmark, FaUserFriends, FaChevronDown, FaRobot, FaLock, FaUserPlus, FaUserCheck, FaVolumeMute, FaBan } from 'react-icons/fa';
import { getDream, deleteDream, likeDream, saveDream, getComments, createComment, getProfile, followUser, unfollowUser, muteUser, unmuteUser, blockUser, unblockUser } from '../services/api';
import { useTranslation } from 'react-i18next';
import ReplyComposer from '../components/ReplyComposer';
import CommentItem from '../components/CommentItem';
import CommentDetailModal from '../components/CommentDetailModal';
import ReportModal from '../components/ReportModal';
import RenderMentions from '../components/RenderMentions';

// Sorting options
const SORT_OPTIONS = [
    { key: 'relevance', label: 'Mais Relevantes' },
    { key: 'recent', label: 'Mais Recentes' },
    { key: 'likes', label: 'Mais Curtidos' },
];


const PostPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Post states
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [saved, setSaved] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Social actions state
    const [isFollowing, setIsFollowing] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Comments
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(true);

    // CENTRALIZED INLINE REPLY STATE - Only ONE reply input can be open at a time
    const [activeReplyId, setActiveReplyId] = useState(null);

    // Sorting
    const [sortBy, setSortBy] = useState('relevance');
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Comment report
    const [reportingComment, setReportingComment] = useState(null);
    const [showCommentReportModal, setShowCommentReportModal] = useState(false);

    // Comment detail modal (click to expand)
    const [selectedComment, setSelectedComment] = useState(null);
    const [showCommentDetail, setShowCommentDetail] = useState(false);

    // Spam toggle
    const [showSpamArea, setShowSpamArea] = useState(false);

    useEffect(() => {
        fetchCurrentUser();
        fetchPost();
        fetchComments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchCurrentUser = async () => {
        try {
            const response = await getProfile();
            setUser(response.data);
        } catch (err) {
            console.error('Error fetching current user:', err);
        }
    };

    const fetchPost = async () => {
        setLoading(true);
        try {
            const response = await getDream(id);
            setPost(response.data);
            setLiked(response.data.is_liked || false);
            setLikesCount(response.data.likes_count || 0);
            setSaved(response.data.is_saved || false);
            setIsFollowing(response.data.usuario?.is_following || false);
            setIsBlocked(response.data.usuario?.is_blocked || false);
            setIsMuted(response.data.usuario?.is_muted || false);
        } catch (err) {
            console.error('Error fetching post:', err);
            setError(t('post.errNotFound'));
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async (ordering = sortBy) => {
        setCommentsLoading(true);
        try {
            const response = await getComments(id, ordering);

            // Handle both paginated ({ results: [...] }) and plain array responses
            let dataArr = [];
            if (response.data && Array.isArray(response.data.results)) {
                dataArr = response.data.results;
            } else if (Array.isArray(response.data)) {
                dataArr = response.data;
            } else {
                console.error("Unrecognized comments response format:", response.data);
            }

            setComments(dataArr);
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setCommentsLoading(false);
        }
    };

    // Re-fetch comments when sort changes
    useEffect(() => {
        if (id) {
            fetchComments(sortBy);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy]);

    const handleLike = async () => {
        const wasLiked = liked;
        const prevCount = likesCount;
        setLiked(!wasLiked);
        setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);

        try {
            const response = await likeDream(id);
            setLiked(response.data.is_liked);
            setLikesCount(response.data.likes_count);
        } catch (err) {
            setLiked(wasLiked);
            setLikesCount(prevCount);
        }
    };

    const handleSave = async () => {
        const wasSaved = saved;
        setSaved(!wasSaved);

        try {
            const response = await saveDream(id);
            setSaved(response.data.is_saved);
        } catch (err) {
            setSaved(wasSaved);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t('post.confirmDelete'))) return;
        try {
            await deleteDream(id);
            navigate(-1);
        } catch (err) {
            console.error('Error deleting post:', err);
        }
    };

    const handleFollowToggle = async () => {
        if (!post?.usuario?.id_usuario) return;
        const prev = isFollowing;
        setIsFollowing(!prev);
        try {
            if (prev) await unfollowUser(post.usuario.id_usuario);
            else await followUser(post.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling follow:', err);
            setIsFollowing(prev);
        }
        setShowMenu(false);
    };

    const handleBlockToggle = async () => {
        if (!window.confirm(isBlocked ? t('post.confirmUnblock', 'Desbloquear usuário?') : t('post.confirmBlock', 'Bloquear usuário?'))) return;
        if (!post?.usuario?.id_usuario) return;
        const prev = isBlocked;
        setIsBlocked(!prev);
        try {
            if (prev) await unblockUser(post.usuario.id_usuario);
            else await blockUser(post.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling block:', err);
            setIsBlocked(prev);
        }
        setShowMenu(false);
    };

    const handleMuteToggle = async () => {
        if (!post?.usuario?.id_usuario) return;
        const prev = isMuted;
        setIsMuted(!prev);
        try {
            if (prev) await unmuteUser(post.usuario.id_usuario);
            else await muteUser(post.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling mute:', err);
            setIsMuted(prev);
        }
        setShowMenu(false);
    };

    const handleReply = (comment = null) => {
        // If it's a main post reply, focus the main composer
        if (!comment) {
            document.querySelector('textarea')?.focus();
        }
    };

    const handleReplySubmit = async (formData, parentId) => {
        try {
            if (parentId) {
                formData.append('comentario_pai', parentId);
            }
            const response = await createComment(id, formData);

            if (parentId) {
                const addReplyToTree = (comments) => {
                    return comments.map(c => {
                        if (c.id_comentario === parentId) {
                            return {
                                ...c,
                                respostas: [...(c.respostas || []), response.data],
                                respostas_count: (c.respostas_count || 0) + 1
                            };
                        }
                        if (c.respostas && c.respostas.length > 0) {
                            return {
                                ...c,
                                respostas: addReplyToTree(c.respostas)
                            };
                        }
                        return c;
                    });
                };
                setComments(prevComments => addReplyToTree(prevComments));
            } else {
                setComments(prevComments => [response.data, ...prevComments]);
            }
            setActiveReplyId(null); // Close the inline reply input after successful submission
        } catch (err) {
            console.error('Error creating comment:', err);
        }
    };

    const handleReportComment = (comment) => {
        setReportingComment(comment);
        setShowCommentReportModal(true);
    };

    const handleCommentClick = (comment) => {
        setSelectedComment(comment);
        setShowCommentDetail(true);
    };

    const handleDeleteComment = (commentId) => {
        setComments(prevComments => {
            const filtered = prevComments.filter(c => c.id_comentario !== commentId);
            if (filtered.length < prevComments.length) return filtered;

            return prevComments.map(c => ({
                ...c,
                respostas: (c.respostas || []).filter(r => r.id_comentario !== commentId)
            }));
        });
    };

    const handleUpdateComment = (commentId, newText) => {
        setComments(prevComments =>
            prevComments.map(c => {
                if (c.id_comentario === commentId) {
                    return { ...c, conteudo_texto: newText, editado: true };
                }
                if (c.respostas) {
                    return {
                        ...c,
                        respostas: c.respostas.map(r =>
                            r.id_comentario === commentId
                                ? { ...r, conteudo_texto: newText, editado: true }
                                : r
                        )
                    };
                }
                return c;
            })
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatRelativeDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('post.timeJustNow');
        if (diffMins < 60) return `${diffMins}${t('post.timeMins')}`;
        if (diffHours < 24) return `${diffHours}${t('post.timeHours')}`;
        if (diffDays < 7) return `${diffDays}${t('post.timeDays')}`;
        return date.toLocaleDateString('pt-BR');
    };

    const isOwner = post?.usuario?.id_usuario === user?.id_usuario;

    // Filter comments for display (separate spam)
    const displayComments = comments.filter(c => !c.is_spam);
    const spamComments = comments.filter(c => c.is_spam);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0f0d1a] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0f0d1a] flex flex-col items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{error || t('post.errNotFound')}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-primary hover:underline"
                >
                    {t('post.btnBack')}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-cosmic-bg transition-colors duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-cosmic-bg/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <FaArrowLeft className="text-gray-800 dark:text-white" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('post.pageTitle')}</h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-2xl mx-auto">
                {/* Post */}
                <div className="bg-white dark:bg-white/5 border-b border-gray-200 dark:border-white/5 p-6 backdrop-blur-sm rounded-none sm:rounded-2xl sm:my-4 transition-all hover:bg-white/90">
                    {/* User Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Link to={`/user/${post.usuario?.id_usuario}`}>
                                <img
                                    src={post.usuario?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                    alt={post.usuario?.nome_completo}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        to={`/user/${post.usuario?.id_usuario}`}
                                        className="font-bold text-gray-900 dark:text-white hover:underline"
                                    >
                                        {post.usuario?.nome_completo}
                                    </Link>
                                    {post.visibilidade === 2 && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full text-green-400 text-xs">
                                            <FaUserFriends size={10} />
                                        </div>
                                    )}
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    @{post.usuario?.nome_usuario}
                                    {post.usuario?.privacidade_padrao === 2 && (
                                        <FaLock className="inline ml-1 text-gray-400" size={10} title={t('post.privateAccount', 'Conta Privada')} />
                                    )}
                                </p>
                                {post.comunidade_id && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {t('post.postedInCommunity', 'Post feito na comunidade')}{' '}
                                        <Link
                                            to={`/community/${post.comunidade_id}`}
                                            className="text-purple-500 hover:text-purple-400 font-semibold hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {post.comunidade_nome}
                                        </Link>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <FaEllipsisH className="text-gray-500" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-10 z-20 bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl min-w-[150px]">
                                        {isOwner ? (
                                            <>
                                                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10">
                                                    <FaEdit /> {t('post.menuEdit')}
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <FaTrash /> {t('post.menuDelete')}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleFollowToggle}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                                                >
                                                    {isFollowing ? <><FaUserCheck /> {t('post.actionFollowing', 'Seguindo')}</> : <><FaUserPlus /> {t('post.actionFollow', 'Seguir')}</>}
                                                </button>
                                                <button
                                                    onClick={handleMuteToggle}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                                                >
                                                    <FaVolumeMute /> {isMuted ? t('post.actionUnmute', 'Desilenciar') : t('post.actionMute', 'Silenciar')}
                                                </button>
                                                <button
                                                    onClick={handleBlockToggle}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <FaBan /> {isBlocked ? t('post.actionUnblock', 'Desbloquear') : t('post.actionBlock', 'Bloquear')}
                                                </button>
                                                <button
                                                    onClick={() => { setShowReportModal(true); setShowMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                >
                                                    <FaFlag /> {t('post.menuReport')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    {post.titulo && (
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                            {post.titulo}
                        </h2>
                    )}

                    {/* Content */}
                    <p className="text-gray-900 dark:text-gray-100 text-lg leading-relaxed whitespace-pre-wrap mb-4">
                        <RenderMentions text={post.conteudo_texto} />
                    </p>

                    {/* Image */}
                    {post.imagem && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
                            <img src={post.imagem} alt="Post visual" className="w-full h-auto" />
                        </div>
                    )}

                    {/* Video */}
                    {post.video && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/5">
                            <video
                                src={post.video}
                                controls
                                className="w-full h-auto max-h-[600px] object-contain"
                                preload="metadata"
                            >
                                {t('post.videoNotSupported')}
                            </video>
                        </div>
                    )}

                    {/* Emotions */}
                    {post.emocoes_sentidas && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {post.emocoes_sentidas.split(',').map((emocao, index) => (
                                <span key={index} className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full text-sm text-gray-600 dark:text-gray-300">
                                    {emocao.trim()}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 border-b border-gray-200 dark:border-white/5 pb-4">
                        {formatDate(post.data_publicacao)}
                    </p>

                    {/* Stats Bar */}
                    <div className="flex gap-6 mb-4">
                        <span className="text-gray-900 dark:text-white">
                            <strong>{likesCount}</strong> <span className="text-gray-500">{t('post.likesCount')}</span>
                        </span>
                        <span className="text-gray-900 dark:text-white">
                            <strong>{post.comentarios_count || 0}</strong> <span className="text-gray-500">{t('post.commentsCount')}</span>
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-around py-2 border-t border-gray-200 dark:border-white/10">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 p-2 transition-colors ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                        >
                            {liked ? <FaHeart size={20} /> : <FaRegHeart size={20} />}
                        </button>
                        <button
                            onClick={() => handleReply(null)}
                            className="flex items-center gap-2 p-2 text-gray-500 hover:text-primary transition-colors"
                        >
                            <FaComment size={20} />
                        </button>
                        <button
                            onClick={handleSave}
                            className={`flex items-center gap-2 p-2 transition-colors ${saved ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                        >
                            {saved ? <FaBookmark size={20} /> : <FaRegBookmark size={20} />}
                        </button>
                    </div>
                </div>

                {/* INLINE REPLY COMPOSER - Fixed in flow before comments */}
                <div className="bg-white dark:bg-transparent px-6 sm:px-0 max-w-2xl mx-auto -mt-2 mb-4">
                    <ReplyComposer
                        mode="inline"
                        placeholder={t('post.replyPlaceholder')}
                        currentUser={user}
                        onSubmit={(formData) => handleReplySubmit(formData, null)}
                    />
                </div>

                {/* Comments Section */}
                <div className="bg-white dark:bg-transparent min-h-[300px] border-t border-gray-200 dark:border-white/5 sm:border-t-0">

                    {/* Compact Sort Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('post.commentsTitle')}</h3>
                        <div className="relative">
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full"
                            >
                                {t(`post.sortOptions.${sortBy}`)}
                                <FaChevronDown size={10} />
                            </button>

                            {showSortMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)}></div>
                                    <div className="absolute right-0 top-10 z-20 bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
                                        {SORT_OPTIONS.map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => { setSortBy(option.key); setShowSortMenu(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${sortBy === option.key ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                {t(`post.sortOptions.${option.key}`)}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {commentsLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : displayComments.length === 0 && spamComments.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">{t('post.noComments')}</p>
                            <button
                                onClick={() => document.querySelector('textarea')?.focus()}
                                className="mt-2 text-primary hover:underline"
                            >
                                {t('post.beFirstComment')}
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-white/10">
                            {displayComments.map((comment, index) => (
                                <CommentItem
                                    key={comment.id_comentario}
                                    comment={comment}
                                    dreamId={id}
                                    currentUserId={user?.id_usuario}
                                    postOwnerId={post.usuario?.id_usuario}
                                    postOwnerUsername={post.usuario?.nome_usuario}
                                    onDelete={handleDeleteComment}
                                    onUpdate={handleUpdateComment}
                                    onReplySubmit={handleReplySubmit}
                                    onReport={handleReportComment}
                                    onClick={handleCommentClick}
                                    formatDate={formatRelativeDate}
                                    isLast={index === displayComments.length - 1}
                                    currentUser={user}
                                    activeReplyId={activeReplyId}
                                    setActiveReplyId={setActiveReplyId}
                                />
                            ))}

                            {/* SPAM SECTION */}
                            {spamComments.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-white/5">
                                    <button
                                        onClick={() => setShowSpamArea(!showSpamArea)}
                                        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500">
                                                <FaRobot />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {t('post.probableSpam')}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {spamComments.length} {t('post.hiddenComments')}
                                                </p>
                                            </div>
                                        </div>
                                        <FaChevronDown className={`text-gray-400 transition-transform ${showSpamArea ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showSpamArea && (
                                        <div className="bg-gray-50 dark:bg-black/20 divide-y divide-gray-200 dark:divide-white/5">
                                            {spamComments.map((comment, index) => (
                                                <CommentItem
                                                    key={comment.id_comentario}
                                                    comment={comment}
                                                    dreamId={id}
                                                    currentUserId={user?.id_usuario}
                                                    postOwnerId={post.usuario?.id_usuario}
                                                    postOwnerUsername={post.usuario?.nome_usuario}
                                                    onDelete={handleDeleteComment}
                                                    onUpdate={handleUpdateComment}
                                                    onReplySubmit={handleReplySubmit}
                                                    onReport={handleReportComment}
                                                    onClick={handleCommentClick}
                                                    formatDate={formatRelativeDate}
                                                    isLast={index === spamComments.length - 1}
                                                    currentUser={user}
                                                    activeReplyId={activeReplyId}
                                                    setActiveReplyId={setActiveReplyId}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Deleted ReplyModal */}

            {/* Report Post Modal */}
            <ReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                contentId={post.id_publicacao}
                contentType={1}
            />

            {/* Report Comment Modal */}
            <ReportModal
                isOpen={showCommentReportModal}
                onClose={() => { setShowCommentReportModal(false); setReportingComment(null); }}
                contentId={reportingComment?.id_comentario}
                contentType={2}
            />

            {/* Comment Detail Modal - shows comment like a post */}
            <CommentDetailModal
                isOpen={showCommentDetail}
                onClose={() => { setShowCommentDetail(false); setSelectedComment(null); }}
                comment={selectedComment}
                dreamId={id}
                currentUserId={user?.id_usuario}
                postOwnerId={post?.usuario?.id_usuario}
                onDelete={handleDeleteComment}
                onUpdate={handleUpdateComment}
                onReply={handleReply}
                onReport={handleReportComment}
                formatDate={formatRelativeDate}
            />
        </div>
    );
};

export default PostPage;
