import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMoon, FaImage, FaVideo, FaSmile, FaGlobeAmericas, FaUserFriends } from 'react-icons/fa';
import { RiHourglassLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { createDream, updateDream, getProfile, createDraft } from '../services/api';
import DraftsModal from './DraftsModal';
import MentionTextarea from './MentionTextarea';

const CreateDreamModal = ({ isOpen, onClose, onSuccess, editingDream = null, communityId = null }) => {
    const { t } = useTranslation();
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
    const [showDraftPrompt, setShowDraftPrompt] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
    const [isEfemero, setIsEfemero] = useState(false);

    const dreamTypes = [
        { value: t('createDream.typeLucid'), icon: '✨', color: 'text-purple-400' },
        { value: t('createDream.typeNormal'), icon: '💭', color: 'text-blue-400' },
        { value: t('createDream.typeNightmare'), icon: '😱', color: 'text-red-400' },
        { value: t('createDream.typeRecurring'), icon: '🔄', color: 'text-yellow-400' },
    ];

    const emotionOptions = [
        `😊 ${t('createDream.emotionHappy')}`,
        `😨 ${t('createDream.emotionFear')}`,
        `😮 ${t('createDream.emotionSurprise')}`,
        `😢 ${t('createDream.emotionSad')}`,
        `🤔 ${t('createDream.emotionConfused')}`,
        `😌 ${t('createDream.emotionPeace')}`
    ];

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
            
            // Set existing previews if present
            if (editingDream.imagem) {
                setImagePreview(editingDream.imagem);
            } else {
                setImagePreview(null);
            }
            if (editingDream.video) {
                setVideoPreview(editingDream.video);
            } else {
                setVideoPreview(null);
            }
            
            setSelectedImage(null);
            setSelectedVideo(null);
        } else {
            setContent('');
            setVisibility(1);
            setDreamType('');
            setEmotions([]);
            setImagePreview(null);
            setSelectedImage(null);
            setVideoPreview(null);
            setSelectedVideo(null);
            setIsEfemero(false);
        }
        setError('');
    }, [editingDream, isOpen]);

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError(t('createDream.errorEmpty'));
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('conteudo_texto', content);
        formData.append('visibilidade', visibility);

        if (dreamType) formData.append('tipo_sonho', dreamType);
        if (emotions.length > 0) formData.append('emocoes_sentidas', emotions.join(', '));
        
        if (selectedImage) {
            formData.append('imagem', selectedImage);
        } else if (editingDream && !imagePreview && editingDream.imagem) {
            // Se tinha imagem e agora o preview é nulo, enviamos vazio pra apagar lá
            formData.append('imagem', '');
        }

        if (selectedVideo) {
            formData.append('video', selectedVideo);
        } else if (editingDream && !videoPreview && editingDream.video) {
             // Se tinha video e agora o preview é nulo, enviamos vazio pra apagar
            formData.append('video', '');
        }

        if (communityId) formData.append('comunidade', communityId);
        if (isEfemero && !editingDream) formData.append('is_efemero', true);

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
            setError(t('createDream.errorPublish'));
        } finally {
            setLoading(false);
        }
    };

    const handleAttemptClose = () => {
        if (!editingDream && (content.trim() || selectedImage || selectedVideo || dreamType || emotions.length > 0)) {
            setShowDraftPrompt(true);
        } else {
            onClose();
        }
    };

    const handleSaveDraft = async () => {
        if (savingDraft) return;
        setSavingDraft(true);
        try {
            const formData = new FormData();
            formData.append('conteudo_texto', content);
            if (dreamType) formData.append('tipo_sonho', dreamType);
            if (emotions.length > 0) formData.append('emocoes_sentidas', emotions.join(', '));
            if (communityId) formData.append('comunidade', communityId);
            if (selectedImage) formData.append('imagem', selectedImage);

            await createDraft(formData);
            
            setShowDraftPrompt(false);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving draft:', err);
        } finally {
            setSavingDraft(false);
        }
    };

    const handleDiscard = () => {
        setShowDraftPrompt(false);
        onClose();
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
                onClick={handleAttemptClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: -20 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-w-xl ${isEfemero ? 'dream-bubble text-white shadow-lg shadow-[#00CED1]/20' : 'bg-gray-900 rounded-2xl border border-white/10'}`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <button
                            onClick={handleAttemptClose}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <FaTimes className="text-white text-lg" />
                        </button>
                        <button 
                            onClick={() => setIsDraftsModalOpen(true)}
                            className="text-primary text-sm font-medium hover:underline"
                        >
                            {t('createDream.drafts')}
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
                                            <><FaGlobeAmericas size={12} /> {t('createDream.visPublic')}</>
                                        ) : (
                                            <><FaUserFriends size={12} /> {t('createDream.visFriends')}</>
                                        )}
                                        <span className="text-xs">▼</span>
                                    </button>

                                    {showVisibilityMenu && (
                                        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 min-w-[200px] py-2">
                                            <p className="px-4 py-2 text-white font-semibold text-sm">{t('createDream.whoCanSee')}</p>
                                            <button
                                                onClick={() => { setVisibility(1); setShowVisibilityMenu(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 ${visibility === 1 ? 'text-primary' : 'text-white'}`}
                                            >
                                                <FaGlobeAmericas /> {t('createDream.visPublic')}
                                                {visibility === 1 && <span className="ml-auto">✓</span>}
                                            </button>
                                            <button
                                                onClick={() => { setVisibility(2); setShowVisibilityMenu(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 ${visibility === 2 ? 'text-primary' : 'text-white'}`}
                                            >
                                                <FaUserFriends /> {t('createDream.visFriends')}
                                                {visibility === 2 && <span className="ml-auto">✓</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Textarea */}
                                <MentionTextarea
                                    value={content}
                                    onChange={(val) => setContent(val)}
                                    placeholder={t('createDream.placeholder')}
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
                                    title={t('createDream.dreamType')}
                                >
                                    <FaMoon size={18} />
                                </button>
                                {showTypeMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 py-2 min-w-[160px]">
                                        <p className="px-4 py-2 text-gray-400 text-xs uppercase">{t('createDream.dreamType')}</p>
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
                                    title={t('createDream.emotions')}
                                >
                                    <FaSmile size={18} />
                                </button>
                                {showEmotionsMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 py-2 min-w-[220px]">
                                        <p className="px-4 py-2 text-gray-400 text-xs uppercase">{t('createDream.emotionsSent')}</p>
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
                                            <p className="text-gray-400 text-xs mb-2">{t('createDream.addCustom')}</p>
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
                                                    placeholder={t('createDream.customPlaceholder')}
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

                            {/* Efêmero (duração) — apenas na criação, não na edição */}
                            {!editingDream && (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsEfemero(!isEfemero)}
                                        className={`p-2 rounded-full transition-colors ${isEfemero ? 'text-white bg-[#00CED1] shadow-md shadow-[#00CED1]/50' : 'text-primary hover:bg-primary/20'}`}
                                        title={isEfemero ? "Desativar post efêmero (24h)" : "Ativar post efêmero (24h)"}
                                    >
                                        <RiHourglassLine size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !content.trim()}
                            className="px-5 py-2 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t('createDream.btnPublishing') : editingDream ? t('createDream.btnSave') : t('createDream.btnDream')}
                        </button>
                    </div>
                </motion.div>

                {/* Drafts Prompt Modal inside AnimatePresence */}
                <AnimatePresence>
                    {showDraftPrompt && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-2xl" onClick={e => e.stopPropagation()}>
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-[#202327] rounded-2xl p-6 max-w-[320px] w-full text-center shadow-xl border border-white/10"
                            >
                                <h3 className="text-xl font-bold text-white mb-2">Salvar post?</h3>
                                <p className="text-gray-400 text-sm mb-6 text-left">
                                    Você pode salvar esse conteúdo nos rascunhos para enviá-lo posteriormente.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={handleDiscard}
                                        className="w-full py-3 rounded-full bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors"
                                    >
                                        Excluir
                                    </button>
                                    <button 
                                        onClick={handleSaveDraft}
                                        disabled={savingDraft}
                                        className="w-full py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-70"
                                    >
                                        {savingDraft ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setShowDraftPrompt(false)}
                                    className="w-full mt-3 py-3 rounded-full font-bold text-gray-400 hover:text-white"
                                >
                                    Cancelar
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <DraftsModal 
                    isOpen={isDraftsModalOpen}
                    onClose={() => setIsDraftsModalOpen(false)}
                    onSelectDraft={(draft) => {
                        setContent(draft.conteudo_texto || '');
                        if (draft.imagem) setImagePreview(draft.imagem);
                        // The draft backend doesn't store dreamType or emotions right now for Rascunhos
                        // We do our best to map what we can
                    }}
                />

            </motion.div>
        </AnimatePresence>
    );
};

export default CreateDreamModal;
