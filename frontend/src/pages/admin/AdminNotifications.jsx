/**
 * AdminNotifications.jsx
 * Painel de gerenciamento de notificações broadcast (admin only)
 * CRUD completo + envio + config global + estatísticas
 */
import React, { useState, useEffect, useCallback } from 'react';
import { FaBell, FaPaperPlane, FaPlus, FaTrash, FaEdit, FaCog, FaChartBar, FaTimes, FaCheck } from 'react-icons/fa';
import api from '../../services/api';

const AdminNotifications = () => {
    const [tab, setTab] = useState('list'); // list, create, config, stats
    const [notifications, setNotifications] = useState([]);
    const [stats, setStats] = useState(null);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingNotif, setEditingNotif] = useState(null);
    const [formData, setFormData] = useState({
        titulo: '',
        mensagem: '',
        tipo: 'info',
        destinatarios: 'todos',
    });
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/api/admin/notifications/';
            if (statusFilter) url += `?status=${statusFilter}`;
            const res = await api.get(url);
            setNotifications(res.data);
        } catch (err) {
            console.error('Erro ao buscar notificações:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/admin/notifications/stats/');
            setStats(res.data);
        } catch (err) {
            console.error('Erro ao buscar stats:', err);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await api.get('/api/admin/notifications/config/');
            setConfig(res.data);
        } catch (err) {
            console.error('Erro ao buscar config:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        if (tab === 'stats') fetchStats();
        if (tab === 'config') fetchConfig();
    }, [tab]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/admin/notifications/', formData);
            showToast('Notificação criada com sucesso');
            setFormData({ titulo: '', mensagem: '', tipo: 'info', destinatarios: 'todos' });
            setShowModal(false);
            fetchNotifications();
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao criar', 'error');
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.patch(`/api/admin/notifications/${editingNotif.id_notificacao}/`, formData);
            showToast('Notificação atualizada');
            setEditingNotif(null);
            setShowModal(false);
            fetchNotifications();
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao atualizar', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir esta notificação?')) return;
        try {
            await api.delete(`/api/admin/notifications/${id}/`);
            showToast('Notificação excluída');
            fetchNotifications();
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao excluir', 'error');
        }
    };

    const handleSend = async (id) => {
        if (!window.confirm('Enviar esta notificação para todos os usuários? Esta ação não pode ser desfeita.')) return;
        setSending(id);
        try {
            await api.post(`/api/admin/notifications/${id}/send/`);
            showToast('Envio iniciado em background');
            setTimeout(() => fetchNotifications(), 2000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Erro ao enviar', 'error');
        } finally {
            setSending(null);
        }
    };

    const handleConfigUpdate = async (field, value) => {
        try {
            await api.patch('/api/admin/notifications/config/', { [field]: value });
            setConfig(prev => ({ ...prev, [field]: value }));
            showToast('Configuração atualizada');
        } catch (err) {
            showToast('Erro ao atualizar configuração', 'error');
        }
    };

    const openCreateModal = () => {
        setEditingNotif(null);
        setFormData({ titulo: '', mensagem: '', tipo: 'info', destinatarios: 'todos' });
        setShowModal(true);
    };

    const openEditModal = (notif) => {
        setEditingNotif(notif);
        setFormData({
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            tipo: notif.tipo,
            destinatarios: notif.destinatarios,
        });
        setShowModal(true);
    };

    const tipoLabels = { info: 'Informação', alerta: 'Alerta', promo: 'Promoção', atualizacao: 'Atualização', manutencao: 'Manutenção' };
    const tipoColors = { info: 'bg-blue-500/20 text-blue-400', alerta: 'bg-amber-500/20 text-amber-400', promo: 'bg-green-500/20 text-green-400', atualizacao: 'bg-purple-500/20 text-purple-400', manutencao: 'bg-red-500/20 text-red-400' };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-medium transition-all ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FaBell className="text-amber-500" /> Notificações Push
                    </h1>
                    <p className="text-gray-400 mt-1">Gerencie notificações broadcast e push notifications</p>
                </div>
                <button onClick={openCreateModal} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    <FaPlus /> Nova Notificação
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-amber-500/10">
                {[
                    { id: 'list', label: 'Notificações', icon: FaBell },
                    { id: 'stats', label: 'Estatísticas', icon: FaChartBar },
                    { id: 'config', label: 'Configurações', icon: FaCog },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <t.icon /> {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: List */}
            {tab === 'list' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex gap-2">
                        {['', 'rascunho', 'enviada'].map(f => (
                            <button key={f} onClick={() => setStatusFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === f ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#1a1a1a] text-gray-400 border border-transparent hover:border-gray-600'}`}>
                                {f === '' ? 'Todas' : f === 'rascunho' ? 'Rascunhos' : 'Enviadas'}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <FaBell className="mx-auto text-4xl mb-3 opacity-30" />
                            <p>Nenhuma notificação encontrada</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map(n => (
                                <div key={n.id_notificacao} className="bg-[#1a1a1a] rounded-xl p-5 border border-amber-500/10 hover:border-amber-500/25 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoColors[n.tipo]}`}>
                                                    {tipoLabels[n.tipo]}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${n.enviada ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                    {n.enviada ? '✓ Enviada' : 'Rascunho'}
                                                </span>
                                            </div>
                                            <h3 className="text-white font-semibold text-lg">{n.titulo}</h3>
                                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{n.mensagem}</p>
                                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                                <span>Criada em: {new Date(n.data_criacao).toLocaleString('pt-BR')}</span>
                                                {n.enviada && <span>Enviada em: {new Date(n.data_envio).toLocaleString('pt-BR')}</span>}
                                                {n.enviada && <span>Total enviados: {n.total_enviados}</span>}
                                                <span>Por: {n.criado_por_nome || 'Admin'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {!n.enviada && (
                                                <>
                                                    <button onClick={() => handleSend(n.id_notificacao)} disabled={sending === n.id_notificacao}
                                                        className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50" title="Enviar">
                                                        {sending === n.id_notificacao ? <div className="animate-spin h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full" /> : <FaPaperPlane />}
                                                    </button>
                                                    <button onClick={() => openEditModal(n)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="Editar">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => handleDelete(n.id_notificacao)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Excluir">
                                                        <FaTrash />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Stats */}
            {tab === 'stats' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Broadcasts */}
                    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10 space-y-4">
                        <h3 className="text-white font-semibold text-lg flex items-center gap-2"><FaPaperPlane className="text-amber-500" /> Broadcasts</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white font-mono font-bold">{stats.broadcasts.total}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Enviadas</span><span className="text-green-400 font-mono font-bold">{stats.broadcasts.enviadas}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Rascunhos</span><span className="text-gray-300 font-mono font-bold">{stats.broadcasts.rascunhos}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Total pushes</span><span className="text-amber-400 font-mono font-bold">{stats.broadcasts.total_pushes_enviados.toLocaleString()}</span></div>
                        </div>
                    </div>

                    {/* In-app */}
                    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10 space-y-4">
                        <h3 className="text-white font-semibold text-lg flex items-center gap-2"><FaBell className="text-blue-500" /> Notificações In-App</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white font-mono font-bold">{stats.notificacoes_inapp.total.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Lidas</span><span className="text-green-400 font-mono font-bold">{stats.notificacoes_inapp.lidas.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Taxa de leitura</span><span className="text-amber-400 font-mono font-bold">{stats.notificacoes_inapp.taxa_leitura_pct}%</span></div>
                        </div>
                    </div>

                    {/* Dispositivos */}
                    <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10 space-y-4">
                        <h3 className="text-white font-semibold text-lg flex items-center gap-2"><FaChartBar className="text-purple-500" /> Dispositivos</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span className="text-gray-400">Com FCM Token</span><span className="text-white font-mono font-bold">{stats.dispositivos.usuarios_com_fcm_token}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Usuários ativos</span><span className="text-white font-mono font-bold">{stats.dispositivos.usuarios_ativos_total}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Cobertura</span><span className="text-amber-400 font-mono font-bold">{stats.dispositivos.cobertura_pct}%</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Config */}
            {tab === 'config' && config && (
                <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10 space-y-6 max-w-2xl">
                    <h3 className="text-white font-semibold text-xl">Configurações Globais de Notificações</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                            <div>
                                <p className="text-white font-medium">Push Notifications</p>
                                <p className="text-gray-500 text-sm">Habilitar envio de push via Firebase</p>
                            </div>
                            <button onClick={() => handleConfigUpdate('push_habilitado', !config.push_habilitado)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${config.push_habilitado ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${config.push_habilitado ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                            <div>
                                <p className="text-white font-medium">E-mail Notifications</p>
                                <p className="text-gray-500 text-sm">Habilitar envio de notificações por e-mail</p>
                            </div>
                            <button onClick={() => handleConfigUpdate('email_habilitado', !config.email_habilitado)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${config.email_habilitado ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${config.email_habilitado ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="p-4 bg-black/30 rounded-lg">
                            <label className="text-white font-medium block mb-2">Frequência máxima diária (por usuário)</label>
                            <input type="number" value={config.frequencia_max_diaria} min={1} max={100}
                                onChange={(e) => setConfig(prev => ({ ...prev, frequencia_max_diaria: parseInt(e.target.value) }))}
                                onBlur={(e) => handleConfigUpdate('frequencia_max_diaria', parseInt(e.target.value))}
                                className="w-24 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none" />
                        </div>

                        <div className="p-4 bg-black/30 rounded-lg">
                            <label className="text-white font-medium block mb-2">Horário de Silêncio</label>
                            <div className="flex items-center gap-3">
                                <input type="time" value={config.horario_silencio_inicio || ''} onChange={(e) => handleConfigUpdate('horario_silencio_inicio', e.target.value || null)}
                                    className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none" />
                                <span className="text-gray-400">até</span>
                                <input type="time" value={config.horario_silencio_fim || ''} onChange={(e) => handleConfigUpdate('horario_silencio_fim', e.target.value || null)}
                                    className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/20 p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{editingNotif ? 'Editar Notificação' : 'Nova Notificação Broadcast'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><FaTimes /></button>
                        </div>
                        <form onSubmit={editingNotif ? handleUpdate : handleCreate} className="space-y-4">
                            <div>
                                <label className="text-gray-300 text-sm font-medium block mb-1">Título</label>
                                <input type="text" required maxLength={200} value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none" placeholder="Título da notificação" />
                            </div>
                            <div>
                                <label className="text-gray-300 text-sm font-medium block mb-1">Mensagem</label>
                                <textarea required rows={4} value={formData.mensagem} onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none resize-none" placeholder="Corpo da mensagem..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-gray-300 text-sm font-medium block mb-1">Tipo</label>
                                    <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none">
                                        <option value="info">Informação</option>
                                        <option value="alerta">Alerta</option>
                                        <option value="promo">Promoção</option>
                                        <option value="atualizacao">Atualização</option>
                                        <option value="manutencao">Manutenção</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm font-medium block mb-1">Destinatários</label>
                                    <select value={formData.destinatarios} onChange={(e) => setFormData({ ...formData, destinatarios: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none">
                                        <option value="todos">Todos os Usuários</option>
                                        <option value="ativos">Usuários Ativos (7 dias)</option>
                                        <option value="verificados">Usuários Verificados</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                                    <FaCheck /> {editingNotif ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminNotifications;
