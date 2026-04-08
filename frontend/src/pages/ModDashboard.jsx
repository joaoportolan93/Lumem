import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCommunityStats, getCommunityMembers, getBannedMembers, banCommunityMember, unbanCommunityMember, manageCommunityRole, getCommunity } from '../services/api';
import { FaUsers, FaChartLine, FaFlag, FaUserShield, FaBan, FaArrowLeft, FaSpinner, FaCrown, FaStar, FaUser, FaTrash, FaChevronUp, FaChevronDown, FaTimes, FaQuestionCircle } from 'react-icons/fa';

const ModDashboard = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [community, setCommunity] = useState(null);
    const [stats, setStats] = useState(null);
    const [members, setMembers] = useState([]);
    const [bannedMembers, setBannedMembers] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    // Ban modal
    const [showBanModal, setShowBanModal] = useState(false);
    const [banTarget, setBanTarget] = useState(null);
    const [banReason, setBanReason] = useState('');
    const [banning, setBanning] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [commRes, statsRes, membersRes, bannedRes] = await Promise.all([
                getCommunity(id),
                getCommunityStats(id),
                getCommunityMembers(id),
                getBannedMembers(id).catch(() => ({ data: [] }))
            ]);
            setCommunity(commRes.data);
            setStats(statsRes.data);
            setMembers(membersRes.data);
            setBannedMembers(bannedRes.data);
        } catch (err) {
            console.error('Error loading mod dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBan = async () => {
        if (!banTarget) return;
        setBanning(true);
        try {
            await banCommunityMember(id, banTarget.id_usuario, banReason);
            setShowBanModal(false);
            setBanTarget(null);
            setBanReason('');
            await loadData();
        } catch (err) {
            alert(err.response?.data?.error || t('modDashboard.errBan'));
        } finally {
            setBanning(false);
        }
    };

    const handleUnban = async (userId) => {
        setActionLoading(`unban-${userId}`);
        try {
            await unbanCommunityMember(id, userId);
            await loadData();
        } catch (err) {
            alert(err.response?.data?.error || t('modDashboard.errUnban'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        setActionLoading(`role-${userId}`);
        try {
            await manageCommunityRole(id, userId, newRole);
            await loadData();
        } catch (err) {
            alert(err.response?.data?.error || t('modDashboard.errRole'));
        } finally {
            setActionLoading(null);
        }
    };

    const openBanModal = (member) => {
        setBanTarget(member);
        setBanReason('');
        setShowBanModal(true);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold"><FaCrown size={8} /> {t('modDashboard.roleAdmin')}</span>;
            case 'moderator':
                return <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold"><FaStar size={8} /> {t('modDashboard.roleMod')}</span>;
            default:
                return <span className="inline-flex items-center gap-1 text-[10px] bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-bold"><FaUser size={8} /> {t('modDashboard.roleMember')}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <FaSpinner className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    const tabs = [
        { key: 'overview', label: t('modDashboard.tabOverview'), icon: FaChartLine },
        { key: 'members', label: t('modDashboard.tabMembers'), icon: FaUsers, count: members.length },
        { key: 'banned', label: t('modDashboard.tabBanned'), icon: FaBan, count: bannedMembers.length },
    ];

    return (
        <div className="max-w-5xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(`/community/${id}`)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors"
                >
                    <FaArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FaUserShield className="text-indigo-500" />
                        {t('modDashboard.title')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{community?.nome || t('modDashboard.defaultComm')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.key
                                ? 'border-indigo-500 text-indigo-500'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title={t('modDashboard.statTotalMembers')}
                        value={stats.total_members}
                        icon={<FaUsers className="text-indigo-500" size={20} />}
                        subtitle={t('modDashboard.statThisWeek', { count: stats.new_members_last_7_days })}
                    />
                    <StatCard
                        title={t('modDashboard.statNewMembers')}
                        value={stats.new_members_last_7_days}
                        icon={<FaChartLine className="text-green-500" size={20} />}
                        subtitle={t('modDashboard.statLast7Days')}
                    />
                    <StatCard
                        title={t('modDashboard.statEngagement')}
                        value={stats.engagement_posts_last_7_days || 0}
                        icon={<FaChartLine className="text-blue-500" size={20} />}
                        subtitle={t('modDashboard.statPostsWeek')}
                    />
                    <StatCard
                        title={t('modDashboard.statPendingReports')}
                        value={stats.pending_reports}
                        icon={<FaFlag className="text-red-500" size={20} />}
                        subtitle={t('modDashboard.statRequireAction')}
                        highlight={stats.pending_reports > 0}
                    />
                </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
                <div className="bg-white dark:bg-[#1a1a1b] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 uppercase">
                                <th className="px-4 py-3">Usuário</th>
                                <th className="px-4 py-3">Cargo</th>
                                <th className="px-4 py-3">Entrou em</th>
                                <th className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1 relative group cursor-help">
                                        <span>Ações</span>
                                        <FaQuestionCircle className="text-gray-400" />
                                        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                            Admins podem promover/rebaixar. Mods apenas moderam posts/usuários (ex: banir).
                                        </div>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.usuario_id || member.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500 overflow-hidden flex items-center justify-center shrink-0">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-white font-bold text-xs">{(member.nome_usuario || member.username || '?').charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{member.nome_usuario || member.username}</div>
                                                <div className="text-xs text-gray-500">{member.nome_completo || ''}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{getRoleBadge(member.role)}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                        {member.data_entrada ? new Date(member.data_entrada).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {member.role === 'member' && (
                                                <>
                                                    <button
                                                        onClick={() => handleRoleChange(member.usuario_id || member.id, 'moderator')}
                                                        disabled={actionLoading === `role-${member.usuario_id || member.id}`}
                                                        className="px-2 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-400 rounded hover:bg-indigo-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                        title="Promover a Moderador"
                                                    >
                                                        {actionLoading === `role-${member.usuario_id || member.id}` ? <FaSpinner className="animate-spin" size={10} /> : <FaChevronUp size={10} />}
                                                        Promover
                                                    </button>
                                                    <button
                                                        onClick={() => openBanModal(member)}
                                                        className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors flex items-center gap-1"
                                                        title="Banir"
                                                    >
                                                        <FaBan size={10} /> Banir
                                                    </button>
                                                </>
                                            )}
                                            {member.role === 'moderator' && community?.is_admin && (
                                                <button
                                                    onClick={() => handleRoleChange(member.usuario_id || member.id, 'member')}
                                                    disabled={actionLoading === `role-${member.usuario_id || member.id}`}
                                                    className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    title="Rebaixar a Membro"
                                                >
                                                    {actionLoading === `role-${member.usuario_id || member.id}` ? <FaSpinner className="animate-spin" size={10} /> : <FaChevronDown size={10} />}
                                                    Rebaixar
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                                        Nenhum membro encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Banned Members Tab */}
            {activeTab === 'banned' && (
                <div className="bg-white dark:bg-[#1a1a1b] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {bannedMembers.length > 0 ? (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 uppercase">
                                    <th className="px-4 py-3">Usuário</th>
                                    <th className="px-4 py-3">Motivo</th>
                                    <th className="px-4 py-3">Banido por</th>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 relative group cursor-help">
                                            <span>Ações</span>
                                            <FaQuestionCircle className="text-gray-400" />
                                            <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                                Apenas Admins/Mods podem remover o banimento.
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {bannedMembers.map(ban => (
                                    <tr key={ban.id_ban} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-500/20 overflow-hidden flex items-center justify-center shrink-0">
                                                    {ban.avatar_url ? (
                                                        <img src={ban.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-red-400 font-bold text-xs">{(ban.username || '?').charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{ban.username}</div>
                                                    <div className="text-xs text-gray-500">{ban.nome_completo}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                                            {ban.motivo || <span className="italic text-gray-400">Sem motivo</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {ban.moderador_username || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {new Date(ban.data_ban).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleUnban(ban.user_id)}
                                                disabled={actionLoading === `unban-${ban.user_id}`}
                                                className="px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                                            >
                                                {actionLoading === `unban-${ban.user_id}` ? <FaSpinner className="animate-spin" size={10} /> : null}
                                                Desbanir
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 text-center">
                            <FaBan className="text-gray-300 dark:text-gray-600 mx-auto mb-3" size={32} />
                            <p className="text-sm text-gray-500">Nenhum usuário banido</p>
                        </div>
                    )}
                </div>
            )}

            {/* Ban Confirmation Modal */}
            {showBanModal && banTarget && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowBanModal(false)}>
                    <div className="bg-white dark:bg-[#1a1a1b] rounded-xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                <FaBan className="text-red-500" />
                                Banir Membro
                            </h3>
                            <button onClick={() => setShowBanModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                                <FaTimes />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <span className="text-red-500 font-bold">{(banTarget.nome_usuario || banTarget.username || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{banTarget.nome_usuario || banTarget.username}</div>
                                    <div className="text-xs text-red-500">Será removido da comunidade</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Motivo do ban (opcional)
                                </label>
                                <textarea
                                    value={banReason}
                                    onChange={e => setBanReason(e.target.value)}
                                    rows={3}
                                    placeholder="Ex: Violação das regras da comunidade..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#272729] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => setShowBanModal(false)} className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleBan}
                                disabled={banning}
                                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {banning && <FaSpinner className="animate-spin" size={12} />}
                                Confirmar Ban
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const StatCard = ({ title, value, icon, subtitle, highlight = false }) => (
    <div className={`bg-white dark:bg-[#1a1a1b] rounded-lg border p-4 ${highlight ? 'border-red-300 dark:border-red-500/30' : 'border-gray-200 dark:border-gray-700'
        }`}>
        <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">{title}</span>
            {icon}
        </div>
        <div className={`text-3xl font-bold mb-1 ${highlight ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {value}
        </div>
        <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
);

export default ModDashboard;
