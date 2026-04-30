import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Renderiza texto com @menções como links clicáveis para o perfil do usuário.
 * Também renderiza hashtags como links.
 *
 * Uso: <RenderMentions text="Olá @joao, veja isso!" />
 */
const MENTION_REGEX = /(?<![\\w@])@([A-Za-z0-9_]{1,50})\b/g;

const RenderMentions = ({ text, className = '' }) => {
    if (!text) return null;

    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    MENTION_REGEX.lastIndex = 0;

    while ((match = MENTION_REGEX.exec(text)) !== null) {
        // Add text before the mention
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const username = match[1];
        parts.push(
            <Link
                key={`mention-${match.index}`}
                to={`/search?q=${username}&type=users`}
                className="text-primary hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
            >
                @{username}
            </Link>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    // If no mentions found, return plain text
    if (parts.length === 0) {
        return <span className={className}>{text}</span>;
    }

    return <span className={className}>{parts}</span>;
};

export default RenderMentions;
