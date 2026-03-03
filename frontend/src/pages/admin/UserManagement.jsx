/**
 * UserManagement.jsx - Issue #29
 * Twitter-inspired user management with data table and inspect modal
 */
import React, { useState, useEffect } from 'react';
import { FaSearch, FaUser, FaEye, FaBan, FaCheck, FaTimes } from 'react-icons/fa';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const UserManagement = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async (searchTerm = '') => {
        setLoading(true);
        try {
            const response = await api.get(`/api/admin/users/?search=${searchTerm}`);
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers(search);
    };

    const openInspectModal = async (userId) => {
        setModalLoading(true);
        setModalOpen(true);
        try {
            const response = await api.get(`/api/admin/users/${userId}/`);
            setSelectedUser(response.data);
        } catch (error) {
            console.error('Error fetching user details:', error);
        } finally {
            setModalLoading(false);
        }
    };

    const updateUserStatus = async (userId, newStatus) => {
        try {
            await api.patch(`/api/admin/users/${userId}/`, { status: newStatus });
            // Update local state
            setUsers(users.map(u =>
                u.id_usuario === userId
                    ? { ...u, status: newStatus, status_display: newStatus === 1 ? t('admin.userManagement.statusActive') : newStatus === 2 ? t('admin.userManagement.statusSuspended') : t('admin.userManagement.statusDeactivated') }
                    : u
            ));
            if (selectedUser?.id_usuario === userId) {
                setSelectedUser({ ...selectedUser, status: newStatus });
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 1:
                return <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">{t('admin.userManagement.statusActive')}</span>;
            case 2:
                return <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">{t('admin.userManagement.statusSuspended')}</span>;
            case 3:
                return <span className="px-2 py-1 text-xs font-medium bg-gray-500/20 text-gray-400 rounded-full">{t('admin.userManagement.statusDeactivated')}</span>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">{t('admin.userManagement.title')}</h1>
                <p className="text-gray-400 mt-1">{t('admin.userManagement.usersFound', { count: users.length })}</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-4">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('admin.userManagement.searchPlaceholder')}
                        className="w-full bg-[#1a1a1a] border border-amber-500/20 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                </div>
                <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded-lg transition-colors"
                >
                    {t('admin.userManagement.searchBtn')}
                </button>
            </form>

            {/* Users Table */}
            <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/10 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-amber-500/10 text-left">
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colId')}</th>
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colUser')}</th>
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colEmail')}</th>
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colStatus')}</th>
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colRegistration')}</th>
                            <th className="p-4 text-gray-400 font-medium">{t('admin.userManagement.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-400">
                                    {t('admin.userManagement.emptyTable')}
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id_usuario} className="border-b border-amber-500/5 hover:bg-white/5">
                                    <td className="p-4 font-mono text-amber-500">{user.id_usuario}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 overflow-hidden">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <FaUser size={12} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{user.nome_completo}</p>
                                                <p className="text-gray-500 text-sm">@{user.nome_usuario}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-400 font-mono text-sm">{user.email}</td>
                                    <td className="p-4">{getStatusBadge(user.status)}</td>
                                    <td className="p-4 text-gray-400 font-mono text-sm">
                                        {new Date(user.data_criacao).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openInspectModal(user.id_usuario)}
                                                className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-lg transition-colors"
                                                title={t('admin.userManagement.actionInspect')}
                                            >
                                                <FaEye />
                                            </button>
                                            {user.status === 1 ? (
                                                <button
                                                    onClick={() => updateUserStatus(user.id_usuario, 2)}
                                                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-colors"
                                                    title={t('admin.userManagement.actionBan')}
                                                >
                                                    <FaBan />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => updateUserStatus(user.id_usuario, 1)}
                                                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg transition-colors"
                                                    title={t('admin.userManagement.actionReactivate')}
                                                >
                                                    <FaCheck />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Inspect Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] rounded-xl border border-amber-500/20 w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-4 border-b border-amber-500/10">
                            <h2 className="text-xl font-bold text-white">{t('admin.userManagement.modalTitle')}</h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <FaTimes size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {modalLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                                </div>
                            ) : selectedUser ? (
                                <div className="space-y-4 font-mono text-sm">
                                    {Object.entries(selectedUser).map(([key, value]) => (
                                        <div key={key} className="flex border-b border-amber-500/5 pb-2">
                                            <span className="w-40 text-gray-500 flex-shrink-0">{key}:</span>
                                            <span className="text-white break-all">
                                                {typeof value === 'boolean'
                                                    ? (value ? 'true' : 'false')
                                                    : value?.toString() || 'null'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-amber-500/10 flex gap-3">
                            {selectedUser && selectedUser.status === 1 ? (
                                <button
                                    onClick={() => {
                                        updateUserStatus(selectedUser.id_usuario, 2);
                                        setModalOpen(false);
                                    }}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <FaBan /> {t('admin.userManagement.modalBan')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        updateUserStatus(selectedUser.id_usuario, 1);
                                        setModalOpen(false);
                                    }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <FaCheck /> {t('admin.userManagement.modalReactivate')}
                                </button>
                            )}
                            <button
                                onClick={() => setModalOpen(false)}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                            >
                                {t('admin.userManagement.modalClose')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
