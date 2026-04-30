import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Link } from 'react-router-dom';
import { search } from '../services/api';

/**
 * MentionTextarea – Textarea com autocomplete de menções (@usuario).
 *
 * Quando o usuário digita '@' seguido de caracteres, uma lista de sugestões
 * é exibida. Ao selecionar um usuário, o @nome_usuario é inserido no texto.
 *
 * Props:
 *   - value: string controlada externamente
 *   - onChange: callback(novoTexto)
 *   - placeholder, className, autoFocus, rows, style: passados direto ao <textarea>
 */
const MentionTextarea = forwardRef(({
    value,
    onChange,
    placeholder,
    className = '',
    autoFocus = false,
    rows,
    style,
    onFocus,
    onBlur,
    onKeyDown: externalKeyDown,
}, ref) => {
    const textareaRef = useRef(null);
    const dropdownRef = useRef(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartPos, setMentionStartPos] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);

    // Expose the textarea ref to parent via forwardRef
    useImperativeHandle(ref, () => textareaRef.current);

    // Detect '@' trigger on every keystroke
    const detectMention = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);

        // Find the last '@' that isn't preceded by a word character
        const mentionMatch = textBeforeCursor.match(/(?:^|[^@\w])@([A-Za-z0-9_]{0,50})$/);

        if (mentionMatch) {
            const query = mentionMatch[1];
            // Calculate start position: cursorPos - query.length - 1 (for '@')
            const startPos = cursorPos - query.length - 1;
            setMentionQuery(query);
            setMentionStartPos(startPos);
            setSelectedIndex(0);

            if (query.length >= 1) {
                // Debounce API calls
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                    fetchSuggestions(query);
                }, 250);
            } else {
                // '@' typed but no chars yet – show nothing
                setSuggestions([]);
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
            setMentionQuery('');
            setMentionStartPos(null);
        }
    }, [value]);

    const fetchSuggestions = async (query) => {
        setLoading(true);
        try {
            const response = await search(query, 'users', 8);
            const data = response.data;
            // API returns { results: { users: [...] }, counts: {...} }
            const users = data?.results?.users || data?.users || [];
            setSuggestions(users.slice(0, 8));
            setShowSuggestions(users.length > 0);
        } catch (err) {
            console.error('Error fetching mention suggestions:', err);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setLoading(false);
        }
    };

    // Insert the selected mention into the text
    const insertMention = useCallback((user) => {
        const username = user.nome_usuario;
        // The '@' is at mentionStartPos, the query follows after it
        const before = value.substring(0, mentionStartPos);
        const after = value.substring(mentionStartPos + 1 + mentionQuery.length); // +1 for '@'
        const newText = `${before}@${username} ${after}`;

        onChange(newText);
        setShowSuggestions(false);
        setMentionQuery('');
        setMentionStartPos(null);

        // Restore focus and cursor position after React re-render
        setTimeout(() => {
            if (textareaRef.current) {
                const newCursorPos = before.length + 1 + username.length + 1; // @username + space
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    }, [value, onChange, mentionStartPos, mentionQuery]);

    // Handle keyboard navigation inside the dropdown
    const handleKeyDown = (e) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(suggestions[selectedIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
        }
        // Pass through to external handler
        if (externalKeyDown) externalKeyDown(e);
    };

    // Re-detect mention on value or cursor changes
    const handleInput = (e) => {
        onChange(e.target.value);
    };

    useEffect(() => {
        detectMention();
    }, [value, detectMention]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                textareaRef.current && !textareaRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Compute dropdown position relative to textarea
    const getDropdownPosition = () => {
        // For simplicity, position below the textarea
        return { top: '100%', left: 0 };
    };

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={placeholder}
                className={className}
                autoFocus={autoFocus}
                rows={rows}
                style={style}
            />

            {/* Mention Suggestions Dropdown */}
            {showSuggestions && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto
                               bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-white/10
                               rounded-xl shadow-2xl"
                    style={getDropdownPosition()}
                >
                    {loading && suggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">
                            Buscando...
                        </div>
                    ) : (
                        suggestions.map((user, index) => (
                            <button
                                key={user.id_usuario}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    insertMention(user);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                    ${index === selectedIndex
                                        ? 'bg-primary/10 dark:bg-primary/20'
                                        : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <img
                                    src={user.avatar_url || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                                    alt={user.nome_usuario}
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {user.nome_completo}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        @{user.nome_usuario}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
});

MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;
