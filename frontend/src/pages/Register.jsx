import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, login } from '../services/api';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import '../styles/Auth.css';

const Register = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');



        if (formData.password !== formData.confirmPassword) {
            setError(t('register.errPasswordMismatch'));
            return;
        }

        if (formData.password.length < 6) {
            setError(t('register.errPasswordLength'));
            return;
        }

        setLoading(true);

        try {
            await register({
                nome_usuario: formData.username,
                email: formData.email,
                nome_completo: formData.username,
                password: formData.password,
            });

            const loginResponse = await login({
                email: formData.email,
                password: formData.password,
            });

            localStorage.setItem('access', loginResponse.data.access);
            localStorage.setItem('refresh', loginResponse.data.refresh);

            navigate('/onboarding');
        } catch (err) {
            console.error('Registration error:', err.response?.data);
            if (err.response?.data) {
                const data = err.response.data;
                if (data.email) {
                    setError(t('register.errEmailInUse'));
                } else if (data.nome_usuario || data.username) {
                    setError(t('register.errUsernameInUse'));
                } else if (data.detail) {
                    setError(data.detail);
                } else if (typeof data === 'object') {
                    // Join multiple field errors if present
                    const firstError = Object.values(data)[0];
                    setError(Array.isArray(firstError) ? firstError[0] : t('register.errGeneric'));
                } else {
                    setError(t('register.errGeneric'));
                }
            } else {
                setError(t('register.errGeneric'));
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
                    <h1 className="auth-title">{t('register.title')}</h1>
                    <p className="auth-subtitle">{t('register.subtitle')}</p>
                </div>

                {error && (
                    <motion.div
                        className="auth-error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleRegister}>
                    <input
                        type="text"
                        name="username"
                        className="auth-input immersive-input mb-4"
                        placeholder={t('register.placeholderUsername')}
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="email"
                        name="email"
                        className="auth-input immersive-input mb-4"
                        placeholder={t('register.placeholderEmail')}
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        className="auth-input immersive-input mb-4"
                        placeholder={t('register.placeholderPassword')}
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="password"
                        name="confirmPassword"
                        className="auth-input immersive-input mb-4"
                        placeholder={t('register.placeholderConfirmPassword')}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />


                    <button
                        type="submit"
                        className="btn-dream glow-btn w-full"
                        disabled={loading}
                    >
                        {loading ? t('register.btnCreating') : t('register.btnCreate')}
                    </button>
                </form>

                <p className="auth-link text-center mt-6">
                    {t('register.alreadyHaveAccount')} <Link to="/login" className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">{t('register.linkLogin')}</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Register;
