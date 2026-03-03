import React, { useState, useEffect } from 'react';
import DreamCard from '../components/DreamCard';
import { getDreams } from '../services/api';
import { useTranslation } from 'react-i18next';

const Saved = () => {
    const { t } = useTranslation();
    const [savedDreams, setSavedDreams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSaved = async () => {
            try {
                const response = await getDreams('saved');
                setSavedDreams(response.data);
            } catch (error) {
                console.error('Error fetching saved dreams:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSaved();
    }, []);

    const currentUserId = JSON.parse(localStorage.getItem('user'))?.id;

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-20">
            <h1 className="text-2xl font-bold text-white mb-2">{t('saved.title')}</h1>

            {savedDreams.length > 0 ? (
                savedDreams.map((dream) => (
                    <DreamCard
                        key={dream.id_publicacao}
                        dream={{ ...dream, is_saved: true }}
                        currentUserId={currentUserId}
                    />
                ))
            ) : (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
                    <p className="text-gray-400 text-lg mb-2">{t('saved.empty.title')}</p>
                    <p className="text-gray-500 text-sm">{t('saved.empty.description')}</p>
                </div>
            )}
        </div>
    );
};

export default Saved;
