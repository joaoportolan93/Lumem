/**
 * AdminChatAudit.jsx
 * Painel de auditoria e moderação de chats (admin only)
 * Listar conversas, ver mensagens, moderar, audit log
 */
import React, { useState, useEffect, useCallback } from 'react';
import { FaComments, FaSearch, FaEye, FaFlag, FaUndo, FaHistory, FaChartBar, FaExclamationTriangle, FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import api from '../../services/api';

const AdminChatAudit = () => {
    const [tab, setTab] = useState('conversations'); // conversations, audit-log, stats
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState(null);
    const [selectedConversa, setSelectedConversa] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [chatStats, setChatStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userFilter, setUserFilter] = useState('');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [toast, setToast] = useState(null);
    const [moderateModal, setModerateModal] = useState(null);
    const [moderateMotivo, setModerateMotivo] = useState('');

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchConversations = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/api/admin/chat/conversations/';
            const params = [];
            if (userFilter) params.push(`user=${userFilter}`);
            if (flaggedOnly) params.push('flagged=true');
            if (params.length) url += '?' + params.join('&');
            const res = await api.get(url);
            setConversations(res.data);
        } catch (err) {
            console.error('Erro ao buscar conversas:', err);
        } finally {
            setLoading(false);
        }
    }, [userFilter, flaggedOnly]);

    const fetchMessages = async (conversaId) => {
        setLoading(true);
        try {
            let url = `/api/admin/chat/conversations/${conversaId}/messages/`;
            if (searchKeyword) url += `?q=${searchKeyword}`;
            const res = await api.get(url);
            setMessages(res.data);
            setSelectedConversa(conversaId);
        } catch (err) {
            console.error('Erro ao buscar mensagens:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const res = await api.get('/api/admin/chat/audit-log/');
            setAuditLogs(res.data);
        } catch (err) {
            console.error('Erro ao buscar audit log:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/admin/chat/stats/');
            setChatStats(res.data);
        } catch (err) {
            console.error('Erro ao buscar stats:', err);
        }
    };

    useEffect(() => {
        if (tab === 'conversations' && !selectedConversa) fetchConversations();
        if (tab === 'audit-log') fetchAuditLogs();
        if (tab === 'stats') fetchStats();
    }, [tab, fetchConversations, selectedConversa]);

    const handleModerate = async (msgId, action) => {
        try {
            await api.post(`/api/admin/chat/messages/${msgId}/moderate/`, {
                action,
                motivo: moderateMotivo,
            });
            showToast(action === 'moderate' ? 'Mensagem moderada' : 'Mensagem restaurada');
            setModerateModal(null);
            setModerateMotivo('');
            // Refresh messages
            if (selectedConversa) fetchMessages(selectedConversa);
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao moderar', 'error');
        }
    };

    const backToConversations = () => {
        setSelectedConversa(null);
        setMessages(null);
        setSearchKeyword('');
    };

    const acaoLabels = { view: 'Visualização', moderate: 'Moderação', delete: 'Exclusão', restore: 'Restauração', flag: 'Sinalização', export: 'Exportação' };
    const acaoColors = { view: 'text-blue-400', moderate: 'text-amber-400', delete: 'text-red-400', restore: 'text-green-400', flag: 'text-orange-400', export: 'text-purple-400' };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <FaShieldAlt className="text-amber-500" /> Auditoria de Chat
                </h1>
                <p className="text-gray-400 mt-1">Monitore e modere as conversas da plataforma</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-amber-500/10">
                {[
                    { id: 'conversations', label: 'Conversas', icon: FaComments },
                    { id: 'audit-log', label: 'Log de Auditoria', icon: FaHistory },
                    { id: 'stats', label: 'Estatísticas', icon: FaChartBar },
                ].map(t => (
                    <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'conversations') backToConversations(); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <t.icon /> {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Conversations */}
            {tab === 'conversations' && !selectedConversa && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchConversations()}
                                placeholder="Buscar por usuário..."
                                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-amber-500 focus:outline-none" />
                        </div>
                        <button onClick={() => setFlaggedOnly(!flaggedOnly)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-all ${flaggedOnly ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1a1a1a] text-gray-400 border-gray-700 hover:border-gray-500'}`}>
                            <FaExclamationTriangle /> {flaggedOnly ? 'Moderadas' : 'Todas'}
                        </button>
                        <button onClick={fetchConversations} className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600 transition-colors text-sm">
                            Buscar
                        </button>
                    </div>

                    {/* Conversation list */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <FaComments className="mx-auto text-4xl mb-3 opacity-30" />
                            <p>Nenhuma conversa encontrada</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {conversations.map(c => (
                                <div key={c.id_conversa} className="bg-[#1a1a1a] rounded-xl p-4 border border-amber-500/10 hover:border-amber-500/25 transition-all cursor-pointer group"
                                    onClick={() => fetchMessages(c.id_conversa)}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex -space-x-2">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-[#1a1a1a]">
                                                    {c.usuario_a.nome_usuario.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-[#1a1a1a]">
                                                    {c.usuario_b.nome_usuario.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">
                                                    {c.usuario_a.nome_usuario} <span className="text-gray-500">↔</span> {c.usuario_b.nome_usuario}
                                                </p>
                                                <p className="text-gray-500 text-xs">
                                                    {c.total_mensagens} mensagens • Última: {c.ultima_mensagem_data ? new Date(c.ultima_mensagem_data).toLocaleString('pt-BR') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {c.mensagens_moderadas > 0 && (
                                                <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-medium">
                                                    ⚠ {c.mensagens_moderadas} moderada(s)
                                                </span>
                                            )}
                                            <FaEye className="text-gray-500 group-hover:text-amber-400 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Conversation Messages */}
            {tab === 'conversations' && selectedConversa && messages && (
                <div className="space-y-4">
                    {/* Back button + header */}
                    <div className="flex items-center gap-4">
                        <button onClick={backToConversations} className="p-2 rounded-lg bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-700 hover:border-amber-500 transition-all">
                            <FaArrowLeft />
                        </button>
                        <div>
                            <h2 className="text-white font-semibold text-lg">
                                {messages.conversa.usuario_a} ↔ {messages.conversa.usuario_b}
                            </h2>
                            <p className="text-gray-500 text-sm">{messages.total} mensagens</p>
                        </div>
                    </div>

                    {/* Search within messages */}
                    <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchMessages(selectedConversa)}
                            placeholder="Buscar dentro das mensagens..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-amber-500 focus:outline-none" />
                    </div>

                    {/* Messages */}
                    <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 max-h-[600px] overflow-y-auto">
                        {messages.mensagens.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">Nenhuma mensagem</div>
                        ) : (
                            <div className="divide-y divide-gray-800">
                                {messages.mensagens.map(msg => (
                                    <div key={msg.id_mensagem} className={`p-4 hover:bg-white/5 transition-colors ${msg.moderada ? 'bg-red-500/5 border-l-2 border-red-500' : ''}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-amber-400 font-medium text-sm">{msg.remetente.nome_usuario}</span>
                                                    <span className="text-gray-600 text-xs">→</span>
                                                    <span className="text-gray-400 text-sm">{msg.destinatario.nome_usuario}</span>
                                                    <span className="text-gray-600 text-xs ml-auto">{new Date(msg.data_envio).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <p className={`text-sm ${msg.moderada ? 'text-red-400 line-through' : 'text-gray-300'}`}>
                                                    {msg.conteudo || '[mídia]'}
                                                </p>
                                                {msg.moderada && (
                                                    <p className="text-xs text-red-400/70 mt-1">
                                                        Moderada por {msg.moderada_por} em {new Date(msg.moderada_em).toLocaleString('pt-BR')} — {msg.motivo_moderacao}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                {!msg.moderada ? (
                                                    <button onClick={() => setModerateModal(msg)} className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="Moderar">
                                                        <FaFlag size={12} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleModerate(msg.id_mensagem, 'restore')} className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-all" title="Restaurar">
                                                        <FaUndo size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Audit Log */}
            {tab === 'audit-log' && (
                <div className="space-y-4">
                    {auditLogs.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <FaHistory className="mx-auto text-4xl mb-3 opacity-30" />
                            <p>Nenhum registro de auditoria</p>
                        </div>
                    ) : (
                        <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 divide-y divide-gray-800">
                            {auditLogs.map(log => (
                                <div key={log.id_log} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={`font-medium text-sm ${acaoColors[log.acao]}`}>
                                            {acaoLabels[log.acao]}
                                        </span>
                                        <span className="text-gray-500 text-sm">por</span>
                                        <span className="text-white font-medium text-sm">{log.admin_nome || 'Sistema'}</span>
                                        <span className="text-gray-600 text-xs ml-auto">{new Date(log.data_acao).toLocaleString('pt-BR')}</span>
                                    </div>
                                    {log.detalhes && (
                                        <p className="text-gray-500 text-xs mt-1">{JSON.stringify(log.detalhes)}</p>
                                    )}
                                    {log.ip_address && (
                                        <p className="text-gray-600 text-xs mt-0.5">IP: {log.ip_address}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Stats */}
            {tab === 'stats' && chatStats && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { label: 'Total Conversas', value: chatStats.total_conversas, color: 'from-blue-500 to-blue-600' },
                            { label: 'Total Mensagens', value: chatStats.total_mensagens.toLocaleString(), color: 'from-purple-500 to-purple-600' },
                            { label: 'Últimos 7 dias', value: chatStats.mensagens_ultimos_7_dias.toLocaleString(), color: 'from-green-500 to-green-600' },
                            { label: 'Últimos 30 dias', value: chatStats.mensagens_ultimos_30_dias.toLocaleString(), color: 'from-amber-500 to-orange-600' },
                            { label: 'Moderadas', value: chatStats.mensagens_moderadas, color: 'from-red-500 to-red-600' },
                        ].map((card, i) => (
                            <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-5 shadow-lg`}>
                                <p className="text-white/80 text-sm font-medium">{card.label}</p>
                                <p className="text-2xl font-bold text-white mt-1 font-mono">{card.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Top Conversations */}
                    {chatStats.top_conversas_semana.length > 0 && (
                        <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 p-6">
                            <h3 className="text-white font-semibold text-lg mb-4">Conversas Mais Ativas (Últimos 7 dias)</h3>
                            <div className="space-y-3">
                                {chatStats.top_conversas_semana.map((c, i) => (
                                    <div key={c.id_conversa} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="text-amber-500 font-bold text-lg w-6">#{i + 1}</span>
                                            <span className="text-white">{c.usuario_a} ↔ {c.usuario_b}</span>
                                        </div>
                                        <span className="text-amber-400 font-mono font-bold">{c.msgs_recentes} msgs</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Moderate */}
            {moderateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/20 p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Moderar Mensagem</h2>
                        <div className="bg-black/30 rounded-lg p-3 mb-4">
                            <p className="text-gray-400 text-sm mb-1">De: <span className="text-white">{moderateModal.remetente.nome_usuario}</span></p>
                            <p className="text-gray-300 text-sm">{moderateModal.conteudo}</p>
                        </div>
                        <div className="mb-4">
                            <label className="text-gray-300 text-sm font-medium block mb-1">Motivo da moderação</label>
                            <textarea rows={3} value={moderateMotivo} onChange={(e) => setModerateMotivo(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none resize-none"
                                placeholder="Descreva o motivo..." />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setModerateModal(null); setModerateMotivo(''); }}
                                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => handleModerate(moderateModal.id_mensagem, 'moderate')}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                                <FaFlag /> Moderar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminChatAudit;
