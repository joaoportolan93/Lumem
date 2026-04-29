import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { onForegroundMessage } from './services/notifications';

// Layout
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import ExplorePage from './pages/ExplorePage';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Communities from './pages/Communities';
import CommunityPage from './pages/CommunityPage';
import ModDashboard from './pages/ModDashboard';
import Saved from './pages/Saved';
import NotFound from './pages/NotFound';
import UserProfile from './pages/UserProfile';
import SearchPage from './pages/SearchPage';
import CreatePostPage from './pages/CreatePostPage';
import PostPage from './pages/PostPage';

// Admin - Issue #29
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import ModerationQueue from './pages/admin/ModerationQueue';
import UserManagement from './pages/admin/UserManagement';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminChatAudit from './pages/admin/AdminChatAudit';

// Legal Pages
import TermosDeUso from './pages/legal/TermosDeUso';
import PoliticaPrivacidade from './pages/legal/PoliticaPrivacidade';
import Ajuda from './pages/legal/Ajuda';
import Sobre from './pages/legal/Sobre';

// Components
import PrivateRoute from './components/PrivateRoute';
import { SuggestionsProvider } from './contexts/SuggestionsContext';

// Check if user is authenticated
const isAuthenticated = () => {
    return localStorage.getItem('access') !== null;
};

// Public Route - redirects to home if already logged in
const PublicRoute = ({ children }) => {
    if (isAuthenticated()) {
        return <Navigate to="/" replace />;
    }
    return children;
};

function App() {
    // Handler para notificações em foreground (app aberto)
    useEffect(() => {
        const unsubscribe = onForegroundMessage((payload) => {
            const { title, body } = payload.notification || {};
            // Proteger contra browsers sem suporte a Notification API
            if (typeof window !== 'undefined'
                && 'Notification' in window
                && Notification.permission === 'granted'
                && title
            ) {
                new Notification(title, {
                    body: body || 'Nova notificação',
                    icon: '/logo192.png',
                });
            }
        });

        return unsubscribe;
    }, []);

    return (
        <Router>
            <SuggestionsProvider>
                <AnimatePresence mode="wait">
                    <Routes>
                        {/* Public Routes (Auth) */}
                        <Route
                            path="/login"
                            element={
                                <PublicRoute>
                                    <Login />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/register"
                            element={
                                <PublicRoute>
                                    <Register />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/forgot-password"
                            element={
                                <PublicRoute>
                                    <ForgotPassword />
                                </PublicRoute>
                            }
                        />

                        {/* Semi-Protected Route (needs auth but no layout) */}
                        <Route
                            path="/onboarding"
                            element={
                                <PrivateRoute>
                                    <Onboarding />
                                </PrivateRoute>
                            }
                        />

                        {/* Protected Routes (with Layout) */}
                        <Route
                            path="/"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Home />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/feed"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Home />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/explore"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <ExplorePage />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/search"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <SearchPage />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/profile"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Profile />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/user/:id"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <UserProfile />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/post/:id"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <PostPage />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/communities"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <Communities />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/community/:id"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <CommunityPage />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/community/:id/mod-dashboard"
                            element={
                                <PrivateRoute>
                                    <Layout hideRightSidebar>
                                        <ModDashboard />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/create-post"
                            element={
                                <PrivateRoute>
                                    <CreatePostPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/community/:communityId/submit"
                            element={
                                <PrivateRoute>
                                    <CreatePostPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/saved"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Saved />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/edit-profile"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <EditProfile />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/settings"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Settings />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/notifications"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Notifications />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />

                        {/* Admin Routes - Issue #29 */}
                        <Route
                            path="/admin"
                            element={
                                <PrivateRoute>
                                    <AdminLayout>
                                        <AdminDashboard />
                                    </AdminLayout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/admin/moderation"
                            element={
                                <PrivateRoute>
                                    <AdminLayout>
                                        <ModerationQueue />
                                    </AdminLayout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/admin/users"
                            element={
                                <PrivateRoute>
                                    <AdminLayout>
                                        <UserManagement />
                                    </AdminLayout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/admin/notifications"
                            element={
                                <PrivateRoute>
                                    <AdminLayout>
                                        <AdminNotifications />
                                    </AdminLayout>
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/admin/chat-audit"
                            element={
                                <PrivateRoute>
                                    <AdminLayout>
                                        <AdminChatAudit />
                                    </AdminLayout>
                                </PrivateRoute>
                            }
                        />

                        {/* Legal Routes */}
                        <Route path="/termos" element={<TermosDeUso />} />
                        <Route path="/terms" element={<TermosDeUso />} />
                        <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                        <Route path="/privacy" element={<PoliticaPrivacidade />} />
                        <Route path="/ajuda" element={<Ajuda />} />
                        <Route path="/help" element={<Ajuda />} />
                        <Route path="/sobre" element={<Sobre />} />
                        <Route path="/about" element={<Sobre />} />

                        {/* 404 Not Found */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </AnimatePresence>
            </SuggestionsProvider>
        </Router>
    );
}

export default App;
