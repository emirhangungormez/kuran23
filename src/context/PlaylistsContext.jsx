import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../services/api';

const PlaylistsContext = createContext();

export function usePlaylists() {
    return useContext(PlaylistsContext);
}

export function PlaylistsProvider({ userId, children }) {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activePlaylistId, setActivePlaylistId] = useState(null);

    // Playlistleri API'den çek
    const fetchPlaylists = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/playlists.php?user_id=${userId}&t=${Date.now()}`);
            const data = await res.json();
            if (!res.ok || data?.error) {
                throw new Error(data?.error || 'Playlistler yüklenemedi.');
            }
            setPlaylists(data.playlists || []);
        } catch (e) {
            setPlaylists([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) fetchPlaylists();
    }, [userId]);

    // Playlist oluştur/güncelle
    const savePlaylist = async (playlist) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/playlists.php?user_id=${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playlist),
            });
            const data = await res.json();
            if (!res.ok || data?.error || data?.success === false) {
                throw new Error(data?.error || 'Liste kaydedilemedi.');
            }
            await fetchPlaylists();
            return data;
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Playlist sil
    const deletePlaylist = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/playlists.php?user_id=${userId}&id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok || data?.error || data?.success === false) {
                throw new Error(data?.error || 'Liste silinemedi.');
            }
            await fetchPlaylists();
            return data;
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return (
        <PlaylistsContext.Provider value={{
            playlists,
            loading,
            fetchPlaylists,
            savePlaylist,
            deletePlaylist,
            activePlaylistId,
            setActivePlaylistId
        }}>
            {children}
        </PlaylistsContext.Provider>
    );
}
