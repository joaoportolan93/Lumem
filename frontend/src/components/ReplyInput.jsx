import React, { useState, useRef, useEffect } from 'react';
import { FaImage, FaVideo, FaTimes, FaSpinner } from 'react-icons/fa';

/**
 * ReplyInput - Twitter/X-style inline reply component
 * Auto-focuses on mount and expands as you type
 */
const ReplyInput = ({
    placeholder = "Postar sua resposta",
    onSubmit,
    onCancel,
    currentUser,
    autoFocus = true
}) => {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);

    const textareaRef = useRef(null);
    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);

    // Auto-resize textarea based on content
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text]);

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Imagem deve ter no máximo 5MB');
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
            alert('Vídeo deve ter no máximo 50MB');
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

    const handleSubmit = async () => {
        if ((!text.trim() && !selectedImage && !selectedVideo) || submitting) return;

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (text.trim()) formData.append('conteudo_texto', text.trim());
            if (selectedImage) formData.append('imagem', selectedImage);
            if (selectedVideo) formData.append('video', selectedVideo);

            await onSubmit(formData);

            // Reset
            setText('');
            clearMedia();
        } catch (error) {
            console.error('Error submitting reply:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleKeyDown = (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
        // Escape to cancel
        if (e.key === 'Escape') {
            onCancel?.();
        }
    };

    const canSubmit = text.trim() || selectedImage || selectedVideo;

    return (
        <div className="flex gap-3 py-3 bg-white dark:bg-transparent rounded-lg">
            {/* Avatar */}
            <div className="flex-shrink-0">
                <img
                    src={currentUser?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                    alt="Your avatar"
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-white/10"
                />
            </div>

            {/* Input Area */}
            <div className="flex-1 min-w-0">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-gray-900 dark:text-white text-[15px] placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none overflow-hidden"
                    style={{ minHeight: '40px', maxHeight: '200px' }}
                    rows={1}
                    autoFocus={autoFocus}
                />

                {/* Media Preview */}
                {mediaPreview && (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 max-w-xs mt-2 mb-2">
                        {selectedImage && (
                            <img src={mediaPreview} alt="Preview" className="max-h-48 object-cover w-full" />
                        )}
                        {selectedVideo && (
                            <video src={mediaPreview} className="max-h-48 object-cover w-full" controls />
                        )}
                        <button
                            onClick={clearMedia}
                            className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white transition-colors"
                        >
                            <FaTimes size={12} />
                        </button>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/5 mt-2">
                    {/* Media Buttons */}
                    <div className="flex gap-1">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                            title="Adicionar imagem"
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
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                            title="Adicionar vídeo"
                        >
                            <FaVideo size={18} />
                        </button>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className={`px-4 py-1.5 font-bold text-sm rounded-full transition-all flex items-center gap-2 ${canSubmit
                            ? 'bg-primary hover:bg-primary/90 text-white'
                            : 'bg-gray-300 dark:bg-white/10 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {submitting && <FaSpinner className="animate-spin" size={12} />}
                        {submitting ? 'Enviando...' : 'Responder'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReplyInput;
