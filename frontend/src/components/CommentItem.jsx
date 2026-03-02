import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaHeart, FaRegHeart, FaBookmark, FaRegBookmark,
    FaEllipsisH, FaEdit, FaTrash, FaTimes, FaCheck,
    FaFlag, FaEye, FaEyeSlash
} from 'react-icons/fa';
import { FaRegComment, FaRetweet } from 'react-icons/fa6';
import { deleteComment, editComment, likeComment } from '../services/api';
import ReplyInput from './ReplyInput';
import { ChildBranch, ParentLine } from './ThreadConnectorSVG';

/**
 * CommentItem - Reddit-style L-Connectors + Twitter/X Icons
 * 
 * ARCHITECTURE:
 * - NO DEPTH LIMITS: Pure infinite recursion
 * - Each child draws its OWN connector (not inherited from parent)
 * - isLast prop controls whether vertical line stops at the L-curve
 * - Inline reply system (NO MODALS)
 */

const CommentItem = ({
    comment,
    dreamId,
    currentUserId,
    postOwnerId,
    onDelete,
    onUpdate,
    onReplySubmit,
    onReport,
    formatDate,
    depth = 0,
    isLast = false,
    currentUser,
    activeReplyId,
    setActiveReplyId
}) => {
    const navigate = useNavigate();

    // Local state
    const [isLiked, setIsLiked] = useState(comment.is_liked || false);
    const [likesCount, setLikesCount] = useState(comment.likes_count || 0);
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.conteudo_texto || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Spam handling
    const isProbableSpam = comment.is_spam || false;
    const [showSpamContent, setShowSpamContent] = useState(!isProbableSpam);

    // Derived values
    const canDelete = comment.can_delete;
    const canEdit = comment.can_edit;
    const hasReplies = comment.respostas && comment.respostas.length > 0;
    const isReplying = activeReplyId === comment.id_comentario;

    // ===== HANDLERS =====
    const toggleReply = () => {
        setActiveReplyId(isReplying ? null : comment.id_comentario);
    };

    const toggleCollapse = (e) => {
        e.stopPropagation();
        setIsCollapsed(!isCollapsed);
    };

    const handleAction = (e, action) => {
        e.stopPropagation();
        action();
    };

    const handleLike = async () => {
        try {
            const response = await likeComment(dreamId, comment.id_comentario);
            setIsLiked(response.data.is_liked);
            setLikesCount(response.data.likes_count);
        } catch (err) {
            console.error('Error liking comment:', err);
        }
    };

    const handleEdit = async () => {
        if (!editText.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await editComment(dreamId, comment.id_comentario, editText.trim());
            onUpdate(comment.id_comentario, editText.trim());
            setIsEditing(false);
        } catch (err) {
            console.error('Error editing comment:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Excluir este comentário?')) return;
        try {
            await deleteComment(dreamId, comment.id_comentario);
            onDelete(comment.id_comentario);
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/post/${dreamId}#comment-${comment.id_comentario}`
            );
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    const handleInlineReplySubmit = async (formData) => {
        await onReplySubmit(formData, comment.id_comentario);
    };

    // ===== RENDER: CONTENT =====
    const renderContent = () => {
        if (!showSpamContent) {
            return (
                <div className="flex items-center gap-3 py-2">
                    <span className="text-gray-500 text-sm italic bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full">
                        Conteúdo marcado como provável spam
                    </span>
                    <button
                        onClick={(e) => handleAction(e, () => setShowSpamContent(true))}
                        className="text-primary text-sm font-semibold hover:underline flex items-center gap-1"
                    >
                        <FaEye size={12} /> Mostrar
                    </button>
                </div>
            );
        }

        return (
            <>
                {isEditing ? (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/20 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
                            rows={3}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleEdit}
                                disabled={isSubmitting || !editText.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-full disabled:opacity-50 transition-colors"
                            >
                                <FaCheck size={12} /> Salvar
                            </button>
                            <button
                                onClick={() => { setIsEditing(false); setEditText(comment.conteudo_texto || ''); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 text-sm rounded-full transition-colors"
                            >
                                <FaTimes size={12} /> Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {comment.conteudo_texto && (
                            <p className="text-gray-900 dark:text-gray-100 text-[15px] mt-1 break-words whitespace-pre-wrap leading-relaxed">
                                {comment.conteudo_texto}
                            </p>
                        )}

                        {(comment.imagem_url || comment.video_url) && (
                            <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 max-w-lg bg-black/5 dark:bg-black/20">
                                {comment.imagem_url && (
                                    <img
                                        src={comment.imagem_url}
                                        alt="Anexo"
                                        className="w-full max-h-80 object-contain hover:opacity-90 transition-opacity cursor-pointer"
                                        onClick={(e) => handleAction(e, () => window.open(comment.imagem_url, '_blank'))}
                                    />
                                )}
                                {comment.video_url && (
                                    <div className="relative group w-full flex justify-center" onClick={(e) => e.stopPropagation()}>
                                        <video
                                            src={comment.video_url}
                                            className="w-full max-h-80 object-contain outline-none"
                                            controls
                                            preload="metadata"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TWITTER/X ACTION BAR */}
                        <div className="flex items-center gap-6 mt-3">
                            <button
                                onClick={(e) => handleAction(e, handleLike)}
                                className={`group flex items-center gap-2 transition-colors ${isLiked ? 'text-red-500' : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
                                    }`}
                            >
                                <div className="p-1.5 rounded-full group-hover:bg-red-500/10 transition-colors">
                                    {isLiked ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
                                </div>
                                {likesCount > 0 && <span className="text-sm">{likesCount}</span>}
                            </button>

                            <button
                                onClick={(e) => handleAction(e, toggleReply)}
                                className={`group flex items-center gap-2 transition-colors ${isReplying ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'
                                    }`}
                            >
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                    <FaRegComment size={16} />
                                </div>
                                {comment.respostas_count > 0 && <span className="text-sm">{comment.respostas_count}</span>}
                            </button>

                            <button
                                onClick={(e) => handleAction(e, () => setIsSaved(!isSaved))}
                                className={`flex items-center gap-2 transition-colors ${isSaved ? 'text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'
                                    }`}
                            >
                                <div className="p-1.5 rounded-full hover:bg-primary/10 transition-colors">
                                    {isSaved ? <FaBookmark size={16} /> : <FaRegBookmark size={16} />}
                                </div>
                            </button>

                            {isProbableSpam && (
                                <button
                                    onClick={(e) => handleAction(e, () => setShowSpamContent(false))}
                                    className="ml-auto text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1"
                                >
                                    <FaEyeSlash />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </>
        );
    };

    // ===== SVG CONNECTORS =====
    // With flat 9px margin per level, the parent's line at 19px is always
    // at 19 - 9 = 10px from the child's left edge
    const branchIndent = 10;

    // ===== MAIN RENDER =====
    return (
        <div
            className="relative"
            style={{ marginLeft: depth > 0 ? '9px' : 0 }}
        >
            {/* SVG L-CONNECTOR: Drawn by this child (depth > 0) */}
            {depth > 0 && (
                <ChildBranch isLast={isLast} indent={branchIndent} />
            )}

            {/* SVG Parent-to-children continuation line — in outer wrapper to extend through children */}
            {hasReplies && !isCollapsed && <ParentLine commentId={comment.id_comentario} />}

            <article
                className="relative hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                id={`comment-${comment.id_comentario}`}
            >

                <div className="flex gap-3 p-4 relative z-10">
                    {/* AVATAR COLUMN */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                        <Link to={`/user/${comment.usuario?.id_usuario}`} onClick={(e) => e.stopPropagation()}>
                            <img
                                src={comment.usuario?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                alt={comment.usuario?.nome_completo}
                                className={`w-10 h-10 rounded-full object-cover border-2 transition-all ${hasReplies && !isCollapsed
                                    ? 'border-blue-400 dark:border-blue-500'
                                    : 'border-gray-200 dark:border-white/10'
                                    }`}
                            />
                        </Link>

                        {hasReplies && (
                            <button
                                onClick={toggleCollapse}
                                className="mt-1 text-[11px] font-mono text-gray-400 hover:text-primary transition-colors"
                                title={isCollapsed ? 'Expandir' : 'Colapsar'}
                            >
                                {isCollapsed ? `[+${comment.respostas?.length || 0}]` : '[-]'}
                            </button>
                        )}
                    </div>

                    {/* CONTENT COLUMN */}
                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 flex-wrap min-w-0">
                                <span
                                    className="font-bold text-gray-900 dark:text-white text-sm truncate hover:underline cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/user/${comment.usuario?.id_usuario}`); }}
                                >
                                    {comment.usuario?.nome_completo}
                                </span>
                                <span className="text-gray-500 text-sm truncate">
                                    @{comment.usuario?.nome_usuario}
                                </span>
                                <span className="text-gray-400 text-sm">·</span>
                                <span className="text-gray-500 text-sm whitespace-nowrap">
                                    {formatDate ? formatDate(comment.data_comentario) : ''}
                                </span>
                            </div>

                            {/* Options Menu */}
                            <div className="relative">
                                <button
                                    onClick={(e) => handleAction(e, () => setShowMenu(!showMenu))}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-all"
                                >
                                    <FaEllipsisH size={14} />
                                </button>

                                {showMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={(e) => handleAction(e, () => setShowMenu(false))} />
                                        <div className="absolute right-0 top-8 z-50 bg-white dark:bg-[#16213e] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]">
                                            {canEdit && (
                                                <button
                                                    onClick={(e) => handleAction(e, () => { setIsEditing(true); setShowMenu(false); })}
                                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                                                >
                                                    <FaEdit size={13} /> Editar
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={(e) => handleAction(e, () => { handleDelete(); setShowMenu(false); })}
                                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-white/5"
                                                >
                                                    <FaTrash size={13} /> Excluir
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleAction(e, () => { if (onReport) onReport(comment); setShowMenu(false); })}
                                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                                            >
                                                <FaFlag size={13} /> Denunciar
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {renderContent()}
                    </div>
                </div>

                {/* INLINE REPLY INPUT (NO MODAL!) */}
                {isReplying && !isCollapsed && (
                    <div onClick={(e) => e.stopPropagation()} className="pl-[56px] pr-4 pb-3">
                        <ReplyInput
                            placeholder="Postar sua resposta"
                            currentUser={currentUser}
                            onSubmit={handleInlineReplySubmit}
                            onCancel={() => setActiveReplyId(null)}
                            autoFocus={true}
                        />
                    </div>
                )}
            </article>

            {/* NESTED REPLIES - INFINITE RECURSION (NO DEPTH LIMIT!) */}
            {hasReplies && !isCollapsed && (
                <div className="relative">
                    {comment.respostas.map((reply, idx) => (
                        <CommentItem
                            key={reply.id_comentario}
                            comment={reply}
                            dreamId={dreamId}
                            currentUserId={currentUserId}
                            postOwnerId={postOwnerId}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            onReplySubmit={onReplySubmit}
                            onReport={onReport}
                            formatDate={formatDate}
                            depth={depth + 1}
                            isLast={idx === comment.respostas.length - 1}
                            currentUser={currentUser}
                            activeReplyId={activeReplyId}
                            setActiveReplyId={setActiveReplyId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommentItem;
