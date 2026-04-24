import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaEye, FaLock, FaCheck } from 'react-icons/fa';
import { getProfile, updateUser, uploadAvatar, updateUserSettings } from '../services/api';
import { useTranslation } from 'react-i18next';
import '../styles/Auth.css';

// Os IDs devem ser os valores EXATOS usados no campo tipo_sonho do backend
// para que o algoritmo de feed faça o match corretamente.
const CATEGORIAS_SONHO = [
    { id: 'Lúcido',       emoji: '🌙', label: 'Sonhos Lúcidos',      desc: 'Controle o seu sonho' },
    { id: 'Pesadelo',     emoji: '😱', label: 'Pesadelos',            desc: 'Medos e tensões noturnas' },
    { id: 'Recorrente',   emoji: '🔄', label: 'Sonhos Recorrentes',   desc: 'Padrões que se repetem' },
    { id: 'Normal',       emoji: '💭', label: 'Sonhos Comuns',        desc: 'Reflexos do dia a dia' },
    { id: 'Profético',    emoji: '✨', label: 'Sonhos Proféticos',    desc: 'Visões do futuro' },
    { id: 'Astral',       emoji: '🌊', label: 'Viagens Astrais',      desc: 'Projeção e OBE' },
    { id: 'Criativo',     emoji: '🎨', label: 'Criatividade e Arte',  desc: 'Sonhos simbólicos e artísticos' },
    { id: 'Aventura',     emoji: '✈️', label: 'Aventura e Viagens',   desc: 'Exploração e descoberta' },
    { id: 'Relacionamento', emoji: '❤️', label: 'Relacionamentos',    desc: 'Família, amor e amizade' },
    { id: 'Fantasia',     emoji: '🎮', label: 'Fantasia e Ficção',    desc: 'Mundos imaginários' },
    { id: 'Natureza',     emoji: '🌿', label: 'Natureza e Animais',   desc: 'Terra, mar e céu' },
    { id: 'Espiritual',   emoji: '🕊️', label: 'Espiritual',           desc: 'Fé, paz e transcendência' },
];

const TOTAL_STEPS = 3;

