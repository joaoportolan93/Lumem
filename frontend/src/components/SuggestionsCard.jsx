import React from 'react';
import { Link } from 'react-router-dom';
import { FaUserPlus, FaCheck } from 'react-icons/fa';
import { useSuggestions } from '../contexts/SuggestionsContext';
import { useTranslation } from 'react-i18next';

/**
 * Shared "Sugestões para seguir" card.
 * Reads data from SuggestionsContext (single fetch, shared across all instances).
 *
 * @param {"sidebar"|"explore"} variant  – visual style
 * @param {number}              maxUsers – how many suggestions to show (default 5)
 */
const SuggestionsCard = ({ variant = 'sidebar', maxUsers = 5 }) => {
    const { t } = useTranslation();
    const { suggestions, loading, followingIds, toggleFollow } = useSuggestions();

    const visibleUsers = suggestions.slice(0, maxUsers);

    /* ── Variant-specific classes ── */
    const isExplore = variant === 'explore';

    const cardClass = isExplore
        ? 'bg-white dark:bg-cosmic-card/80 dark:backdrop-blur-md border border-border dark:border-white/10 rounded-2xl p-6 shadow-card dark:shadow-soft'
        : 'bg-white dark:bg-cosmic-card dark:border dark:border-white/5 rounded-xl p-5 shadow-card transition-colors duration-300';

    const titleClass = isExplore
        ? 'text-lg font-bold mb-6 text-text-main dark:text-white border-b border-border dark:border-white/5 pb-2'
        : 'text-text-main dark:text-white font-bold text-sm mb-4';

    const listClass = isExplore ? 'space-y-5' : 'flex flex-col gap-4';

    /* ── Render ── */
    return (
        <div className={cardClass}>
            <h3 className={titleClass}>{t('suggestions.title')}</h3>

            {loading ? (
                <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : visibleUsers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('suggestions.empty')}</p>
            ) : (
                <div className={listClass}>
                    {visibleUsers.map((user) => (
                        <UserRow
                            key={user.id_usuario}
                            user={user}
                            isFollowing={followingIds.includes(user.id_usuario)}
                            onToggleFollow={() => toggleFollow(user.id_usuario)}
                            variant={variant}
                        />
                    ))}
                </div>
            )}

            {isExplore && visibleUsers.length > 0 && (
                <button className="w-full mt-6 text-xs text-primary dark:text-cosmic-accent hover:text-primary-dark dark:hover:text-white transition-colors uppercase tracking-widest font-bold">
                    {t('suggestions.btnViewMore')}
                </button>
            )}
        </div>
    );
};

/* ── Single user row ── */
const UserRow = ({ user, isFollowing, onToggleFollow, variant }) => {
    const { t } = useTranslation();
    const isExplore = variant === 'explore';

    if (isExplore) {
        return (
            <div className="flex items-center justify-between group">
                <Link to={`/user/${user.id_usuario}`} className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden ring-2 ring-transparent group-hover:ring-primary dark:group-hover:ring-cosmic-accent transition-all flex-shrink-0">
                        <img
                            src={user.avatar_url || `https://i.pravatar.cc/150?u=${user.id_usuario}`}
                            alt={user.nome_usuario}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight text-text-main dark:text-white truncate">
                            {user.nome_completo || user.nome_usuario}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-cosmic-text-muted truncate">
                            @{user.nome_usuario}
                        </p>
                    </div>
                </Link>
                <button
                    onClick={onToggleFollow}
                    className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-glow ${isFollowing
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-cosmic-accent hover:bg-violet-600 text-white'
                        }`}
                >
                    {isFollowing ? (
                        <><FaCheck size={10} /> {t('suggestions.btnFollowing')}</>
                    ) : (
                        <><FaUserPlus size={10} /> {t('suggestions.btnFollow')}</>
                    )}
                </button>
            </div>
        );
    }

    /* sidebar variant */
    return (
        <div className="flex items-center gap-3">
            <Link to={`/user/${user.id_usuario}`} className="flex-shrink-0">
                <img
                    src={user.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                    alt={user.nome_usuario}
                    className="w-10 h-10 rounded-full object-cover"
                />
            </Link>
            <Link to={`/user/${user.id_usuario}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <span className="text-sm font-bold text-text-main dark:text-white block truncate">{user.nome_usuario}</span>
                <span className="text-xs text-text-secondary dark:text-gray-400 block truncate">
                    {user.bio || t('suggestions.defaultBio')}
                </span>
            </Link>
            <button
                onClick={onToggleFollow}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${isFollowing
                        ? 'bg-gray-600 text-gray-300 cursor-default'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
            >
                {isFollowing ? t('suggestions.btnFollowing') : t('suggestions.btnFollow')}
            </button>
        </div>
    );
};

export default SuggestionsCard;
