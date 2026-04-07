/**
 * AdminLayout.jsx - Issue #29
 * Admin panel layout with dedicated sidebar and orange theme
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { FaChartLine, FaShieldAlt, FaUsers, FaGlobe, FaCog, FaSignOutAlt, FaCloud, FaBell, FaComments } from 'react-icons/fa';
import { getProfile } from '../services/api';

const AdminLayout = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const response = await getProfile();
                if (!response.data.is_admin) {
                    navigate('/');
                    return;
                }
                setUser(response.data);
            } catch (error) {
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        checkAdmin();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const menuItems = [
        { path: '/admin', icon: FaChartLine, label: 'Dashboard' },
        { path: '/admin/moderation', icon: FaShieldAlt, label: 'Moderação' },
        { path: '/admin/users', icon: FaUsers, label: 'Usuários' },
        { path: '/admin/notifications', icon: FaBell, label: 'Notificações' },
        { path: '/admin/chat-audit', icon: FaComments, label: 'Auditoria Chat' },
        { path: '/admin/communities', icon: FaGlobe, label: 'Comunidades' },
        { path: '/admin/settings', icon: FaCog, label: 'Configurações' },
    ];

    return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[#1a1a1a] border-r border-amber-500/20 fixed h-full">
                {/* Logo */}
                <div className="p-6 border-b border-amber-500/20">
                    <Link to="/admin" className="flex items-center gap-3">
                        <FaCloud className="text-amber-500 text-2xl" />
                        <span className="text-lg font-bold">
                            <span className="text-amber-500">Dream</span>
                            <span className="text-white">Admin</span>
                        </span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-amber-500/20 text-amber-500 border-l-4 border-amber-500'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <item.icon size={18} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-amber-500/20">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                            {user?.nome_completo?.charAt(0) || 'A'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{user?.nome_completo}</p>
                            <p className="text-xs text-amber-500">Administrador</p>
                        </div>
                    </div>
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                    >
                        <FaSignOutAlt />
                        Voltar ao Site
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    );
};

export default AdminLayout;
