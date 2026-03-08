import Avatar from "boring-avatars";

const avatarColors = ["#1d7a5f", "#e67e22", "#3498db", "#9b59b6", "#e74c3c"];

export const profileIcons = [
    {
        id: 'beam1',
        name: 'İrfan Sahibi',
        desc: 'Bilge Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Arif" variant="beam" colors={avatarColors} />
    },
    {
        id: 'beam2',
        name: 'Cömerthâne',
        desc: 'Cömert Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Kerem" variant="beam" colors={["#2c3e50", "#1d7a5f", "#95a5a6", "#34495e", "#ecf0f1"]} />
    },
    {
        id: 'beam3',
        name: 'Zarif Ruh',
        desc: 'Zarif Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Ayşe" variant="beam" colors={["#e91e63", "#f06292", "#f8bbd0", "#880e4f", "#ff80ab"]} />
    },
    {
        id: 'beam4',
        name: 'Gönül Ehli',
        desc: 'Duygulu Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Leyla" variant="beam" colors={["#673ab7", "#9575cd", "#d1c4e9", "#311b92", "#b388ff"]} />
    },
    {
        id: 'beam5',
        name: 'Vakar Sahibi',
        desc: 'Azametli Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Süleyman" variant="beam" colors={["#3f51b5", "#7986cb", "#c5cae9", "#1a237e", "#8c9eff"]} />
    },
    {
        id: 'beam6',
        name: 'Dervişmizah',
        desc: 'Derviş Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Yunus" variant="beam" colors={["#4caf50", "#81c784", "#c8e6c9", "#1b5e20", "#b9f6ca"]} />
    },
    {
        id: 'beam7',
        name: 'Afife',
        desc: 'Masum Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Meryem" variant="beam" colors={["#ffeb3b", "#fff176", "#fff9c4", "#f57f17", "#ffff8d"]} />
    },
    {
        id: 'beam8',
        name: 'Sıddık',
        desc: 'Sadık Karakter',
        component: (props) => <Avatar size={props.size || 24} name="İbrahim" variant="beam" colors={["#ff9800", "#ffb74d", "#ffe0b2", "#e65100", "#ffd180"]} />
    },
    {
        id: 'beam9',
        name: 'Mütefekkir',
        desc: 'Düşünür Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Farabi" variant="beam" colors={["#607d8b", "#90a4ae", "#cfd8dc", "#37474f", "#b0bec5"]} />
    },
    {
        id: 'beam10',
        name: 'Takva Ehli',
        desc: 'Zahit Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Ahmet" variant="beam" colors={["#795548", "#a1887f", "#d7ccc8", "#4e342e", "#bcaaa4"]} />
    },
    {
        id: 'beam11',
        name: 'Şakir',
        desc: 'Şükreden Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Sukru" variant="beam" colors={["#00bcd4", "#4dd0e1", "#b2ebf2", "#00838f", "#80deea"]} />
    },
    {
        id: 'beam12',
        name: 'Sabir',
        desc: 'Sabreden Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Sabri" variant="beam" colors={["#607db8", "#90a4be", "#cfd8ce", "#37474a", "#b0beda"]} />
    },
    {
        id: 'beam13',
        name: 'Muallim',
        desc: 'Eğitici Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Hoca" variant="beam" colors={["#f44336", "#e57373", "#ffcdd2", "#c62828", "#ef9a9a"]} />
    },
    {
        id: 'beam14',
        name: 'Hafız',
        desc: 'Ezberleyen Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Hafiz" variant="beam" colors={["#2196f3", "#64b5f6", "#bbdefb", "#1565c0", "#90caf9"]} />
    },
    {
        id: 'beam15',
        name: 'Müezzin',
        desc: 'Seslenen Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Bilal" variant="beam" colors={["#9c27b0", "#ba68c8", "#e1bee7", "#6a1b9a", "#ce93d8"]} />
    },
    {
        id: 'beam16',
        name: 'Seyyah',
        desc: 'Gezgin Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Evliya" variant="beam" colors={["#ffc107", "#ffd54f", "#ffecb3", "#ff8f00", "#ffe082"]} />
    },
    {
        id: 'beam17',
        name: 'Hanife',
        desc: 'Samimi Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Hanife" variant="beam" colors={["#009688", "#4db6ac", "#b2dfdb", "#00695c", "#80cbc4"]} />
    },
    {
        id: 'beam18',
        name: 'Selime',
        desc: 'Esenlik Veren',
        component: (props) => <Avatar size={props.size || 24} name="Selime" variant="beam" colors={["#8bc34a", "#aed581", "#dcedc8", "#558b2f", "#c5e1a5"]} />
    },
    {
        id: 'beam19',
        name: 'Zeynep',
        desc: 'Değerli Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Zeynep" variant="beam" colors={["#ff5722", "#ff8a65", "#ffccbc", "#d84315", "#ffab91"]} />
    },
    {
        id: 'beam20',
        name: 'Hatice',
        desc: 'Saygın Karakter',
        component: (props) => <Avatar size={props.size || 24} name="Hatice" variant="beam" colors={["#795548", "#ffeb3b", "#03a9f4", "#8bc34a", "#e91e63"]} />
    },
    {
        id: 'muessis',
        name: 'Müessis',
        desc: 'Kurucu Karakter',
        component: (props) => (
            <div
                style={{
                    width: props.size || 24,
                    height: props.size || 24,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                    boxShadow: '0 4px 15px rgba(192, 57, 43, 0.2)',
                    display: 'block'
                }}
            />
        )
    }
];

export const ORANGE_PROFILE_ICON_IDS = ['beam8', 'beam16', 'beam19', 'beam20']

export function getRandomOrangeProfileIconId() {
    if (!ORANGE_PROFILE_ICON_IDS.length) return 'muessis'
    const randomIndex = Math.floor(Math.random() * ORANGE_PROFILE_ICON_IDS.length)
    return ORANGE_PROFILE_ICON_IDS[randomIndex]
}

function isRemoteAvatarUrl(value) {
    const raw = String(value || '').trim()
    return /^https?:\/\//i.test(raw)
}

export function isBuiltInProfileIconId(id) {
    return profileIcons.some((icon) => icon.id === id)
}

export const getProfileIcon = (id) => {
    const normalizedId = String(id || '').trim()

    if (isRemoteAvatarUrl(normalizedId)) {
        return {
            id: normalizedId,
            name: 'Google Avatar',
            desc: 'Google profil resmi',
            component: (props) => (
                <img
                    src={normalizedId}
                    alt="Profil"
                    referrerPolicy="no-referrer"
                    style={{
                        width: props.size || 24,
                        height: props.size || 24,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        display: 'block'
                    }}
                />
            )
        }
    }

    return profileIcons.find(icon => icon.id === normalizedId) || profileIcons[0]
};
