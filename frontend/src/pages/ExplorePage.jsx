import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaFire,
    FaRandom,
    FaHeart,
    FaStar,
    FaMoon,
    FaEye,
    FaMobileAlt,
    FaCloud,
    FaHashtag,
    FaTheaterMasks,
    FaTrophy,
    FaUsers,
    FaChevronRight,
    FaRegCommentDots,
    FaSyncAlt
} from 'react-icons/fa';
import { getTrends, getTopCommunityPosts } from '../services/api';
import SuggestionsCard from '../components/SuggestionsCard';
import { useTranslation } from 'react-i18next';

const ExplorePage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();


    // API Data
    const [trends, setTrends] = useState({ hashtags: [], emocoes: [], tipos_sonho: [] });
    const [topPosts, setTopPosts] = useState({ posts: [], comunidades: [] });

    const [loadingTrends, setLoadingTrends] = useState(true);
    const [loadingTopPosts, setLoadingTopPosts] = useState(true);

    // Active trends tab
    const [activeTrendTab, setActiveTrendTab] = useState('hashtags');

    // Randomized tips
    const allTips = t('explore.tips', { returnObjects: true }) || [
        { icon: <FaMoon className="text-blue-300" />, text: "Mantenha um horário de sono regular." },
        { icon: <FaEye className="text-purple-300" />, text: "Antes de dormir, repita mentalmente: 'Hoje eu vou lembrar dos meus sonhos'. Parece mágica, mas a neurociência chama de Memória Prospectiva. Funciona!" },
        { icon: <FaMobileAlt className="text-red-300" />, text: "Evite telas 1h antes de dormir." },
        { icon: <FaCloud className="text-white/60" />, text: "Anote seus sonhos assim que acordar." },
        { icon: <FaCloud className="text-cyan-300" />, text: "Não consegue desligar? Inspire pelo nariz por 4 segundos, segure por 7 e solte pela boca por 8. Isso 'hackeia' seu nervo vago e força o corpo a relaxar fisicamente." },
        { icon: <FaStar className="text-yellow-300" />, text: "Exponha-se à luz natural assim que acordar. A luz do sol zera a produção de melatonina e ajusta seu relógio interno para você sentir sono na hora certa à noite." },
        { icon: <FaMoon className="text-indigo-300" />, text: "Pesadelos muitas vezes são o cérebro tentando processar emoções difíceis do dia. Registrá-los ajuda a entender seus medos e superar traumas." },
        { icon: <FaEye className="text-amber-300" />, text: "A cafeína tem uma 'meia-vida' longa. Aquele espresso das 17h ainda está 50% ativo no seu sangue na hora de dormir, impedindo você de entrar no sono REM profundo onde os sonhos acontecem." },
    ];
    // Attach icons back since JSON doesn't store JSX components
    const icons = [
        <FaMoon className="text-blue-300" />,
        <FaEye className="text-purple-300" />,
        <FaMobileAlt className="text-red-300" />,
        <FaCloud className="text-white/60" />,
        <FaCloud className="text-cyan-300" />,
        <FaStar className="text-yellow-300" />,
        <FaMoon className="text-indigo-300" />,
        <FaEye className="text-amber-300" />
    ];
    const tipsWithIcons = allTips.map((tip, idx) => ({ ...tip, icon: icons[idx % icons.length] }));

    const shuffleTips = () => {
        const shuffled = [...tipsWithIcons].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4);
    };

    const [randomTips, setRandomTips] = useState(() => shuffleTips());



    // Auto-shuffle every 2 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            setRandomTips(shuffleTips());
        }, 120000); // 2 minutes

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchTrends();
        fetchTopPosts();
    }, []);

    const fetchTrends = async () => {
        try {
            setLoadingTrends(true);
            const res = await getTrends();
            setTrends(res.data);
        } catch (err) {
            console.error('Error fetching trends:', err);
        } finally {
            setLoadingTrends(false);
        }
    };

    const fetchTopPosts = async () => {
        try {
            setLoadingTopPosts(true);
            const res = await getTopCommunityPosts();
            setTopPosts(res.data);
        } catch (err) {
            console.error('Error fetching top community posts:', err);
        } finally {
            setLoadingTopPosts(false);
        }
    };



    // Get current trend items based on active tab
    const currentTrendItems = activeTrendTab === 'hashtags'
        ? trends.hashtags
        : activeTrendTab === 'emocoes'
            ? trends.emocoes
            : trends.tipos_sonho;

    return (
        <div className="w-full min-h-screen bg-background-main dark:bg-cosmic-bg text-text-main dark:text-white p-4 font-sans transition-colors duration-300">
            <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* === MAIN COLUMN (70%) === */}
                <div className="lg:col-span-8 space-y-8">

                    {/* 1. Hero Banner */}
                    <div className="relative overflow-hidden rounded-2xl p-8 h-[280px] flex items-center shadow-cosmic-glow group">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 opacity-90 z-0"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 z-0"></div>
                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cosmic-accent blur-[100px] opacity-40 rounded-full"></div>

                        <div className="relative z-10 max-w-2xl">
                            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 drop-shadow-sm">
                                {t('explore.heroTitle')}
                            </h1>
                            <p className="text-lg text-blue-100 max-w-lg leading-relaxed">
                                {t('explore.heroDesc')}
                            </p>
                        </div>
                    </div>

                    {/* ============================== */}
                    {/* 2. TRENDS SECTION */}
                    {/* ============================== */}
                    <div className="bg-white dark:bg-cosmic-card/80 dark:backdrop-blur-md border border-border dark:border-white/10 rounded-2xl p-6 shadow-card dark:shadow-soft">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <FaFire className="text-orange-400 text-xl" />
                                <h2 className="text-xl font-bold text-text-main dark:text-white">{t('explore.trendsTitle')}</h2>
                            </div>
                        </div>

                        {/* Trend Sub-tabs */}
                        <div className="flex gap-2 mb-5 border-b border-border dark:border-white/10 pb-3">
                            <TrendTab
                                label={t('explore.tabHashtags')}
                                icon={<FaHashtag />}
                                active={activeTrendTab === 'hashtags'}
                                onClick={() => setActiveTrendTab('hashtags')}
                            />
                            <TrendTab
                                label={t('explore.tabEmotions')}
                                icon={<FaTheaterMasks />}
                                active={activeTrendTab === 'emocoes'}
                                onClick={() => setActiveTrendTab('emocoes')}
                            />
                            <TrendTab
                                label={t('explore.tabTypes')}
                                icon={<FaMoon />}
                                active={activeTrendTab === 'tipos_sonho'}
                                onClick={() => setActiveTrendTab('tipos_sonho')}
                            />
                        </div>

                        {/* Trend Content */}
                        {loadingTrends ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : currentTrendItems.length === 0 ? (
                            <p className="text-center text-text-secondary dark:text-cosmic-text-muted py-6 text-sm">
                                {t('explore.emptyTrends')}
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {currentTrendItems.map((item, index) => (
                                    <TrendPill
                                        key={index}
                                        text={activeTrendTab === 'hashtags' ? `#${item.texto_hashtag}` : item.nome}
                                        count={activeTrendTab === 'hashtags' ? item.contagem_uso : item.contagem}
                                        rank={index + 1}
                                        type={activeTrendTab}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ============================== */}
                    {/* 3. TOP COMMUNITY POSTS */}
                    {/* ============================== */}
                    <div className="bg-white dark:bg-cosmic-card/80 dark:backdrop-blur-md border border-border dark:border-white/10 rounded-2xl p-6 shadow-card dark:shadow-soft">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <FaTrophy className="text-yellow-400 text-xl" />
                                <h2 className="text-xl font-bold text-text-main dark:text-white">{t('explore.highlightsTitle')}</h2>
                            </div>
                            <button
                                onClick={fetchTopPosts}
                                className="flex items-center gap-1 text-xs text-primary dark:text-cosmic-accent hover:text-primary-dark dark:hover:text-white transition-colors font-semibold uppercase tracking-wide"
                            >
                                <FaRandom size={10} /> {t('explore.btnShuffle')}
                            </button>
                        </div>

                        {/* Featured Communities Pills */}
                        {topPosts.comunidades.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-5">
                                {topPosts.comunidades.map((com) => (
                                    <button
                                        key={com.id_comunidade}
                                        onClick={() => navigate(`/Community/${com.id_comunidade}`)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-border dark:border-white/10 text-xs font-medium text-text-secondary dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                                    >
                                        {com.imagem ? (
                                            <img src={com.imagem} alt={com.nome} className="w-4 h-4 rounded-full object-cover" />
                                        ) : (
                                            <FaUsers className="text-purple-400" size={12} />
                                        )}
                                        {com.nome}
                                        <span className="text-[10px] text-text-secondary/50 dark:text-white/30">{com.membros_count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Top Posts List */}
                        {loadingTopPosts ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : topPosts.posts.length === 0 ? (
                            <p className="text-center text-text-secondary dark:text-cosmic-text-muted py-6 text-sm">
                                {t('explore.emptyCommPosts')}
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {topPosts.posts.map((post, index) => (
                                    <TopPostItem key={post.id_publicacao} post={post} rank={index + 1} navigate={navigate} />
                                ))}
                            </div>
                        )}
                    </div>


                </div>

                {/* === SIDEBAR COLUMN (30%) === */}
                <div className="lg:col-span-4 space-y-8 hidden lg:block">

                    {/* Widget: Sugestões para seguir — shared component */}
                    <SuggestionsCard variant="sidebar" maxUsers={5} />


                    {/* Widget: Dicas de Sono */}
                    <div className="bg-white dark:bg-gradient-to-b dark:from-purple-900/50 dark:to-cosmic-card border border-border dark:border-white/10 rounded-2xl p-6 shadow-card dark:shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div>
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-300">
                                    <FaStar className="text-xl" />
                                    <h3 className="text-lg font-bold uppercase tracking-wider text-text-main dark:text-white">{t('explore.tipsTitle')}</h3>
                                </div>
                                <button
                                    onClick={() => setRandomTips(shuffleTips())}
                                    className="p-1.5 rounded-lg text-text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-primary dark:hover:text-cosmic-accent transition-colors"
                                    title={t('explore.tooltipNewTips')}
                                >
                                    <FaSyncAlt size={12} />
                                </button>
                            </div>
                        </div>
                        <div className="min-h-[180px]">
                            <AnimatePresence mode="wait">
                                <motion.ul
                                    key={randomTips.map(t => t.text).join('')} // Trigger animation on change
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.5 }}
                                    className="space-y-3"
                                >
                                    {randomTips.map((tip, i) => (
                                        <TipItem key={i} icon={tip.icon} text={tip.text} />
                                    ))}
                                </motion.ul>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Widget: Insights de Sonhos */}
                    <div className="bg-white dark:bg-gradient-to-br dark:from-indigo-900/40 dark:to-cosmic-card border border-border dark:border-white/10 rounded-2xl p-6 shadow-card relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-pink-500 blur-[80px] opacity-20"></div>

                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-xl text-primary dark:text-purple-300">
                                <FaCloud size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-text-main dark:text-white">{t('explore.insightFlyTitle')}</h4>
                                <span className="text-xs text-primary dark:text-purple-300 uppercase font-semibold tracking-wide">{t('explore.insightWeekly')}</span>
                            </div>
                        </div>
                        <p className="text-sm text-text-secondary dark:text-gray-300 leading-relaxed mb-4">
                            {t('explore.insightFlyDesc')}
                        </p>
                        <div className="flex gap-2">
                            <div className="h-1 flex-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full w-3/4 bg-purple-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-text-secondary dark:text-gray-400">{t('explore.insightStat')}</span>
                        </div>
                    </div>

                    {/* Small Footer Links */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary/50 dark:text-white/20 px-2 text-center justify-center">
                        <button onClick={() => navigate('/about')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerAbout')}</button>
                        <button onClick={() => navigate('/privacy')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerPrivacy')}</button>
                        <button onClick={() => navigate('/terms')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerTerms')}</button>
                        <button onClick={() => navigate('/help')} className="hover:text-text-main dark:hover:text-white/50 transition-colors">{t('explore.footerHelp')}</button>
                        <span>© 2025 DreamShare</span>
                    </div>

                </div>
            </div>
        </div>
    );
};

/* --- Subcomponents --- */

const TipItem = ({ icon, text }) => (
    <li className="flex items-center gap-3 text-sm text-text-secondary dark:text-gray-300 p-2 rounded-lg bg-gray-100 dark:bg-black/10 hover:bg-gray-200 dark:hover:bg-black/20 transition-colors cursor-default">
        <span className="text-lg">{icon}</span>
        {text}
    </li>
);

const TrendTab = ({ label, icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${active
            ? 'bg-primary/10 dark:bg-cosmic-accent/20 text-primary dark:text-cosmic-accent border border-primary/20 dark:border-cosmic-accent/30'
            : 'text-text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
    >
        {icon}
        {label}
    </button>
);

const TrendPill = ({ text, count, rank, type }) => {
    const colors = {
        hashtags: 'from-blue-500/10 to-purple-500/10 border-blue-500/20 dark:border-blue-400/20 hover:border-blue-500/40',
        emocoes: 'from-pink-500/10 to-red-500/10 border-pink-500/20 dark:border-pink-400/20 hover:border-pink-500/40',
        tipos_sonho: 'from-indigo-500/10 to-violet-500/10 border-indigo-500/20 dark:border-indigo-400/20 hover:border-indigo-500/40',
    };

    return (
        <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${colors[type]} border transition-all hover:scale-[1.02] active:scale-[0.98]`}>
            {rank <= 3 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                    rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                        'bg-amber-600/20 text-amber-600'
                    }`}>
                    #{rank}
                </span>
            )}
            <span className="text-sm font-semibold text-text-main dark:text-white">{text}</span>
            <span className="text-[10px] text-text-secondary dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                {count}
            </span>
        </button>
    );
};

const TopPostItem = ({ post, rank, navigate }) => {
    const { t } = useTranslation();
    const rankColors = {
        1: 'text-yellow-500 bg-yellow-500/10',
        2: 'text-gray-400 bg-gray-400/10',
        3: 'text-amber-600 bg-amber-600/10',
    };

    return (
        <div
            onClick={() => navigate(`/community/${post.comunidade_id}`)}
            className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-transparent hover:border-primary/20 dark:hover:border-cosmic-accent/20 transition-all cursor-pointer group"
        >
            {/* Rank */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${rankColors[rank] || 'text-text-secondary dark:text-gray-500 bg-gray-100 dark:bg-white/5'
                }`}>
                {rank}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    {post.comunidade_nome && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-500/20 px-2 py-0.5 rounded">
                            {post.comunidade_nome}
                        </span>
                    )}
                </div>
                <h4 className="text-sm font-bold text-text-main dark:text-white group-hover:text-primary dark:group-hover:text-purple-300 transition-colors truncate">
                    {post.titulo || post.conteudo_texto?.substring(0, 60) + '...'}
                </h4>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-secondary dark:text-gray-400">
                    <span>{t('explore.postBy')} <strong className="text-text-main dark:text-white">{post.usuario?.nome_usuario}</strong></span>
                    <span className="flex items-center gap-1"><FaHeart size={10} /> {post.likes_count || 0}</span>
                    <span className="flex items-center gap-1"><FaRegCommentDots size={10} /> {post.comentarios_count || 0}</span>
                </div>
            </div>

            {/* Image thumbnail */}
            {post.imagem && (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden">
                    <img src={post.imagem} alt="" className="w-full h-full object-cover" />
                </div>
            )}

            <FaChevronRight className="flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-primary dark:group-hover:text-cosmic-accent transition-colors mt-3" size={12} />
        </div>
    );
};

export default ExplorePage;
