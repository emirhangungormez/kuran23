import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../infrastructure/supabaseClient'

const PlaylistsContext = createContext()

export function usePlaylists() {
    return useContext(PlaylistsContext)
}

export function PlaylistsProvider({ userId, children }) {
    const [playlists, setPlaylists] = useState([])
    const [loading, setLoading] = useState(false)
    const [activePlaylistId, setActivePlaylistId] = useState(null)

    const fetchPlaylists = async () => {
        if (!userId) {
            setPlaylists([])
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('user_playlists')
                .select('id,user_id,name,items_json,created_at,updated_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error

            setPlaylists((data || []).map((pl) => ({
                ...pl,
                items: Array.isArray(pl.items_json) ? pl.items_json : (pl.items_json || [])
            })))
        } catch {
            setPlaylists([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (userId) fetchPlaylists()
        else setPlaylists([])
    }, [userId])

    const savePlaylist = async (playlist) => {
        if (!userId) throw new Error('Giriş yapmanız gerekiyor.')

        setLoading(true)
        try {
            if (playlist?.id) {
                const { error } = await supabase
                    .from('user_playlists')
                    .update({
                        name: String(playlist.name || '').trim(),
                        items_json: playlist.items || []
                    })
                    .eq('id', playlist.id)
                    .eq('user_id', userId)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('user_playlists')
                    .insert({
                        user_id: userId,
                        name: String(playlist?.name || '').trim(),
                        items_json: playlist?.items || []
                    })

                if (error) throw error
            }

            await fetchPlaylists()
            return { success: true }
        } catch (error) {
            throw new Error(error?.message || 'Liste kaydedilemedi.')
        } finally {
            setLoading(false)
        }
    }

    const deletePlaylist = async (id) => {
        if (!userId) throw new Error('Giriş yapmanız gerekiyor.')

        setLoading(true)
        try {
            const { error } = await supabase
                .from('user_playlists')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)

            if (error) throw error

            await fetchPlaylists()
            return { success: true }
        } catch (error) {
            throw new Error(error?.message || 'Liste silinemedi.')
        } finally {
            setLoading(false)
        }
    }

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
    )
}
