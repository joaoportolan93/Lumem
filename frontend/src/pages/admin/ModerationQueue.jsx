/**
 * ModerationQueue.jsx - Issue #29
 * Reddit Mod Queue inspired moderation panel with split view
 */
import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaBan, FaExclamationTriangle, FaUser, FaComment, FaMoon } from 'react-icons/fa';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const ModerationQueue = () => {
    const { t } = useTranslation();
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const response = await api.get('/api/admin/reports/?status=1');
            setReports(response.data);
            if (response.data.length > 0) {
                setSelectedReport(response.data[0]);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!selectedReport) return;
        setActionLoading(true);

        try {
            await api.post(`/api/admin/reports/${selectedReport.id_denuncia}/action/`, { action });
            // Remove from list and select next
            const newReports = reports.filter(r => r.id_denuncia !== selectedReport.id_denuncia);
            setReports(newReports);
            setSelectedReport(newReports.length > 0 ? newReports[0] : null);
        } catch (error) {
            console.error('Error performing action:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const getContentIcon = (type) => {
        switch (type) {
            case 'post': return <FaMoon className="text-purple-400" />;
            case 'comment': return <FaComment className="text-blue-400" />;
            case 'user': return <FaUser className="text-green-400" />;
            default: return <FaExclamationTriangle className="text-amber-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">{t('admin.moderation.title')}</h1>
                    <p className="text-gray-400 mt-1">{t('admin.moderation.pendingCount', { count: reports.length })}</p>
                </div>
            </div>

            {reports.length === 0 ? (
                <div className="bg-[#1a1a1a] rounded-xl p-12 text-center border border-amber-500/10">
                    <FaCheck className="text-green-500 text-5xl mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white">{t('admin.moderation.noPending')}</h2>
                    <p className="text-gray-400 mt-2">{t('admin.moderation.allProcessed')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
                    {/* Left Panel - Report List */}
                    <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-amber-500/10">
                            <h2 className="font-bold text-white">{t('admin.moderation.reportsList')}</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {reports.map((report) => (
                                <div
                                    key={report.id_denuncia}
                                    onClick={() => setSelectedReport(report)}
                                    className={`p-4 border-b border-amber-500/5 cursor-pointer transition-colors ${selectedReport?.id_denuncia === report.id_denuncia
                                        ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                                        : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1">
                                            {getContentIcon(report.content?.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">
                                                {report.content?.titulo || report.content?.texto || report.content?.username || t('admin.moderation.contentFallback')}
                                            </p>
                                            <p className="text-sm text-amber-500">{report.motivo_display}</p>
                                            <p className="text-xs text-gray-500 font-mono mt-1">
                                                ID: {report.id_denuncia} • {new Date(report.data_denuncia).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel - Action Console */}
                    {selectedReport && (
                        <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="p-4 border-b border-amber-500/10 bg-amber-500/5">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <FaExclamationTriangle />
                                    <span className="font-bold">{t('admin.moderation.reason', { reason: selectedReport.motivo_display })}</span>
                                </div>
                            </div>

                            {/* Content Preview */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="space-y-4">
                                    {/* Meta Info */}
                                    <div className="bg-black/30 rounded-lg p-4 font-mono text-sm">
                                        <div className="grid grid-cols-2 gap-2 text-gray-400">
                                            <span>{t('admin.moderation.reporterId')}</span>
                                            <span className="text-white">{selectedReport.reporter.id}</span>
                                            <span>{t('admin.moderation.reporter')}</span>
                                            <span className="text-white">@{selectedReport.reporter.username}</span>
                                            <span>{t('admin.moderation.type')}</span>
                                            <span className="text-white">{selectedReport.tipo_conteudo_display}</span>
                                            <span>{t('admin.moderation.contentId')}</span>
                                            <span className="text-white">{selectedReport.id_conteudo}</span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {selectedReport.descricao_denuncia && (
                                        <div>
                                            <h4 className="text-gray-400 text-sm mb-2">{t('admin.moderation.description')}</h4>
                                            <p className="text-white bg-black/30 rounded-lg p-4">
                                                {selectedReport.descricao_denuncia}
                                            </p>
                                        </div>
                                    )}

                                    {/* Reported Content */}
                                    <div>
                                        <h4 className="text-gray-400 text-sm mb-2">{t('admin.moderation.reportedContent')}</h4>
                                        <div className="bg-black/30 rounded-lg p-4 border border-red-500/20">
                                            {selectedReport.content?.type === 'post' && (
                                                <div>
                                                    <p className="font-bold text-white mb-2">{selectedReport.content.titulo}</p>
                                                    <p className="text-gray-300">{selectedReport.content.conteudo_texto}</p>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {t('admin.moderation.by', { username: selectedReport.content.usuario?.username })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedReport.content?.type === 'comment' && (
                                                <div>
                                                    <p className="text-gray-300">{selectedReport.content.texto}</p>
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        {t('admin.moderation.by', { username: selectedReport.content.usuario?.username })}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedReport.content?.type === 'user' && (
                                                <div className="flex items-center gap-3">
                                                    <FaUser className="text-2xl text-gray-400" />
                                                    <span className="text-white">@{selectedReport.content.username}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="p-4 border-t border-amber-500/10 bg-black/30">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleAction('ignore')}
                                        disabled={actionLoading}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        <FaCheck /> {t('admin.moderation.actionIgnore')}
                                    </button>
                                    <button
                                        onClick={() => handleAction('remove')}
                                        disabled={actionLoading}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        <FaTimes /> {t('admin.moderation.actionRemove')}
                                    </button>
                                    <button
                                        onClick={() => handleAction('ban')}
                                        disabled={actionLoading}
                                        className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                                    >
                                        <FaBan /> {t('admin.moderation.actionBan')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModerationQueue;
