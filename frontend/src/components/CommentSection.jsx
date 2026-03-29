
import React, { useState, useEffect, useRef } from 'react';
import { FaChevronDown, FaSpinner, FaImage, FaVideo, FaTimes } from 'react-icons/fa';
import { FaRegComment } from 'react-icons/fa6';
import { getComments, createComment } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import CommentItem from './CommentItem';

// Sorting options (dropdown, not tabs!)
const SORT_OPTIONS = [
    { key: 'relevance', label: 'Mais Relevantes' },
    { key: 'recent', label: 'Mais Recentes' },
    { key: 'likes', label: 'Mais Curtidos' },
];

/**
 * CommentSection - Twitter/X-style comment section
 * 
 * FEATURES:
 * - Dropdown sorting (NO TABS)
 * - Centralized activeReplyId state (only one reply input at a time)
 * - Pure recursive rendering with no depth limits
 * - Inline reply system (NO MODALS)
 */
const CommentSection = ({
    dreamId,
    currentUserId,
    postOwnerId,
    postOwnerUsername,
    onReportComment,
    currentUser
}) => {
    // State
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // CENTRALIZED: Only ONE reply input can be active at a time
    const [activeReplyId, setActiveReplyId] = useState(null);

    // Sorting dropdown
    const [sortBy, setSortBy] = useState('recent');
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    // Media state for top-level comment
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);

    // Refs
    const inputRef = useRef(null);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const sortDropdownRef = useRef(null);

    // ===== EFFECTS =====
    useEffect(() => {
        fetchComments();
    }, [dreamId, sortBy]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
                setShowSortDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ===== API CALLS =====
    const fetchComments = async () => {
        setLoading(true);
        try {
            const response = await getComments(dreamId, sortBy);
            console.log('API getComments response:', response.data);
            
            let dataArr = [];
            if (response.data && Array.isArray(response.data.results)) {
                dataArr = response.data.results;
            } else if (Array.isArray(response.data)) {
                dataArr = response.data;
            } else {
                console.error("Unrecognized response format:", response.data);
            }
            
            setComments(dataArr);
            setError(null);
        } catch (err) {
            console.error('Error fetching comments:', err);
            setError('Erro ao carregar comentários');
        } finally {
            setLoading(false);
        }
    };

    // ===== HELPERS =====
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    // ===== MEDIA HANDLING =====
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setError('Imagem deve ter no máximo 5MB');
            return;
        }
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setSelectedImage(file);
        setSelectedVideo(null);
        setMediaPreview(URL.createObjectURL(file));
    };

    const handleVideoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            setError('Vídeo deve ter no máximo 50MB');
            return;
        }
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setSelectedVideo(file);
        setSelectedImage(null);
        setMediaPreview(URL.createObjectURL(file));
    };

    const clearMedia = () => {
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setSelectedImage(null);
        setSelectedVideo(null);
        setMediaPreview(null);
    };

    // ===== SUBMIT TOP-LEVEL COMMENT =====
    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((!newComment.trim() && !selectedImage && !selectedVideo) || submitting) return;

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (newComment.trim()) formData.append('conteudo_texto', newComment.trim());
            if (selectedImage) formData.append('imagem', selectedImage);
            if (selectedVideo) formData.append('video', selectedVideo);

            const response = await createComment(dreamId, formData);
            setComments(prev => [response.data, ...prev]);
            setNewComment('');
            clearMedia();
            setError(null);
        } catch (err) {
            console.error('Error creating comment:', err);
            setError('Erro ao enviar comentário');
        } finally {
            setSubmitting(false);
        }
    };

    // ===== HANDLE INLINE REPLY SUBMISSION =====
    const handleReplySubmit = async (formData, parentId) => {
        try {
            formData.append('comentario_pai', parentId);
            const response = await createComment(dreamId, formData);

            // Add reply to the correct position in the tree
            setComments(prev => addReplyToComment(prev, parentId, response.data));

            // Close the reply input (centralized control)
            setActiveReplyId(null);
        } catch (err) {
            console.error('Error submitting reply:', err);
            setError('Erro ao enviar resposta');
        }
    };

    // Recursive helper to add reply to the correct parent
    const addReplyToComment = (comments, parentId, newReply) => {
        return comments.map(c => {
            if (c.id_comentario === parentId) {
                return {
                    ...c,
                    respostas: [...(c.respostas || []), newReply],
                    respostas_count: (c.respostas_count || 0) + 1
                };
            }
            if (c.respostas && c.respostas.length > 0) {
                return {
                    ...c,
                    respostas: addReplyToComment(c.respostas, parentId, newReply)
                };
            }
            return c;
        });
    };

    // ===== DELETE HANDLER (recursive) =====
    const handleDelete = (commentId) => {
        const removeFromTree = (comments) => {
            return comments
                .filter(c => c.id_comentario !== commentId)
                .map(c => ({
                    ...c,
                    respostas: c.respostas ? removeFromTree(c.respostas) : []
                }));
        };
        setComments(prev => removeFromTree(prev));
    };

    // ===== UPDATE HANDLER (recursive) =====
    const handleUpdate = (commentId, newText) => {
        const updateInTree = (comments) => {
            return comments.map(c => {
                if (c.id_comentario === commentId) {
                    return { ...c, conteudo_texto: newText, editado: true };
                }
                if (c.respostas) {
                    return { ...c, respostas: updateInTree(c.respostas) };
                }
                return c;
            });
        };
        setComments(prev => updateInTree(prev));
    };

    const currentSortLabel = SORT_OPTIONS.find(opt => opt.key === sortBy)?.label || 'Mais Recentes';

    // ===== RENDER =====
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 dark:border-white/10"
        >
            {/* ===== DROPDOWN SORTING (Twitter-style) ===== */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 relative" ref={sortDropdownRef}>
                <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <FaRegComment size={14} />
                    <span>{currentSortLabel}</span>
                    <FaChevronDown size={12} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                    {showSortDropdown && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-4 mt-1 bg-white dark:bg-[#16213e] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl py-1 min-w-[200px] z-50"
                        >
                            {SORT_OPTIONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setSortBy(key);
                                        setShowSortDropdown(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${sortBy === key
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ===== NEW COMMENT FORM ===== */}
            <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200 dark:border-white/10">
                <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-purple-500/50 flex-shrink-0 overflow-hidden">
                        {currentUser?.avatar_url && (
                            <img src={currentUser.avatar_url} alt="Você" className="w-full h-full object-cover" />
                        )}
                    </div>

                    <div className="flex-1 space-y-3">
                        <textarea
                            ref={inputRef}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Adicione um comentário..."
                            className="w-full bg-transparent text-gray-900 dark:text-white text-[15px] placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none min-h-[60px]"
                            disabled={submitting}
                            rows={2}
                        />

                        {/* Media Preview */}
                        {mediaPreview && (
                            <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 max-w-xs">
                                {selectedImage && <img src={mediaPreview} alt="Preview" className="max-h-40 object-cover" />}
                                {selectedVideo && <video src={mediaPreview} className="max-h-40 object-cover" controls />}
                                <button
                                    type="button"
                                    onClick={clearMedia}
                                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                                >
                                    <FaTimes size={12} />
                                </button>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/10">
                            <div className="flex gap-1">
                                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                                <button
                                    type="button"
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                                    disabled={submitting}
                                >
                                    <FaImage size={18} />
                                </button>

                                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                                <button
                                    type="button"
                                    onClick={() => videoInputRef.current?.click()}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                                    disabled={submitting}
                                >
                                    <FaVideo size={18} />
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={(!newComment.trim() && !selectedImage && !selectedVideo) || submitting}
                                className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/80 text-white font-bold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {submitting && <FaSpinner className="animate-spin" size={14} />}
                                <span>{submitting ? 'Postando...' : 'Postar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* ===== ERROR MESSAGE ===== */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 py-2 bg-red-500/10 border-b border-red-500/20"
                    >
                        <p className="text-red-400 text-sm">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== LOADING STATE ===== */}
            {loading && (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* ===== EMPTY STATE ===== */}
            {!loading && comments.length === 0 && (
                <div className="text-center py-12 px-4">
                    <p className="text-gray-400 text-lg mb-2">Nenhum comentário ainda</p>
                    <p className="text-gray-500 text-sm">Seja o primeiro a comentar!</p>
                </div>
            )}

            {/* ===== COMMENTS LIST - PURE RECURSIVE RENDERING ===== */}
            <div className="divide-y divide-gray-200 dark:divide-white/5">
                <AnimatePresence>
                    {comments.map((comment, idx) => (
                        <CommentItem
                            key={comment.id_comentario}
                            comment={comment}
                            dreamId={dreamId}
                            currentUserId={currentUserId}
                            postOwnerId={postOwnerId}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            onReplySubmit={handleReplySubmit}
                            onReport={onReportComment}
                            formatDate={formatDate}
                            depth={0}
                            isLast={idx === comments.length - 1}
                            currentUser={currentUser}
                            // CENTRALIZED STATE: Only ONE reply input at a time
                            activeReplyId={activeReplyId}
                            setActiveReplyId={setActiveReplyId}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default CommentSection;
