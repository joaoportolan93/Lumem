import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import Markdown from 'react-markdown';

/**
 * Componente genérico para renderizar páginas de conteúdo legal/institucional
 * a partir de strings Markdown. Usado por: Termos de Uso, Política de Privacidade,
 * Ajuda (FAQ) e Sobre.
 */
const LegalPage = ({ content, icon }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background-main dark:bg-cosmic-bg text-text-main dark:text-white transition-colors duration-300">
            <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">

                {/* Botão Voltar */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-white transition-colors mb-6"
                >
                    <FaArrowLeft size={14} />
                    Voltar
                </button>

                {/* Card principal */}
                <div className="bg-white dark:bg-cosmic-card/80 dark:backdrop-blur-md border border-border dark:border-white/10 rounded-2xl p-6 sm:p-10 shadow-card dark:shadow-soft">

                    {/* Ícone decorativo no topo */}
                    {icon && (
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-primary/10 dark:bg-white/5 rounded-2xl text-primary dark:text-purple-300">
                                {icon}
                            </div>
                        </div>
                    )}

                    {/* Conteúdo Markdown renderizado */}
                    <div className="legal-content">
                        <Markdown
                            components={{
                                h1: ({ children }) => (
                                    <h1 className="text-2xl sm:text-3xl font-bold text-text-main dark:text-white mb-2 text-center">
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="text-xl font-bold text-text-main dark:text-white mt-8 mb-3">
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-lg font-bold text-text-main dark:text-white mt-6 mb-2">
                                        {children}
                                    </h3>
                                ),
                                h4: ({ children }) => (
                                    <h4 className="text-base font-semibold text-text-main dark:text-white mt-4 mb-1">
                                        {children}
                                    </h4>
                                ),
                                p: ({ children }) => (
                                    <p className="text-sm sm:text-base text-text-secondary dark:text-gray-300 leading-relaxed mb-4">
                                        {children}
                                    </p>
                                ),
                                strong: ({ children }) => (
                                    <strong className="font-bold text-text-main dark:text-white">{children}</strong>
                                ),
                                em: ({ children }) => (
                                    <em className="italic text-text-secondary dark:text-gray-400">{children}</em>
                                ),
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary dark:text-purple-400 hover:text-primary-dark dark:hover:text-purple-300 underline underline-offset-2 transition-colors"
                                    >
                                        {children}
                                    </a>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-inside space-y-2 mb-4 text-sm sm:text-base text-text-secondary dark:text-gray-300 pl-2">
                                        {children}
                                    </ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-inside space-y-2 mb-4 text-sm sm:text-base text-text-secondary dark:text-gray-300 pl-2">
                                        {children}
                                    </ol>
                                ),
                                li: ({ children }) => (
                                    <li className="leading-relaxed">{children}</li>
                                ),
                                hr: () => (
                                    <hr className="border-border dark:border-white/10 my-6" />
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-primary/30 dark:border-purple-500/30 pl-4 py-2 my-4 bg-primary/5 dark:bg-white/5 rounded-r-lg">
                                        {children}
                                    </blockquote>
                                ),
                            }}
                        >
                            {content}
                        </Markdown>
                    </div>
                </div>

                {/* Footer mini */}
                <div className="text-center mt-8 text-xs text-text-secondary/50 dark:text-white/20">
                    © {new Date().getFullYear()} Lumem — Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
};

export default LegalPage;
