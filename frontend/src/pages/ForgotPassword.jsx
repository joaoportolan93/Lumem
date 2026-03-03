import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { passwordReset } from '../services/api';
import { useTranslation } from 'react-i18next';
import '../styles/Auth.css';

const ForgotPassword = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [nomeUsuario, setNomeUsuario] = useState('');
    const [respostaSecreta, setRespostaSecreta] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError(t('forgotPassword.errPasswordMismatch'));
            return;
        }

        if (newPassword.length < 6) {
            setError(t('forgotPassword.errPasswordLength'));
            return;
        }

        setLoading(true);

        try {
            await passwordReset({
                email,
                nome_usuario: nomeUsuario,
                resposta_secreta: respostaSecreta,
                new_password: newPassword,
            });
            setSuccess(true);
        } catch (err) {
            if (err.response?.data?.non_field_errors) {
                setError(err.response.data.non_field_errors[0]);
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError(t('forgotPassword.errGeneric'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#110914] relative overflow-hidden p-4">
            {/* Efeitos de Fundo: Paleta Sunset Premium */}
            <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-[#5C4A72]/70 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute top-[5%] right-[-10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] bg-[#A3586D]/60 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-15%] left-[5%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-[#F46A4E]/50 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[5%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] bg-[#F3B05A]/50 rounded-full blur-[140px] pointer-events-none" />

            <motion.div
                className="w-full max-w-md bg-black/40 backdrop-blur-[30px] border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl relative z-10"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                <div className="text-center mb-6">
                    <h1 className="auth-title">DreamShare</h1>
                </div>

                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="auth-success flex flex-col items-center">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <h2 className="text-[#f8fafc] text-xl mb-2 text-center font-medium">
                                    {t('forgotPassword.successTitle')}
                                </h2>
                                <p className="text-[#94a3b8] text-sm text-center mb-6">
                                    {t('forgotPassword.successMessage')}
                                </p>
                                <button
                                    className="btn-dream glow-btn w-full"
                                    onClick={() => navigate('/login')}
                                >
                                    {t('forgotPassword.btnGoToLogin')}
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <p className="auth-subtitle text-center mb-6">
                                {t('forgotPassword.subtitle')}
                            </p>

                            {error && (
                                <motion.div
                                    className="auth-error"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    {error}
                                </motion.div>
                            )}

                            <form onSubmit={handleReset}>
                                <input
                                    type="email"
                                    className="auth-input immersive-input mb-4"
                                    placeholder={t('forgotPassword.placeholderEmail')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    className="auth-input immersive-input mb-4"
                                    placeholder={t('forgotPassword.placeholderUsername')}
                                    value={nomeUsuario}
                                    onChange={(e) => setNomeUsuario(e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    className="auth-input immersive-input mb-4"
                                    placeholder={t('forgotPassword.placeholderSecretAnswer')}
                                    value={respostaSecreta}
                                    onChange={(e) => setRespostaSecreta(e.target.value)}
                                    required
                                />
                                <input
                                    type="password"
                                    className="auth-input immersive-input mb-4"
                                    placeholder={t('forgotPassword.placeholderNewPassword')}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                                <input
                                    type="password"
                                    className="auth-input immersive-input mb-6"
                                    placeholder={t('forgotPassword.placeholderConfirmNewPassword')}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="submit"
                                    className="btn-dream glow-btn w-full"
                                    disabled={loading}
                                >
                                    {loading ? t('forgotPassword.btnResetting') : t('forgotPassword.btnReset')}
                                </button>
                            </form>

                            <p className="auth-link text-center mt-6">
                                {t('forgotPassword.rememberedPassword')} <Link to="/login" className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">{t('forgotPassword.linkBackToLogin')}</Link>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
