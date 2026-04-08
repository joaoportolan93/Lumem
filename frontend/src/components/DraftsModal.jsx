import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaTrash } from 'react-icons/fa';
import { getDrafts, deleteDraft } from '../services/api';

const DraftsModal = ({ isOpen, onClose, onSelectDraft }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadDrafts();
        }
    }, [isOpen]);

    const loadDrafts = async () => {
        setLoading(true);
        try {
            const res = await getDrafts();
            setDrafts(res.data.results ? res.data.results : res.data);
        } catch (error) {
            console.error('Error fetching drafts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        // Optimistic delete
        setDrafts(drafts.filter(d => d.id_rascunho !== id));
        try {
            await deleteDraft(id);
        } catch (error) {
            console.error('Error deleting draft:', error);
            // Revert if error
            loadDrafts();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: -20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-900 rounded-2xl w-full max-w-md border border-white/10 overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <h2 className="text-white font-bold text-lg">Rascunhos</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                            <FaTimes />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center p-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : drafts.length === 0 ? (
                            <p className="text-gray-400 text-center py-6">Nenhum rascunho salvo.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {drafts.map(draft => (
                                    <div 
                                        key={draft.id_rascunho}
                                        onClick={() => {
                                            onSelectDraft(draft);
                                            onClose();
                                        }}
                                        className="bg-[#202327] rounded-xl p-4 border border-white/5 cursor-pointer hover:border-primary/50 transition-colors group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-white truncate pr-4 text-sm">
                                                {draft.titulo || draft.conteudo_texto?.substring(0, 40) || 'Sem conteúdo'}
                                                {!draft.titulo && draft.conteudo_texto?.length > 40 && '...'}
                                            </h3>
                                            <button 
                                                onClick={(e) => handleDelete(e, draft.id_rascunho)}
                                                className="text-gray-500 hover:text-red-500 transition-colors shrink-0 p-1 opacity-50 group-hover:opacity-100"
                                                title="Excluir"
                                            >
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                        {draft.titulo && draft.conteudo_texto && (
                                            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                                                {draft.conteudo_texto}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-2 uppercase font-semibold">
                                            <span>
                                                {new Date(draft.data_atualizacao).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            {draft.tipo_post && (
                                                <span className="bg-white/5 px-2 py-0.5 rounded text-primary/80">
                                                    {draft.tipo_post}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DraftsModal;
