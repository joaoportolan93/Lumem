import React, { useState, useRef, useEffect } from 'react';
import { FaImage, FaVideo, FaSmile, FaSpinner, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import MentionTextarea from './MentionTextarea';

const ReplyComposer = ({
    mode = 'modal', // 'inline' | 'modal'
    placeholder = 'Postar sua resposta',
    onFocus,
    onBlur,
    onSubmit,
    currentUser,
    avatarUrl,
    autoFocus = false,
    hasThreadConnection = false // New prop to show a connection line from above
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Media state
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaError, setMediaError] = useState(null);

    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Determines if the composer should be in expanded state
    const isExpanded = mode === 'modal' || isFocused || text.length > 0 || mediaPreview;

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    const handleFocus = (e) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
    };

    // Handle clicks outside to collapse if empty (optional UX enhancement)
    // For now we rely on onBlur or manual collapse logic if requested, 
    // but typically "Expand on Focus" stays expanded until submission or explicit cancel.

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setMediaError('Imagem deve ter no máximo 5MB');
            return;
        }

        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setSelectedImage(file);
        setSelectedVideo(null);
        setMediaPreview(URL.createObjectURL(file));
        setMediaError(null);
    };

    const handleVideoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            setMediaError('Vídeo deve ter no máximo 50MB');
            return;
        }

        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setSelectedVideo(file);
        setSelectedImage(null);
        setMediaPreview(URL.createObjectURL(file));
        setMediaError(null);
    };

    const clearMedia = () => {
        setSelectedImage(null);
        setSelectedVideo(null);
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setMediaPreview(null);
        setMediaError(null);
    };

    const handleSubmit = async () => {
        if ((!text.trim() && !selectedImage && !selectedVideo) || submitting) return;

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (text.trim()) formData.append('conteudo_texto', text.trim());
            if (selectedImage) formData.append('imagem', selectedImage);
            if (selectedVideo) formData.append('video', selectedVideo);

            await onSubmit(formData);

            // Reset state
            setText('');
            clearMedia();
            if (mode === 'inline') {
                setIsFocused(false);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = text.trim() || selectedImage || selectedVideo;

    return (
        <div className={`flex gap-3 items-start ${mode === 'inline' ? 'py-4 border-b border-gray-200 dark:border-white/5' : ''}`}>

            {/* Avatar Column */}
            <div className="flex flex-col items-center flex-shrink-0 relative">
                {/* Visual Thread Connection from above (if requested) */}
                {hasThreadConnection && (
                    <div className="absolute -top-4 w-0.5 h-4 bg-gray-200 dark:bg-white/10" />
                )}

                <img
                    src={currentUser?.avatar_url || avatarUrl || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                    alt="Current user"
                    className="w-10 h-10 rounded-full object-cover z-10"
                />
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0">
                {/* Input Container - Animates Height */}
                <div
                    className={`transition-all duration-200 ease-out bg-transparent ${mode === 'inline' && !isExpanded ? 'opacity-80' : 'opacity-100'
                        }`}
                >
                    <MentionTextarea
                        ref={textareaRef}
                        value={text}
                        onChange={(val) => setText(val)}
                        onFocus={handleFocus}
                        placeholder={placeholder}
                        className={`w-full bg-transparent text-gray-900 dark:text-white text-lg placeholder-gray-500 resize-none focus:outline-none overflow-hidden transition-all duration-200 ease-out`}
                        style={{
                            minHeight: mode === 'inline' && !isExpanded ? '24px' : '80px',
                        }}
                        rows={1}
                        autoFocus={autoFocus}
                    />
                </div>

                {/* Media Preview */}
                <AnimatePresence>
                    {mediaPreview && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 max-w-xs mt-3 mb-3"
                        >
                            {selectedImage && (
                                <img src={mediaPreview} alt="Preview" className="max-h-48 object-cover w-full" />
                            )}
                            {selectedVideo && (
                                <video src={mediaPreview} className="max-h-48 object-cover w-full" controls />
                            )}
                            <button
                                type="button"
                                onClick={clearMedia}
                                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white transition-colors"
                            >
                                <FaTimes size={14} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {mediaError && <p className="text-red-400 text-sm mt-2 mb-2">{mediaError}</p>}

                {/* Toolbar - Fade In on Focus/Expand */}
                <AnimatePresence>
                    {(isExpanded) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5 mt-2"
                        >
                            <div className="flex gap-1">
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                                    title="Media"
                                >
                                    <FaImage size={18} />
                                </button>

                                <input
                                    ref={videoInputRef}
                                    type="file"
                                    accept="video/*"
                                    onChange={handleVideoSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => videoInputRef.current?.click()}
                                    className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                                    title="Video"
                                >
                                    <FaVideo size={18} />
                                </button>

                                <button className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors">
                                    <FaSmile size={18} />
                                </button>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit || submitting}
                                className={`px-5 py-2 font-bold rounded-full transition-all duration-200 flex items-center gap-2 ${canSubmit
                                        ? 'bg-primary hover:bg-primary/90 text-white'
                                        : 'bg-primary/50 text-white/50 cursor-not-allowed'
                                    }`}
                            >
                                {submitting && <FaSpinner className="animate-spin" size={14} />}
                                {submitting ? 'Enviando' : 'Responder'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ReplyComposer;
