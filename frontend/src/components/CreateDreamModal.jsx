import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMoon, FaImage, FaVideo, FaSmile, FaGlobeAmericas, FaUserFriends } from 'react-icons/fa';
import { createDream, updateDream, getProfile } from '../services/api';

const CreateDreamModal = ({ isOpen, onClose, onSuccess, editingDream = null, communityId = null }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState(1); // Default Public
    const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
    const [dreamType, setDreamType] = useState('');
    const [showTypeMenu, setShowTypeMenu] = useState(false);
    const [emotions, setEmotions] = useState([]);
    const [showEmotionsMenu, setShowEmotionsMenu] = useState(false);
    const [customEmotion, setCustomEmotion] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);

    const dreamTypes = [
        { value: 'Lúcido', icon: '✨', color: 'text-purple-400' },
        { value: 'Normal', icon: '💭', color: 'text-blue-400' },
        { value: 'Pesadelo', icon: '😱', color: 'text-red-400' },
        { value: 'Recorrente', icon: '🔄', color: 'text-yellow-400' },
    ];

    const emotionOptions = ['😊 Feliz', '😨 Medo', '😮 Surpresa', '😢 Triste', '🤔 Confuso', '😌 Paz'];

    useEffect(() => {
        getProfile().then(res => setUser(res.data)).catch(console.error);
    }, []);

    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);

    useEffect(() => {
        if (editingDream) {
            setContent(editingDream.conteudo_texto || '');
            setVisibility(editingDream.visibilidade || 1);
            setDreamType(editingDream.tipo_sonho || '');
            setEmotions(editingDream.emocoes_sentidas ? editingDream.emocoes_sentidas.split(',').map(e => e.trim()) : []);
            // TODO: Handle existing image preview if needed
        } else {
            setContent('');
            setVisibility(1);
            setDreamType('');
            setEmotions([]);
            setImagePreview(null);
            setSelectedImage(null);
            setVideoPreview(null);
            setSelectedVideo(null);
        }
        setError('');
    }, [editingDream, isOpen]);

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError('Conte sobre seu sonho antes de publicar.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('conteudo_texto', content);
        formData.append('visibilidade', visibility);

        if (dreamType) formData.append('tipo_sonho', dreamType);
        if (emotions.length > 0) formData.append('emocoes_sentidas', emotions.join(', '));
        if (selectedImage) formData.append('imagem', selectedImage);
        if (selectedVideo) formData.append('video', selectedVideo);
        if (communityId) formData.append('comunidade', communityId);

        try {
            if (editingDream) {
                await updateDream(editingDream.id_publicacao, formData);
            } else {
                await createDream(formData);
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving dream:', err);
            setError('Erro ao publicar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
            // Reset video if image selected
            setSelectedVideo(null);
            setVideoPreview(null);
        }
    };

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedVideo(file);
            setVideoPreview(URL.createObjectURL(file));
            // Reset image if video selected
            setSelectedImage(null);
            setImagePreview(null);
        }
    };

    const toggleEmotion = (emotion) => {
        setEmotions(prev =>
            prev.includes(emotion)
                ? prev.filter(e => e !== emotion)
                : [...prev, emotion]
        );
    };

    const handleAddCustomEmotion = () => {
        const trimmed = customEmotion.trim();
        if (trimmed && !emotions.includes(trimmed)) {
            setEmotions(prev => [...prev, trimmed]);
            setCustomEmotion('');
        }
    };


    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh] px-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: -20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-900 rounded-2xl w-full max-w-xl border border-white/10"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <FaTimes className="text-white text-lg" />
                        </button>
                        <button className="text-primary text-sm font-medium hover:underline">
                            Rascunhos
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="p-4">
                        <div className="flex gap-3">
                            {/* Avatar */}
                            <img
                                src={user?.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                alt="Seu avatar"
                                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                            />

                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                                {/* Visibility Dropdown */}
                                <div className="relative mb-3">
                                    <button
                                        onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/50 text-primary text-sm hover:bg-primary/10 transition-colors"
                                    >
                                        {visibility === 1 ? (
                                            <><FaGlobeAmericas size={12} /> Qualquer pessoa</>
                                        ) : (
                                            <><FaUserFriends size={12} /> Melhores amigos</>
                                        )}
                                        <span className="text-xs">▼</span>
                                    </button>

                                    {showVisibilityMenu && (
                                        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 min-w-[200px] py-2">
                                            <p className="px-4 py-2 text-white font-semibold text-sm">Quem pode ver?</p>
                                            <button
                                                onClick={() => { setVisibility(1); setShowVisibilityMenu(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 ${visibility === 1 ? 'text-primary' : 'text-white'}`}
                                            >
                                                <FaGlobeAmericas /> Qualquer pessoa
                                                {visibility === 1 && <span className="ml-auto">✓</span>}
                                            </button>
                                            <button
                                                onClick={() => { setVisibility(2); setShowVisibilityMenu(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 ${visibility === 2 ? 'text-primary' : 'text-white'}`}
                                            >
                                                <FaUserFriends /> Melhores amigos
                                                {visibility === 2 && <span className="ml-auto">✓</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Textarea */}
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Conte sobre seu sonho..."
                                    className="w-full bg-transparent text-white text-lg placeholder-gray-500 resize-none focus:outline-none min-h-[120px]"
                                    autoFocus
                                />

                                {/* Image Preview */}
                                {imagePreview && (
                                    <div className="relative mt-3 rounded-xl overflow-hidden">
                                        <img src={imagePreview} alt="Preview" className="w-full max-h-80 object-cover rounded-xl" />
                                        <button
                                            onClick={() => { setImagePreview(null); setSelectedImage(null); }}
                                            className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black"
                                        >
                                            <FaTimes className="text-white" />
                                        </button>
                                    </div>
                                )}

                                {videoPreview && (
                                    <div className="relative mt-3 rounded-xl overflow-hidden">
                                        <video src={videoPreview} controls className="w-full max-h-80 object-cover rounded-xl" />
                                        <button
                                            onClick={() => { setVideoPreview(null); setSelectedVideo(null); }}
                                            className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black"
                                        >
                                            <FaTimes className="text-white" />
                                        </button>
                                    </div>
                                )}

                                {/* Selected Tags */}
                                {(dreamType || emotions.length > 0) && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {dreamType && (
                                            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-1">
                                                <FaMoon size={10} /> {dreamType}
                                                <button onClick={() => setDreamType('')} className="ml-1 hover:text-white">×</button>
                                            </span>
                                        )}
                                        {emotions.map(emotion => (
                                            <span key={emotion} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                                                {emotion}
                                                <button onClick={() => toggleEmotion(emotion)} className="ml-1 hover:text-white">×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <p className="text-red-400 text-sm mt-2">{error}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                        <div className="flex items-center gap-1">
                            {/* Image Upload */}
                            <label className="p-2 rounded-full hover:bg-primary/20 text-primary cursor-pointer transition-colors" title="Imagem">
                                <FaImage size={18} />
                                <input type="file" accept="image/*,image/gif" onChange={handleImageUpload} className="hidden" />
                            </label>

                            {/* Video Upload */}
                            <label className="p-2 rounded-full hover:bg-primary/20 text-primary cursor-pointer transition-colors" title="Vídeo">
                                <FaVideo size={18} />
                                <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                            </label>

                            {/* Dream Type */}
                            <div className="relative">
                                <button
                                    onClick={() => { setShowTypeMenu(!showTypeMenu); setShowEmotionsMenu(false); }}
                                    className={`p-2 rounded-full hover:bg-primary/20 transition-colors ${dreamType ? 'text-purple-400' : 'text-primary'}`}
                                    title="Tipo de sonho"
                                >
                                    <FaMoon size={18} />
                                </button>
                                {showTypeMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 py-2 min-w-[160px]">
                                        <p className="px-4 py-2 text-gray-400 text-xs uppercase">Tipo de sonho</p>
                                        {dreamTypes.map(type => (
                                            <button
                                                key={type.value}
                                                onClick={() => { setDreamType(type.value); setShowTypeMenu(false); }}
                                                className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 ${dreamType === type.value ? type.color : 'text-white'}`}
                                            >
                                                <span>{type.icon}</span> {type.value}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Emotions */}
                            <div className="relative">
                                <button
                                    onClick={() => { setShowEmotionsMenu(!showEmotionsMenu); setShowTypeMenu(false); }}
                                    className={`p-2 rounded-full hover:bg-primary/20 transition-colors ${emotions.length > 0 ? 'text-yellow-400' : 'text-primary'}`}
                                    title="Emoções"
                                >
                                    <FaSmile size={18} />
                                </button>
                                {showEmotionsMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 py-2 min-w-[220px]">
                                        <p className="px-4 py-2 text-gray-400 text-xs uppercase">Emoções sentidas</p>
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {emotionOptions.map(emotion => (
                                                <button
                                                    key={emotion}
                                                    onClick={(e) => { e.preventDefault(); toggleEmotion(emotion); }}
                                                    className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 ${emotions.includes(emotion) ? 'text-primary' : 'text-white'}`}
                                                >
                                                    {emotion}
                                                    {emotions.includes(emotion) && <span className="ml-auto">✓</span>}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="px-4 py-2 mt-1 border-t border-white/10">
                                            <p className="text-gray-400 text-xs mb-2">Adicionar personalizada</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={customEmotion}
                                                    onChange={(e) => setCustomEmotion(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddCustomEmotion();
                                                        }
                                                    }}
                                                    placeholder="Ex: Saudade"
                                                    className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary"
                                                />
                                                <button
                                                    onClick={(e) => { e.preventDefault(); handleAddCustomEmotion(); }}
                                                    disabled={!customEmotion.trim()}
                                                    className="px-2 py-1 bg-primary text-white rounded text-sm hover:bg-primary/80 disabled:opacity-50"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !content.trim()}
                            className="px-5 py-2 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Publicando...' : editingDream ? 'Salvar' : 'Sonhar'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateDreamModal;