const Onboarding = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [direction, setDirection] = useState(0);

    // Step 1: Perfil
    const [avatar, setAvatar] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');

    // Step 2: Privacidade
    const [privacy, setPrivacy] = useState('public');

    // Step 3: Interesses
    const [selectedInterests, setSelectedInterests] = useState([]);

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(file);
            const reader = new FileReader();
            reader.onloadend = () => setAvatarPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const toggleInterest = (id) => {
        setSelectedInterests(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleNext = () => {
        if (step === 1 && !displayName.trim()) {
            setError(t('onboarding.errEmptyDisplayName'));
            return;
        }
        setError('');
        setDirection(1);
        setStep(s => Math.min(s + 1, TOTAL_STEPS));
    };

    const handleBack = () => {
        setDirection(-1);
        setStep(s => Math.max(s - 1, 1));
        setError('');
    };

    const handleFinish = async () => {
        setLoading(true);
        setError('');
        try {
            const profileResponse = await getProfile();
            const userId = profileResponse.data.id_usuario;

            if (avatar) await uploadAvatar(avatar);

            await updateUser(userId, {
                nome_completo: displayName,
                bio: bio,
                privacidade_padrao: privacy === 'private' ? 2 : 1,
            });

            // Salvar interesses nas configurações do usuário
            if (selectedInterests.length > 0) {
                try {
                    await updateUserSettings({ interesses: selectedInterests });
                } catch (_) {
                    // não-crítico, continua
                }
            }

            navigate('/');
        } catch (err) {
            console.error('Onboarding error:', err);
            setError(t('onboarding.errSaveProfile'));
        } finally {
            setLoading(false);
        }
    };

    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
    };

    const stepTitles = [
        t('onboarding.step1Title'),
        t('onboarding.step2Title'),
        'Seus interesses',
    ];
    const stepSubtitles = [
        t('onboarding.step1Subtitle'),
        t('onboarding.step2Subtitle'),
        'Escolha os tipos de sonho que mais combinam com você',
    ];

    return (
        <div className="auth-bg">
            <motion.div
                className="glass-card onboarding-container"
                style={{ maxWidth: step === 3 ? 560 : undefined }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* Progress Bar */}
                <div className="progress-bar">
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                        <div key={i} className={`progress-step ${step >= i + 1 ? 'active' : ''}`} />
                    ))}
                </div>

                <h1 className="auth-title">{stepTitles[step - 1]}</h1>
                <p className="auth-subtitle">{stepSubtitles[step - 1]}</p>

                {error && (
                    <motion.div
                        className="auth-error"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        {error}
                    </motion.div>
                )}

                <AnimatePresence mode="wait" custom={direction}>
                    {/* ── Step 1: Perfil ── */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <div className="avatar-upload" onClick={handleAvatarClick}>
                                {avatarPreview
                                    ? <img src={avatarPreview} alt="Avatar" />
                                    : <FaUser size={40} />}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            <input
                                type="text"
                                className="auth-input"
                                placeholder={t('onboarding.placeholderDisplayName')}
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                            <textarea
                                className="auth-textarea"
                                placeholder={t('onboarding.placeholderBio')}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            />
                        </motion.div>
                    )}

                    {/* ── Step 2: Privacidade ── */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <div className="privacy-cards">
                                <div
                                    className={`privacy-card ${privacy === 'public' ? 'selected' : ''}`}
                                    onClick={() => setPrivacy('public')}
                                >
                                    <FaEye />
                                    <h3>{t('onboarding.privacyPublic')}</h3>
                                    <p>{t('onboarding.privacyPublicDesc')}</p>
                                </div>
                                <div
                                    className={`privacy-card ${privacy === 'private' ? 'selected' : ''}`}
                                    onClick={() => setPrivacy('private')}
                                >
                                    <FaLock />
                                    <h3>{t('onboarding.privacyPrivate')}</h3>
                                    <p>{t('onboarding.privacyPrivateDesc')}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Step 3: Interesses ── */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '10px',
                                marginTop: '8px',
                                maxHeight: '340px',
                                overflowY: 'auto',
                                paddingRight: '4px',
                            }}>
                                {CATEGORIAS_SONHO.map((cat) => {
                                    const selected = selectedInterests.includes(cat.id);
                                    return (
                                        <motion.button
                                            key={cat.id}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleInterest(cat.id)}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '14px 10px',
                                                borderRadius: '14px',
                                                border: selected
                                                    ? '2px solid var(--primary, #7c3aed)'
                                                    : '2px solid rgba(255,255,255,0.12)',
                                                background: selected
                                                    ? 'rgba(124, 58, 237, 0.18)'
                                                    : 'rgba(255,255,255,0.04)',
                                                cursor: 'pointer',
                                                transition: 'border 0.2s, background 0.2s',
                                                color: 'var(--text-primary, #fff)',
                                            }}
                                        >
                                            {selected && (
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary, #7c3aed)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '9px',
                                                }}>
                                                    <FaCheck color="#fff" />
                                                </span>
                                            )}
                                            <span style={{ fontSize: '28px' }}>{cat.emoji}</span>
                                            <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
                                                {cat.label}
                                            </span>
                                            <span style={{ fontSize: '10px', opacity: 0.6, textAlign: 'center', lineHeight: 1.2 }}>
                                                {cat.desc}
                                            </span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                            {selectedInterests.length > 0 && (
                                <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', opacity: 0.7 }}>
                                    {t('onboarding.selectedCount', { count: selectedInterests.length })}
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="onboarding-nav">
                    {step > 1 && (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleBack}
                            style={{ flex: 1 }}
                        >
                            {t('onboarding.btnBack')}
                        </button>
                    )}
                    {step < TOTAL_STEPS ? (
                        <button
                            type="button"
                            className="btn-dream"
                            onClick={handleNext}
                            style={{ flex: 1, width: step === 1 ? '100%' : 'auto' }}
                        >
                            {t('onboarding.btnNext')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn-dream"
                            onClick={handleFinish}
                            disabled={loading}
                            style={{ flex: 1 }}
                        >
                            {loading ? t('onboarding.btnSaving') : t('onboarding.btnFinish')}
                        </button>
                    )}
                </div>

                {/* Skip na última etapa */}
                {step === TOTAL_STEPS && !loading && (
                    <button
                        type="button"
                        onClick={handleFinish}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '12px',
                            marginTop: '8px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        {t('onboarding.btnSkip')}
                    </button>
                )}
            </motion.div>
        </div>
    );
};

export default Onboarding;
