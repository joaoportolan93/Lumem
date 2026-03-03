import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaEye, FaLock } from 'react-icons/fa';
import { getProfile, updateUser, uploadAvatar } from '../services/api';
import { useTranslation } from 'react-i18next';
import '../styles/Auth.css';

const Onboarding = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Profile data
    const [avatar, setAvatar] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');

    // Step 2: Privacy setting
    const [privacy, setPrivacy] = useState('public');

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleNext = () => {
        if (step === 1) {
            if (!displayName.trim()) {
                setError(t('onboarding.errEmptyDisplayName'));
                return;
            }
            setError('');
            setStep(2);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
            setError('');
        }
    };

    const handleFinish = async () => {
        setLoading(true);
        setError('');

        try {
            // Get current user profile to get user ID
            const profileResponse = await getProfile();
            const userId = profileResponse.data.id_usuario;

            // Upload avatar if selected
            if (avatar) {
                await uploadAvatar(avatar);
            }

            // Update profile data
            await updateUser(userId, {
                nome_completo: displayName,
                bio: bio,
                privacidade_padrao: privacy === 'private' ? 2 : 1,
            });

            // Redirect to home/feed
            navigate('/');
        } catch (err) {
            console.error('Onboarding error:', err);
            setError(t('onboarding.errSaveProfile'));
        } finally {
            setLoading(false);
        }
    };

    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction) => ({
            x: direction > 0 ? -300 : 300,
            opacity: 0,
        }),
    };

    const [[page, direction], setPage] = useState([1, 0]);

    const paginate = (newDirection) => {
        setPage([step + newDirection, newDirection]);
    };

    return (
        <div className="auth-bg">
            <motion.div
                className="glass-card onboarding-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* Progress Bar */}
                <div className="progress-bar">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}></div>
                </div>

                <h1 className="auth-title">
                    {step === 1 ? t('onboarding.step1Title') : t('onboarding.step2Title')}
                </h1>
                <p className="auth-subtitle">
                    {step === 1
                        ? t('onboarding.step1Subtitle')
                        : t('onboarding.step2Subtitle')}
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

                <AnimatePresence mode="wait" custom={direction}>
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
                            {/* Avatar Upload */}
                            <div
                                className="avatar-upload"
                                onClick={handleAvatarClick}
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" />
                                ) : (
                                    <FaUser size={40} />
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />

                            {/* Display Name */}
                            <input
                                type="text"
                                className="auth-input"
                                placeholder={t('onboarding.placeholderDisplayName')}
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />

                            {/* Bio */}
                            <textarea
                                className="auth-textarea"
                                placeholder={t('onboarding.placeholderBio')}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                            ></textarea>
                        </motion.div>
                    )}

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
                            {/* Privacy Selection Cards */}
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
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="onboarding-nav">
                    {step > 1 && (
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                paginate(-1);
                                handleBack();
                            }}
                        >
                            {t('onboarding.btnBack')}
                        </button>
                    )}
                    {step < 2 ? (
                        <button
                            className="btn-dream"
                            onClick={() => {
                                if (displayName.trim()) {
                                    paginate(1);
                                    handleNext();
                                } else {
                                    setError(t('onboarding.errEmptyDisplayName'));
                                }
                            }}
                            style={{ flex: step > 1 ? 1 : 'none', width: step === 1 ? '100%' : 'auto' }}
                        >
                            {t('onboarding.btnNext')}
                        </button>
                    ) : (
                        <button
                            className="btn-dream"
                            onClick={handleFinish}
                            disabled={loading}
                            style={{ flex: 1 }}
                        >
                            {loading ? t('onboarding.btnSaving') : t('onboarding.btnFinish')}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;
