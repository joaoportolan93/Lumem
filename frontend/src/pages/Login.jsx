import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaGoogle } from 'react-icons/fa';
import { useGoogleLogin } from '@react-oauth/google';
import { login, googleLogin } from '../services/api';
import { registerPushToken } from '../services/notifications';
import '../styles/Auth.css';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    // Refs para Efeito Ambilight
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        let animationFrameId;

        const updateAmbilightColor = () => {
            if (videoRef.current && canvasRef.current && containerRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                // Só processa se houver dados no vídeo
                if (video.readyState >= 2) {
                    // Desenha o frame do vídeo num canvas de 1x1 - Isso faz a média das cores automaticamente
                    ctx.drawImage(video, 0, 0, 1, 1);
                    const pixel = ctx.getImageData(0, 0, 1, 1).data;

                    const r = pixel[0];
                    const g = pixel[1];
                    const b = pixel[2];

                    // Atualizamos uma variável CSS no container mais alto da nossa árvore
                    containerRef.current.style.setProperty('--ambilight-color-rgb', `${r}, ${g}, ${b}`);
                    containerRef.current.style.setProperty('--ambilight-color', `rgb(${r}, ${g}, ${b})`);
                }
            }
            // Repete sem travar o Event Loop do React
            animationFrameId = requestAnimationFrame(updateAmbilightColor);
        };

        updateAmbilightColor();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    const toggleVideo = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await login({
                email,
                password,
            });

            // Store tokens in localStorage
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);

            // Registrar push token de forma não-bloqueante
            registerPushToken();

            // Redirect to feed/home
            navigate('/feed');
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.banned) {
                // User is banned
                setError(err.response.data.message || t('login.errorBanned'));
            } else if (err.response?.status === 401) {
                setError(t('login.errorUnauthorized'));
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError(t('login.errorGeneric'));
            }
            setTimeout(() => setError(''), 5000);
        } finally {
            setLoading(false);
        }
    };

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setLoading(true);
                const res = await googleLogin({
                    access_token: tokenResponse.access_token,
                });
                
                localStorage.setItem('access', res.data.access);
                localStorage.setItem('refresh', res.data.refresh);

                // Registrar push token de forma não-bloqueante
                registerPushToken();

                navigate('/feed');
            } catch (err) {
                if (err.response?.status === 403 && err.response?.data?.banned) {
                    setError(err.response.data.message || t('login.errorBanned'));
                } else if (err.response?.status === 401) {
                    setError(t('login.errorUnauthorized'));
                } else {
                    setError(t('login.errorGeneric'));
                }
                setTimeout(() => setError(''), 5000);
            } finally {
                setLoading(false);
            }
        },
        onError: errorResponse => {
            setError(t('login.errorGeneric'));
            console.error('Google Login Error:', errorResponse);
        },
    });

    return (
        <div className="login-immersive-layout" ref={containerRef}>
            {/* O Canvas fica logicamente invisível na tela pra extração de cores */}
            <canvas ref={canvasRef} width={1} height={1} style={{ display: 'none' }} />

            <motion.div
                className="login-split-card"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
            >
                {/* Lado Esquerdo: Vídeo e Boas Vindas */}
                <div className="login-left-panel" style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={toggleVideo}
                        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/40 text-white"
                        style={{ opacity: 0.25, transition: 'opacity 0.3s', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.25'}
                        title={isPlaying ? t('login.pauseVideo') : t('login.playVideo')}
                    >
                        {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} />}
                    </button>
                    <video
                        ref={videoRef}
                        src="/video_login.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="panel-video"
                    />
                    <div className="panel-overlay" />

                    <div className="welcome-hero-text">
                        <h1>{t('login.welcome')}</h1>
                        <div className="quote-section">
                            <p className="quote">{t('login.quote')}</p>
                            <p className="quote-author">{t('login.quoteAuthor')}</p>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Formulário com Glassmorphism */}
                <div className="login-right-panel" style={{ position: 'relative' }}>

                    {/* Language Switcher */}
                    <div className="absolute top-6 right-8 flex space-x-2 z-10">
                        <button
                            type="button"
                            onClick={() => changeLanguage('pt-BR')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${i18n.language === 'pt-BR' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-indigo-900 hover:bg-white/40'}`}
                        >
                            PT
                        </button>
                        <button
                            type="button"
                            onClick={() => changeLanguage('en')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${i18n.language === 'en' ? 'bg-indigo-600 text-white' : 'bg-white/20 text-indigo-900 hover:bg-white/40'}`}
                        >
                            EN
                        </button>
                    </div>

                    <h2 className="auth-title">Lumem</h2>
                    <p className="auth-subtitle">{t('login.subtitle')}</p>

                    {error && (
                        <motion.div
                            className="auth-error"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin}>
                        <input
                            type="email"
                            className="auth-input immersive-input"
                            placeholder={t('login.emailPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            className="auth-input immersive-input"
                            placeholder={t('login.passwordPlaceholder')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <div className="forgot-password-link">
                            <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
                        </div>
                        <button
                            type="submit"
                            className="btn-dream glow-btn"
                            disabled={loading}
                        >
                            {loading ? t('login.buttonLoading') : t('login.buttonSubmit')}
                        </button>
                    </form>

                    <div className="relative mt-6 mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-transparent text-gray-400">Ou</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => loginWithGoogle()}
                        className="btn-dream outline-btn w-full text-white bg-transparent border border-white/20 p-3 rounded-lg hover:bg-white/10 flex items-center justify-center space-x-2"
                        disabled={loading}
                    >
                        <FaGoogle />
                        <span>{t('login.continueWithGoogle', 'Continuar com o Google')}</span>
                    </button>

                    <p className="auth-link mt-6">
                        {t('login.noAccount')} <Link to="/register">{t('login.createAccount')}</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
