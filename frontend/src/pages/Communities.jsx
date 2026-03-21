import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import CreateCommunityModal from '../components/CreateCommunityModal';
import { getCommunities, createCommunity } from '../services/api';
import { useTranslation } from 'react-i18next';

const Communities = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCommunities();
    }, []);

    const fetchCommunities = async () => {
        try {
            setLoading(true);
            const response = await getCommunities();
            setCommunities(response.data.results ? response.data.results : response.data);
        } catch (error) {
            console.error('Error fetching communities:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCommunity = async (newCommunity) => {
        try {
            const formData = new FormData();
            formData.append('nome', newCommunity.name);
            formData.append('descricao', newCommunity.description);
            if (newCommunity.image) {
                formData.append('imagem', newCommunity.image);
            }

            await createCommunity(formData);
            fetchCommunities(); // Refresh list
        } catch (error) {
            console.error('Error creating community:', error);
            // Optionally show error to user
        }
    };

    return (
        <div className="flex flex-col gap-6 relative">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-primary">{t('communities.title')}</h1>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                >
                    <FaPlus /> {t('communities.btnCreate')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {communities.map((community) => (
                        <div key={community.id_comunidade} className="bg-white dark:bg-[#1a1b1e] rounded-xl p-5 shadow-card hover:shadow-lg transition-all border border-transparent hover:border-primary/20 group">
                            <div className="flex items-start gap-4">
                                <img
                                    src={community.imagem || `https://picsum.photos/seed/${community.nome}/100/100`}
                                    alt={community.nome}
                                    className="w-16 h-16 rounded-xl object-cover bg-gray-100 dark:bg-gray-800"
                                />
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-text-main dark:text-white mb-1 group-hover:text-primary transition-colors">
                                        {community.nome}
                                    </h3>
                                    <p className="text-text-secondary dark:text-gray-400 text-sm mb-3 line-clamp-2">
                                        {community.descricao}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-xs text-text-secondary dark:text-gray-500 font-medium">
                                            <FaUsers className="text-primary" />
                                            {community.membros_count} {t('communities.members')}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/community/${community.id_comunidade}`)}
                                                className="px-4 py-1.5 rounded-full text-sm font-bold bg-primary-light/10 text-primary hover:bg-primary hover:text-white transition-colors"
                                            >
                                                {t('communities.btnVisit')}
                                            </button>
                                            <button className="px-4 py-1.5 rounded-full text-sm font-bold border border-primary text-primary hover:bg-primary-light/10 transition-colors">
                                                {community.is_member ? t('communities.btnLeave') : t('communities.btnJoin')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateCommunityModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreateCommunity}
            />
        </div>
    );
};

export default Communities;
