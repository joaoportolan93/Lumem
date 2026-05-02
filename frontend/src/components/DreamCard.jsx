import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaEllipsisH, FaEdit, FaTrash, FaUserFriends, FaFlag, FaBookmark, FaRegBookmark, FaUserPlus, FaUserCheck, FaBan, FaVolumeMute, FaLock } from 'react-icons/fa';
import { FaRegComment, FaRetweet } from 'react-icons/fa6';
import { RiHourglassLine } from 'react-icons/ri';
import { deleteDream, likeDream, saveDream, followUser, unfollowUser, blockUser, unblockUser, muteUser, unmuteUser, viewDream } from '../services/api';
import { AnimatePresence } from 'framer-motion';
import CommentSection from './CommentSection';
import ReportModal from './ReportModal';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

// Pre-process @mentions into markdown links
const processMentions = (text) => {
    if (!text) return text;
    return text.replace(/(?<![\w@])@([A-Za-z0-9_]{1,50})\b/g, '[@$1](/search?q=$1&type=users)');
};

const DreamCard = ({ dream, onDelete, onEdit, currentUserId }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [liked, setLiked] = useState(dream.is_liked || false);
    const [likesCount, setLikesCount] = useState(dream.likes_count || 0);
    const [showMenu, setShowMenu] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [liking, setLiking] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [commentsCount] = useState(dream.comentarios_count || 0);
    const [showReportModal, setShowReportModal] = useState(false);
    const [saved, setSaved] = useState(dream.is_saved || false);
    const [saving, setSaving] = useState(false);

    // Social actions state
    const [isFollowing, setIsFollowing] = useState(dream.usuario?.is_following || false);
    const [isBlocked, setIsBlocked] = useState(dream.usuario?.is_blocked || false);
    const [isMuted, setIsMuted] = useState(dream.usuario?.is_muted || false);

    const cardRef = useRef(null);

    // Registrar view quando o post fica 50% visível na tela
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    viewDream(dream.id_publicacao).catch(() => {});
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [dream.id_publicacao]);

    const isOwner = dream.usuario?.id_usuario === currentUserId;

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('dreamCard.timeNow');
        if (diffMins < 60) return `${diffMins}${t('dreamCard.timeMin')}`;
        if (diffHours < 24) return `${diffHours}${t('dreamCard.timeHr')}`;
        if (diffDays < 7) return `${diffDays}${t('dreamCard.timeDay')}`;
        return date.toLocaleDateString(navigator.language || 'pt-BR');
    };

    const handleLike = async () => {
        if (liking) return;

        // Optimistic UI update
        const wasLiked = liked;
        const prevCount = likesCount;
        setLiked(!wasLiked);
        setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);
        setLiking(true);

        try {
            const response = await likeDream(dream.id_publicacao);
            // Sync with server response
            setLiked(response.data.is_liked);
            setLikesCount(response.data.likes_count);
        } catch (err) {
            // Revert on error
            console.error('Error toggling like:', err);
            setLiked(wasLiked);
            setLikesCount(prevCount);
        } finally {
            setLiking(false);
        }
    };

    const handleSave = async () => {
        if (saving) return;

        const wasSaved = saved;
        setSaved(!wasSaved);
        setSaving(true);

        try {
            const response = await saveDream(dream.id_publicacao);
            setSaved(response.data.is_saved);
        } catch (err) {
            console.error('Error toggling save:', err);
            setSaved(wasSaved);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t('dreamCard.confirmDelete'))) return;

        if (!dream.id_publicacao) {
            console.error('Delete failed: dream.id_publicacao is undefined', dream);
            alert(t('dreamCard.errorDeleteId'));
            return;
        }

        setDeleting(true);
        try {
            console.log('Deleting dream:', dream.id_publicacao);
            await deleteDream(dream.id_publicacao);
            console.log('Dream deleted successfully');
            onDelete?.(dream.id_publicacao);
        } catch (err) {
            console.error('Error deleting dream:', err);
            const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Erro desconhecido';
            alert(`Erro ao excluir o sonho: ${errorMsg}`);
        } finally {
            setDeleting(false);
            setShowMenu(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!dream.usuario?.id_usuario) return;
        const prev = isFollowing;
        setIsFollowing(!prev);
        try {
            if (prev) await unfollowUser(dream.usuario.id_usuario);
            else await followUser(dream.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling follow:', err);
            setIsFollowing(prev);
        }
        setShowMenu(false);
    };

    const handleBlockToggle = async () => {
        if (!window.confirm(isBlocked ? t('dreamCard.confirmUnblock') : t('dreamCard.confirmBlock'))) return;
        if (!dream.usuario?.id_usuario) return;
        const prev = isBlocked;
        setIsBlocked(!prev);
        try {
            if (prev) await unblockUser(dream.usuario.id_usuario);
            else await blockUser(dream.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling block:', err);
            setIsBlocked(prev);
        }
        setShowMenu(false);
    };

    const handleMuteToggle = async () => {
        if (!dream.usuario?.id_usuario) return;
        const prev = isMuted;
        setIsMuted(!prev);
        try {
            if (prev) await unmuteUser(dream.usuario.id_usuario);
            else await muteUser(dream.usuario.id_usuario);
        } catch (err) {
            console.error('Error toggling mute:', err);
            setIsMuted(prev);
        }
        setShowMenu(false);
    };

    const tipoSonhoColors = {
        [t('createDream.typeLucid')]: 'bg-purple-500',
        [t('createDream.typeNightmare')]: 'bg-red-500',
        [t('createDream.typeNormal')]: 'bg-blue-500',
        [t('createDream.typeRecurring')]: 'bg-yellow-500',
        // Fallbacks back to Portuguese defaults just in case old posts have them hardcoded in the DB
        'Lúcido': 'bg-purple-500',
        'Pesadelo': 'bg-red-500',
        'Normal': 'bg-blue-500',
        'Recorrente': 'bg-yellow-500',
    };

    const borderClass = dream.is_efemero
        ? 'border-[#00CED1]/60'
        : dream.visibilidade === 2
            ? 'border-green-500/50'
            : 'border-gray-200 dark:border-white/10';

    const markdownComponents = useMemo(() => ({
        // Custom link styling – internal mention links vs external links
        a: ({ children, href, ...props }) => {
            // Check if it's an internal mention link (starts with /)
            if (href && href.startsWith('/')) {
                return (
                    <span
                        className="text-primary hover:underline font-medium cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigate(href); }}
                    >
                        {children}
                    </span>
                );
            }
            return (
                <a href={href} {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {children}
                </a>
            );
        },
        // Prevent h1-h6 from being too large
        h1: ({ children, ...props }) => <h4 {...props} className="text-lg font-bold mt-2">{children}</h4>,
        h2: ({ children, ...props }) => <h4 {...props} className="text-base font-bold mt-2">{children}</h4>,
        h3: ({ children, ...props }) => <h5 {...props} className="text-sm font-bold mt-2">{children}</h5>,
        // Code block styling
        code: ({ inline, children, ...props }) => (
            inline
                ? <code {...props} className="bg-gray-800 px-1 py-0.5 rounded text-sm text-pink-400">{children}</code>
                : <code {...props} className="block bg-gray-800 p-3 rounded text-sm overflow-x-auto">{children}</code>
        ),
        // Blockquote styling
        blockquote: ({ children, ...props }) => (
            <blockquote {...props} className="border-l-4 border-blue-500 pl-4 italic text-gray-400">{children}</blockquote>
        ),
    }), []);

    return (
        <div ref={cardRef} className={`
            relative group
            bg-white dark:bg-[#1a163a]/95 backdrop-blur-xl
            rounded-2xl p-6
            shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-none
            border ${borderClass}
            hover:shadow-lg hover:border-primary/30 hover:-translate-y-1
            transition-all duration-300 ease-out
        `}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Link to={`/user/${dream.usuario?.id_usuario}`}>
                        <img
                            src={dream.usuario?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                            alt={dream.usuario?.nome_completo}
                            className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-white/10"
                        />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <Link to={`/user/${dream.usuario?.id_usuario}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary transition-colors">
                                {dream.usuario?.nome_completo}
                            </Link>
                            {dream.visibilidade === 2 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full text-green-400 text-xs font-medium" title={t('createDream.visFriends')}>
                                    <FaUserFriends size={10} /> <span>{t('createDream.visFriends')}</span>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            @{dream.usuario?.nome_usuario}
                            {dream.usuario?.privacidade_padrao === 2 && (
                                <FaLock className="inline ml-1 text-gray-400" size={10} title="Conta Privada" />
                            )}
                            {' '}· {formatDate(dream.data_publicacao)}
                        </p>
                        {dream.comunidade_id && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {t('dreamCard.postedInComm')}{' '}
                                <Link
                                    to={`/community/${dream.comunidade_id}`}
                                    className="text-purple-500 hover:text-purple-400 font-semibold hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {dream.comunidade_nome}
                                </Link>
                            </p>
                        )}
                    </div>
                </div>

                {/* Menu */}
                <div className="relative flex items-center gap-2">
                    {/* Indicador efêmero ao lado do menu */}
                    {dream.is_efemero && (
                        <div className="text-[#00CED1] flex items-center gap-1 bg-[#00CED1]/10 px-2 py-1 rounded-full text-xs font-medium" title={t('dreamCard.ephemeralTooltip')}>
                            <RiHourglassLine size={12} />
                            <span>{t('dreamCard.ephemeralLabel')}</span>
                        </div>
                    )}
                    
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <FaEllipsisH className="text-gray-500 dark:text-gray-400" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-10 min-w-[150px]">
                            {isOwner && (
                                <>
                                    {!dream.is_efemero && (
                                    <button
                                        onClick={() => { onEdit?.(dream); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <FaEdit /> {t('dreamCard.actionEdit')}
                                    </button>
                                    )}
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <FaTrash /> {deleting ? t('dreamCard.actionDeleting') : t('dreamCard.actionDelete')}
                                    </button>
                                </>
                            )}
                            {!isOwner && (
                                <>
                                    <button
                                        onClick={handleFollowToggle}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        {isFollowing ? <><FaUserCheck /> {t('dreamCard.actionFollowing')}</> : <><FaUserPlus /> {t('dreamCard.actionFollow')}</>}
                                    </button>
                                    <button
                                        onClick={handleMuteToggle}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <FaVolumeMute /> {isMuted ? t('dreamCard.actionUnmute') : t('dreamCard.actionMute')}
                                    </button>
                                    <button
                                        onClick={handleBlockToggle}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <FaBan /> {isBlocked ? t('dreamCard.actionUnblock') : t('dreamCard.actionBlock')}
                                    </button>
                                    <button
                                        onClick={() => { setShowReportModal(true); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                    >
                                        <FaFlag /> {t('dreamCard.actionReport')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Clickable Content Area */}
            <div
                onClick={(e) => {
                    // Don't navigate if clicking on interactive elements
                    if (e.target.closest('a, button')) return;
                    navigate(`/post/${dream.id_publicacao}`);
                }}
                className="cursor-pointer"
            >
                {/* Type Badge */}
                {dream.tipo_sonho && (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white mb-3 ${tipoSonhoColors[dream.tipo_sonho] || 'bg-gray-500'}`}>
                        {dream.tipo_sonho}
                    </span>
                )}

                {/* Title */}
                {dream.titulo && (
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{dream.titulo}</h3>
                )}

                {/* Content - Markdown Rendered */}
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-2 prose-pre:my-2">
                    <ReactMarkdown components={markdownComponents}>
                        {processMentions(dream.conteudo_texto)}
                    </ReactMarkdown>
                </div>
            </div>

            {/* Image */}
            {dream.imagem && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 dark:border-white/5">
                    <img src={dream.imagem} alt="Dream visual" className="w-full h-auto max-h-[500px] object-cover" />
                </div>
            )}

            {/* Video */}
            {dream.video && (
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 dark:border-white/5 bg-black/5">
                    <video
                        src={dream.video}
                        controls
                        className="w-full h-auto max-h-[500px] object-contain"
                        preload="metadata"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Seu navegador não suporta a tag de vídeo.
                    </video>
                </div>
            )}


            {/* Emotions */}
            {dream.emocoes_sentidas && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {dream.emocoes_sentidas.split(',').map((emocao, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-sm text-gray-600 dark:text-gray-300">
                            {emocao.trim()}
                        </span>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6 pt-4 border-t border-gray-200 dark:border-white/10">
                <button
                    onClick={handleLike}
                    disabled={liking}
                    className={`flex items-center gap-2 transition-colors ${liked ? 'text-red-500' : 'text-gray-500 dark:text-gray-400 hover:text-red-500'}`}
                >
                    {liked ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
                    <span className="text-sm font-medium">{likesCount}</span>
                </button>
                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center gap-2 transition-colors ${showComments ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                >
                    <FaRegComment />
                    <span className="text-sm font-medium">{commentsCount}</span>
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 transition-colors ${saved ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                    title={saved ? t('dreamCard.tooltipUnsave') : t('dreamCard.tooltipSave')}
                >
                    {saved ? <FaBookmark /> : <FaRegBookmark />}
                </button>
            </div>

            <AnimatePresence>
                {showComments && (
                    <CommentSection
                        dreamId={dream.id_publicacao}
                        currentUserId={currentUserId}
                        postOwnerId={dream.usuario?.id_usuario}
                    />
                )}
            </AnimatePresence>

            {/* Report Modal */}
            <ReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                contentId={dream.id_publicacao}
                contentType={1}
            />
        </div>
    );
};

export default DreamCard;
