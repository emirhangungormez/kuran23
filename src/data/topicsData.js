export const popularTopics = [
    { label: 'İman', query: 'iman' },
    { label: 'Takva', query: 'takva' },
    { label: 'Sabır', query: 'sabır' },
    { label: 'Rahmet', query: 'rahmet' },
    { label: 'Tevbe', query: 'tevbe' },
    { label: 'Cennet', query: 'cennet' },
    { label: 'الله', query: 'الله', lang: 'ar' },
    { label: 'الرحمن', query: 'الرحمن', lang: 'ar' },
    { label: 'الشيطان', query: 'الشيطان', lang: 'ar' },
    { label: 'الملائكة', query: 'الملائكة', lang: 'ar' },
    { label: 'الحق', query: 'الحق', lang: 'ar' },
    { label: 'الإنسان', query: 'الإنسان', lang: 'ar' },
    { label: 'الجنة', query: 'الجنة', lang: 'ar' },
    { label: 'النار', query: 'النار', lang: 'ar' }
];

export const fihristData = [
    {
        title: 'İman ve Vahiy',
        desc: "Kur'an'ın inanç dili, vahiy çağrısı ve gayb başlıkları",
        icon: 'iman',
        subcategories: [
            {
                title: 'Tevhid ve Rahmet',
                topics: [
                    { name: 'Allah', query: 'allah' },
                    { name: 'Rab', query: 'rab' },
                    { name: 'Tevhid', query: 'tevhid' },
                    { name: 'Rahmet', query: 'rahmet' },
                    { name: 'Hidayet', query: 'hidayet' }
                ]
            },
            {
                title: 'Vahiy ve Kitap',
                topics: [
                    { name: 'Ayet', query: 'ayet' },
                    { name: 'Vahiy', query: 'vahiy' },
                    { name: "Kur'an", query: 'kuran' },
                    { name: 'Kitap', query: 'kitap' },
                    { name: 'Furkan', query: 'furkan' }
                ]
            },
            {
                title: 'Elçiler ve Gayb',
                topics: [
                    { name: 'Resul', query: 'resul' },
                    { name: 'Nebi', query: 'nebi' },
                    { name: 'Melek', query: 'melek' },
                    { name: 'Şeytan', query: 'şeytan' },
                    { name: 'İblis', query: 'iblis' }
                ]
            }
        ]
    },
    {
        title: 'Kulluk ve İbadet',
        desc: "Kur'an'da açık karşılığı olan kulluk ve ibadet başlıkları",
        icon: 'ibadet',
        subcategories: [
            {
                title: 'Namaz ve Dua',
                topics: [
                    { name: 'Namaz', query: 'namaz' },
                    { name: 'Secde', query: 'secde' },
                    { name: 'Rükû', query: 'rükû' },
                    { name: 'Dua', query: 'dua' },
                    { name: 'Zikir', query: 'zikir' }
                ]
            },
            {
                title: 'Oruç ve Hac',
                topics: [
                    { name: 'Ramazan', query: 'ramazan' },
                    { name: 'Oruç', query: 'oruç' },
                    { name: 'Hac', query: 'hac' },
                    { name: 'Kıble', query: 'kıble' },
                    { name: 'Kurban', query: 'kurban' }
                ]
            },
            {
                title: 'İnfak ve Paylaşım',
                topics: [
                    { name: 'Zekat', query: 'zekat' },
                    { name: 'İnfak', query: 'infak' },
                    { name: 'Sadaka', query: 'sadaka' },
                    { name: 'Yetim', query: 'yetim' },
                    { name: 'Miskin', query: 'miskin' }
                ]
            }
        ]
    },
    {
        title: 'Ahlak ve Toplum',
        desc: 'İnsanın terbiyesi ve toplumsal düzenle ilgili temel başlıklar',
        icon: 'ahlak',
        subcategories: [
            {
                title: 'Övülen Haller',
                topics: [
                    { name: 'Takva', query: 'takva' },
                    { name: 'Sabır', query: 'sabır' },
                    { name: 'Şükür', query: 'şükür' },
                    { name: 'Tevbe', query: 'tevbe' },
                    { name: 'Salih Amel', query: 'salih amel' }
                ]
            },
            {
                title: 'Sakındırılan Tavırlar',
                topics: [
                    { name: 'Zulüm', query: 'zulüm' },
                    { name: 'Kibir', query: 'kibir' },
                    { name: 'İsraf', query: 'israf' },
                    { name: 'Nifak', query: 'münafık' },
                    { name: 'Fesat', query: 'fesat' }
                ]
            },
            {
                title: 'Hak ve Sorumluluk',
                topics: [
                    { name: 'Adalet', query: 'adalet' },
                    { name: 'Emanet', query: 'emanet' },
                    { name: 'Anne Baba', query: 'anne baba' },
                    { name: 'Akraba', query: 'akraba' },
                    { name: 'Ölçü', query: 'ölçü' }
                ]
            }
        ]
    },
    {
        title: 'Ahiret ve Hesap',
        desc: 'Diriliş, hesap ve ebedi yurt tasvirleri',
        icon: 'ahiret',
        subcategories: [
            {
                title: 'Hesap Günü',
                topics: [
                    { name: 'Kıyamet', query: 'kıyamet' },
                    { name: 'Diriliş', query: 'diriliş' },
                    { name: 'Hesap', query: 'hesap' },
                    { name: 'Mizan', query: 'mizan' },
                    { name: 'Mahşer', query: 'mahşer' }
                ]
            },
            {
                title: 'Mükafat ve Ceza',
                topics: [
                    { name: 'Cennet', query: 'cennet' },
                    { name: 'Firdevs', query: 'firdevs' },
                    { name: 'Cehennem', query: 'cehennem' },
                    { name: 'Azap', query: 'azap' },
                    { name: 'Mağfiret', query: 'mağfiret' }
                ]
            }
        ]
    },
    {
        title: 'Peygamberler ve Kavimler',
        desc: 'Peygamber kıssaları ve ibret sahneleri',
        icon: 'kissa',
        subcategories: [
            {
                title: 'Peygamberler',
                topics: [
                    { name: 'Muhammed', query: 'muhammed' },
                    { name: 'Nuh', query: 'nuh' },
                    { name: 'İbrahim', query: 'ibrahim' },
                    { name: 'Musa', query: 'musa' },
                    { name: 'İsa', query: 'isa' },
                    { name: 'Yusuf', query: 'yusuf' },
                    { name: 'Yunus', query: 'yunus' }
                ]
            },
            {
                title: 'Kavimler ve Kişiler',
                topics: [
                    { name: 'Firavun', query: 'firavun' },
                    { name: 'Ad', query: 'ad' },
                    { name: 'Semud', query: 'semud' },
                    { name: 'Medyen', query: 'medyen' },
                    { name: 'Lut', query: 'lut' },
                    { name: 'İsrailoğulları', query: 'israiloğulları' },
                    { name: 'Ashab-ı Kehf', query: 'kehf' }
                ]
            }
        ]
    },
    {
        title: 'Yaratılış ve Kevni Ayetler',
        desc: 'İnsan, tabiat ve gökler üzerinden kurulan deliller',
        icon: 'kevn',
        subcategories: [
            {
                title: 'Gökler ve Yer',
                topics: [
                    { name: 'Gökler', query: 'gökler' },
                    { name: 'Yer', query: 'yer' },
                    { name: 'Güneş', query: 'güneş' },
                    { name: 'Ay', query: 'ay' },
                    { name: 'Gece', query: 'gece' },
                    { name: 'Gündüz', query: 'gündüz' }
                ]
            },
            {
                title: 'İnsan ve Yeryüzü',
                topics: [
                    { name: 'İnsan', query: 'insan' },
                    { name: 'Toprak', query: 'toprak' },
                    { name: 'Dağlar', query: 'dağlar' },
                    { name: 'Deniz', query: 'deniz' },
                    { name: 'Yağmur', query: 'yağmur' },
                    { name: 'Rüzgar', query: 'rüzgar' }
                ]
            }
        ]
    }
];
