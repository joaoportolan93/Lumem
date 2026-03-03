/**
 * AdminDashboard.jsx - Issue #29
 * Admin dashboard with KPI cards and charts (Discord Server Stats inspired)
 */
import React, { useState, useEffect } from 'react';
import { FaUsers, FaExclamationTriangle, FaBan, FaMoon } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const AdminDashboard = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await api.get('/api/admin/stats/');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const kpiCards = [
        {
            label: t('admin.dashboard.totalUsers'),
            value: stats?.kpis?.total_users || 0,
            icon: FaUsers,
            color: 'from-blue-500 to-blue-600'
        },
        {
            label: t('admin.dashboard.pendingReports'),
            value: stats?.kpis?.pending_reports || 0,
            icon: FaExclamationTriangle,
            color: 'from-amber-500 to-orange-600',
            alert: stats?.kpis?.pending_reports > 0
        },
        {
            label: t('admin.dashboard.bannedUsers'),
            value: stats?.kpis?.banned_users || 0,
            icon: FaBan,
            color: 'from-red-500 to-red-600'
        },
        {
            label: t('admin.dashboard.totalDreams'),
            value: stats?.kpis?.total_dreams || 0,
            icon: FaMoon,
            color: 'from-purple-500 to-purple-600'
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">{t('admin.dashboard.title')}</h1>
                <p className="text-gray-400 mt-1">{t('admin.dashboard.subtitle')}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiCards.map((card, index) => (
                    <div
                        key={index}
                        className={`relative overflow-hidden bg-gradient-to-br ${card.color} rounded-xl p-6 shadow-lg ${card.alert ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0f0f0f]' : ''
                            }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 text-sm font-medium">{card.label}</p>
                                <p className="text-3xl font-bold text-white mt-2 font-mono">{card.value.toLocaleString()}</p>
                            </div>
                            <card.icon className="text-white/30 text-4xl" />
                        </div>
                        {card.alert && (
                            <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10">
                <h2 className="text-xl font-bold text-white mb-6">{t('admin.dashboard.chartTitle')}</h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats?.daily_stats || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                                dataKey="date"
                                stroke="#666"
                                tick={{ fill: '#888', fontSize: 12 }}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { weekday: 'short' })}
                            />
                            <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #f59e0b',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="signups"
                                name={t('admin.dashboard.newUsers')}
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="reports"
                                name={t('admin.dashboard.reportsLabel')}
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10">
                    <h3 className="text-gray-400 text-sm font-medium mb-2">{t('admin.dashboard.banRate')}</h3>
                    <p className="text-2xl font-bold text-white font-mono">
                        {stats?.kpis?.total_users > 0
                            ? ((stats.kpis.banned_users / stats.kpis.total_users) * 100).toFixed(2)
                            : 0}%
                    </p>
                </div>
                <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10">
                    <h3 className="text-gray-400 text-sm font-medium mb-2">{t('admin.dashboard.dreamsPerUser')}</h3>
                    <p className="text-2xl font-bold text-white font-mono">
                        {stats?.kpis?.total_users > 0
                            ? (stats.kpis.total_dreams / stats.kpis.total_users).toFixed(1)
                            : 0}
                    </p>
                </div>
                <div className="bg-[#1a1a1a] rounded-xl p-6 border border-amber-500/10">
                    <h3 className="text-gray-400 text-sm font-medium mb-2">{t('admin.dashboard.systemStatus')}</h3>
                    <p className="text-2xl font-bold text-green-500">{t('admin.dashboard.online')}</p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
