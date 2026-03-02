import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FaPlay, FaPause } from 'react-icons/fa';
import '../styles/Auth.css';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

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
            const response = await axios.post('http://127.0.0.1:8000/api/auth/login/', {
                email,
                password,
            });

            // Store tokens in localStorage
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);

            // Redirect to feed/home
            navigate('/feed');
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.banned) {
                // User is banned
                setError(err.response.data.message || 'Sua conta foi banida por tempo indeterminado.');
            } else if (err.response?.status === 401) {
                setError('Email ou senha inválidos. Por favor, tente novamente.');
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError('Ocorreu um erro ao fazer login. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

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
                        title={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
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
                        <h1>Olá, Seja muito bem-vindo(a)!</h1>
                        <div className="quote-section">
                            <p className="quote">"Os sonhos são as ilustrações do livro que sua alma está escrevendo sobre você."</p>
                            <p className="quote-author">— Marsha Norman</p>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Formulário com Glassmorphism */}
                <div className="login-right-panel">
                    <h2 className="auth-title">Lumen</h2>
                    <p className="auth-subtitle">Entre ou crie uma conta para começar a notar e compartilhar seus sonhos</p>

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
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            className="auth-input immersive-input"
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <div className="forgot-password-link">
                            <Link to="/forgot-password">Esqueceu a senha?</Link>
                        </div>
                        <button
                            type="submit"
                            className="btn-dream glow-btn"
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>

                    <p className="auth-link">
                        Não tem uma conta? <Link to="/register">Criar conta</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
