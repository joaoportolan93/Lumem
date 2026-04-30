import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    FaChevronDown, FaFont, FaImage, FaLink, FaPoll, FaQuestionCircle,
    FaTimes, FaPlus, FaBold, FaItalic, FaStrikethrough, FaCode,
    FaListUl, FaListOl, FaQuoteRight, FaUpload
} from 'react-icons/fa';
import {
    getUserCommunities, createDream, getDrafts, createDraft, updateDraft, deleteDraft, getCommunity
} from '../services/api';
import DraftsModal from '../components/DraftsModal';
import MentionTextarea from '../components/MentionTextarea';

const CreatePostPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { communityId } = useParams();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get('draft');

    // State
    const [communities, setCommunities] = useState([]);
    const [selectedCommunity, setSelectedCommunity] = useState(null);
    const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState('texto');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [drafts, setDrafts] = useState([]);
    const [currentDraftId, setCurrentDraftId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);

    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const postTabs = [
        { id: 'texto', label: t('createPost.tabs.text'), icon: FaFont, enabled: true },
        { id: 'multimidia', label: t('createPost.tabs.multimedia'), icon: FaImage, enabled: true },
        { id: 'link', label: t('createPost.tabs.link'), icon: FaLink, enabled: true },
        { id: 'enquete', label: t('createPost.tabs.poll'), icon: FaPoll, enabled: false },
        { id: 'ama', label: t('createPost.tabs.ama'), icon: FaQuestionCircle, enabled: false },
    ];

    // Helper function to insert markdown syntax at cursor position
    const insertMarkdown = (prefix, suffix = '', placeholder = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const textToInsert = selectedText || placeholder;

        const newContent =
            content.substring(0, start) +
            prefix + textToInsert + suffix +
            content.substring(end);

        setContent(newContent);

        // Set cursor position after insertion
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + prefix.length + textToInsert.length + suffix.length;
            textarea.setSelectionRange(
                selectedText ? newCursorPos : start + prefix.length,
                selectedText ? newCursorPos : start + prefix.length + placeholder.length
            );
        }, 0);
    };

    // Toolbar button handlers
    const handleBold = () => insertMarkdown('**', '**', t('createPost.formatting.bold'));
    const handleItalic = () => insertMarkdown('*', '*', t('createPost.formatting.italic'));
    const handleStrikethrough = () => insertMarkdown('~~', '~~', t('createPost.formatting.strikethrough'));
    const handleLink = () => {
        const url = prompt(t('createPost.prompts.enterUrl'));
        if (!url) {
            return;
        }
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            return;
        }
        let safeHref;
        try {
            const parsed = new URL(trimmedUrl, window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                alert(t('createPost.alerts.invalidProtocol'));
                return;
            }
            safeHref = parsed.href;
        } catch (e) {
            alert(t('createPost.alerts.invalidUrl'));
            return;
        }
        insertMarkdown('[', `](${safeHref})`, t('createPost.formatting.linkText'));
    };
    const handleUnorderedList = () => insertMarkdown('\n- ', '', t('createPost.formatting.listItem'));
    const handleOrderedList = () => insertMarkdown('\n1. ', '', t('createPost.formatting.listItem'));
    const handleQuote = () => insertMarkdown('\n> ', '', t('createPost.formatting.quote'));
    const handleCode = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const selectedText = content.substring(textarea.selectionStart, textarea.selectionEnd);
        // Use code block for multiline, inline for single line
        if (selectedText.includes('\n')) {
            insertMarkdown('\n```\n', '\n```\n', t('createPost.formatting.code'));
        } else {
            insertMarkdown('`', '`', t('createPost.formatting.code'));
        }
    };

    // Load communities and drafts on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [communitiesRes, draftsRes] = await Promise.all([
                    getUserCommunities(),
                    getDrafts()
                ]);
                setCommunities(communitiesRes.data.results ? communitiesRes.data.results : communitiesRes.data);
                setDrafts(draftsRes.data.results ? draftsRes.data.results : draftsRes.data);

                // If communityId is in URL, pre-select that community
                if (communityId) {
                    const community = communitiesRes.data.find(c => c.id_comunidade === parseInt(communityId));
                    if (community) {
                        setSelectedCommunity(community);
                    } else {
                        // Try to fetch the community directly
                        try {
                            const commRes = await getCommunity(communityId);
                            setSelectedCommunity(commRes.data);
                        } catch (e) {
                            console.error('Community not found:', e);
                        }
                    }
                }

                // If draftId is in URL, load that draft
                if (draftId) {
                    const draft = draftsRes.data.find(d => d.id_rascunho === parseInt(draftId));
                    if (draft) {
                        loadDraft(draft);
                    }
                }
            } catch (err) {
                console.error('Error loading data:', err);
            }
        };
        loadData();
    }, [communityId, draftId]);

    const loadDraft = (draft) => {
        setTitle(draft.titulo || '');
        setContent(draft.conteudo_texto || '');
        setActiveTab(draft.tipo_post || 'texto');
        setTags(draft.tags || []);
        setCurrentDraftId(draft.id_rascunho);
        if (draft.comunidade) {
            const community = communities.find(c => c.id_comunidade === draft.comunidade);
            if (community) setSelectedCommunity(community);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    const saveDraft = async () => {
        if (!selectedCommunity) {
            setError(t('createPost.errors.selectCommunityDraft'));
            return;
        }

        setSaving(true);
        try {
            const draftData = {
                comunidade: selectedCommunity.id_comunidade,
                titulo: title,
                conteudo_texto: content,
                tipo_post: activeTab,
                tags: tags
            };

            if (currentDraftId) {
                await updateDraft(currentDraftId, draftData);
            } else {
                const res = await createDraft(draftData);
                setCurrentDraftId(res.data.id_rascunho);
            }

            // Refresh drafts list
            const draftsRes = await getDrafts();
            setDrafts(draftsRes.data);
        } catch (err) {
            console.error('Error saving draft:', err);
            setError(t('createPost.errors.saveDraft'));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedCommunity) {
            setError(t('createPost.errors.selectCommunity'));
            return;
        }

        if (!title.trim()) {
            setError(t('createPost.errors.enterTitle'));
            return;
        }

        if (activeTab === 'texto' && !content.trim()) {
            setError(t('createPost.errors.enterContent'));
            return;
        }

        if (activeTab === 'link' && !linkUrl.trim()) {
            setError(t('createPost.errors.enterValidUrl'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('titulo', title);
            formData.append('comunidade', selectedCommunity.id_comunidade);

            if (activeTab === 'texto') {
                formData.append('conteudo_texto', content);
            } else if (activeTab === 'link') {
                formData.append('conteudo_texto', linkUrl);
            } else if (activeTab === 'multimidia') {
                formData.append('conteudo_texto', content || title);
                if (selectedImage) {
                    formData.append('imagem', selectedImage);
                }
            }

            await createDream(formData);

            // Delete draft if it was used
            if (currentDraftId) {
                await deleteDraft(currentDraftId);
            }

            // Navigate back to community
            navigate(`/community/${selectedCommunity.id_comunidade}`);

        } catch (err) {
            console.error('Error creating post:', err);
            setError(t('createPost.errors.publish'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030303] text-white">
            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-semibold text-blue-400">{t('createPost.title')}</h1>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Drafts Link */}
                {drafts.length > 0 && (
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={() => setIsDraftsModalOpen(true)}
                            className="text-red-400 text-sm hover:underline font-bold"
                        >
                            {t('createPost.drafts')} ({drafts.length})
                        </button>
                    </div>
                )}

                {/* Community Selector */}
                <div className="relative mb-6">
                    <button
                        onClick={() => setShowCommunityDropdown(!showCommunityDropdown)}
                        className="flex items-center gap-3 px-4 py-2.5 bg-[#1a1a1b] border border-gray-700 rounded-full hover:border-gray-500 transition-colors min-w-[200px]"
                    >
                        {selectedCommunity ? (
                            <>
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
                                    {selectedCommunity.nome.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm">{selectedCommunity.nome}</span>
                            </>
                        ) : (
                            <span className="text-gray-400 text-sm">{t('createPost.selectCommunity')}</span>
                        )}
                        <FaChevronDown className="ml-auto text-gray-400" size={12} />
                    </button>

                    {showCommunityDropdown && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-full left-0 mt-2 w-72 bg-[#1a1a1b] border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                        >
                            <div className="p-2 border-b border-gray-700">
                                <p className="text-xs text-gray-500 uppercase px-2">{t('createPost.yourCommunities')}</p>
                            </div>
                            {communities.length > 0 ? (
                                communities.map(community => (
                                    <button
                                        key={community.id_comunidade}
                                        onClick={() => {
                                            setSelectedCommunity(community);
                                            setShowCommunityDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold">
                                            {community.nome.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{community.nome}</p>
                                            <p className="text-xs text-gray-500">{community.membros_count} {t('createPost.members')}</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                    {t('createPost.noCommunities')}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Post Type Tabs */}
                <div className="flex border-b border-gray-700 mb-4">
                    {postTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => tab.enabled && setActiveTab(tab.id)}
                            disabled={!tab.enabled}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors relative
                                ${activeTab === tab.id
                                    ? 'text-white'
                                    : tab.enabled
                                        ? 'text-gray-500 hover:text-gray-300'
                                        : 'text-gray-700 cursor-not-allowed'
                                }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg overflow-hidden">
                    {/* Title Input */}
                    <div className="p-4 border-b border-gray-700/50">
                        <div className="relative">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value.slice(0, 300))}
                                placeholder={t('createPost.placeholders.title')}
                                className="w-full bg-transparent text-white placeholder-gray-500 text-base focus:outline-none pr-16"
                            />
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                {title.length}/300
                            </span>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="px-4 py-3 border-b border-gray-700/50">
                        <div className="flex flex-wrap items-center gap-2">
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                                >
                                    {tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-white">
                                        <FaTimes size={10} />
                                    </button>
                                </span>
                            ))}
                            {showTagInput ? (
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={() => { addTag(); setShowTagInput(false); }}
                                    placeholder={t('createPost.placeholders.tag')}
                                    className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-32"
                                    autoFocus
                                />
                            ) : (
                                <button
                                    onClick={() => setShowTagInput(true)}
                                    className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full text-sm transition-colors"
                                >
                                    <FaPlus size={10} />
                                    {t('createPost.buttons.addTags')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'texto' && (
                        <div className="p-4">
                            <MentionTextarea
                                ref={textareaRef}
                                value={content}
                                onChange={(val) => setContent(val)}
                                placeholder={t('createPost.placeholders.text')}
                                className="w-full h-48 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-base leading-relaxed"
                            />

                            {/* Text Formatting Toolbar */}
                            <div className="flex items-center gap-1 pt-4 border-t border-gray-700/50 text-gray-500">
                                <button onClick={handleBold} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.bold')} aria-label={t('createPost.aria.bold')}><FaBold size={14} /></button>
                                <button onClick={handleItalic} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.italic')} aria-label={t('createPost.aria.italic')}><FaItalic size={14} /></button>
                                <button onClick={handleStrikethrough} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.strikethrough')} aria-label={t('createPost.aria.strikethrough')}><FaStrikethrough size={14} /></button>
                                <span className="w-px h-5 bg-gray-700 mx-1" />
                                <button onClick={handleLink} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.link')} aria-label={t('createPost.aria.link')}><FaLink size={14} /></button>
                                <button onClick={handleUnorderedList} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.unorderedList')} aria-label={t('createPost.aria.unorderedList')}><FaListUl size={14} /></button>
                                <button onClick={handleOrderedList} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.orderedList')} aria-label={t('createPost.aria.orderedList')}><FaListOl size={14} /></button>
                                <button onClick={handleQuote} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.quote')} aria-label={t('createPost.aria.quote')}><FaQuoteRight size={14} /></button>
                                <button onClick={handleCode} className="p-2 hover:bg-white/5 hover:text-white rounded transition-colors" title={t('createPost.toolbar.code')} aria-label={t('createPost.aria.code')}><FaCode size={14} /></button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'multimidia' && (
                        <div className="p-4">
                            {imagePreview ? (
                                <div className="relative">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full max-h-96 object-contain rounded-lg"
                                    />
                                    <button
                                        onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                                        className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black"
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-600 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
                                >
                                    <FaUpload className="text-gray-500 mb-3" size={24} />
                                    <p className="text-gray-400 text-sm">
                                        {t('createPost.dragDrop')}
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Optional caption for media */}
                            <MentionTextarea
                                value={content}
                                onChange={(val) => setContent(val)}
                                placeholder={t('createPost.placeholders.caption')}
                                className="w-full h-24 mt-4 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-base border-t border-gray-700/50 pt-4"
                            />
                        </div>
                    )}

                    {activeTab === 'link' && (
                        <div className="p-4">
                            <input
                                type="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder={t('createPost.placeholders.link')}
                                className="w-full bg-transparent text-white placeholder-gray-500 text-base focus:outline-none border-b border-gray-700/50 pb-4 mb-4"
                            />
                            <MentionTextarea
                                value={content}
                                onChange={(val) => setContent(val)}
                                placeholder={t('createPost.placeholders.description')}
                                className="w-full h-24 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-base"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="px-4 pb-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 mt-4">
                    <button
                        onClick={saveDraft}
                        disabled={saving || !selectedCommunity}
                        className="px-5 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {saving ? t('createPost.buttons.saving') : t('createPost.buttons.saveDraft')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedCommunity || !title.trim()}
                        className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('createPost.buttons.publishing') : t('createPost.buttons.publish')}
                    </button>
                </div>
            </div>

            <DraftsModal 
                isOpen={isDraftsModalOpen}
                onClose={() => {
                    setIsDraftsModalOpen(false);
                    // recarregar os rascunhos para atualizar contagem se a modal deletou algum
                    getDrafts().then(res => setDrafts(res.data.results ? res.data.results : res.data));
                }}
                onSelectDraft={loadDraft}
            />

        </div>
    );
};

export default CreatePostPage;
