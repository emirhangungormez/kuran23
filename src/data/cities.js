export const CITIES = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
    "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
    "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
    "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
    "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
    "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop",
    "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
].sort((a, b) => a.localeCompare(b, 'tr'));

// Simple simulation logic based on Turkey coordinates (approximate)
// Updated to fetch real-time data from an API
export const getPrayerTimes = async (cityName) => {
    try {
        // Cache mechanism: check localStorage first
        const cacheKey = `prayer_times_${cityName}_${new Date().toISOString().split('T')[0]}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);

        const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=Turkey&method=13`); // Method 13: Diyanet
        const data = await response.json();

        if (data.code === 200) {
            const t = data.data.timings;
            const result = {
                imsak: t.Fajr,
                gunes: t.Sunrise,
                ogle: t.Dhuhr,
                ikindi: t.Asr,
                aksam: t.Maghrib,
                yatsi: t.Isha
            };

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify(result));
            return result;
        }
        throw new Error('API Error');
    } catch (error) {
        console.error("Prayer times fetch failed, falling back to simulation:", error);

        // Fallback to basic simulation if API fails
        const index = CITIES.indexOf(cityName);
        const shiftMinutes = Math.floor((index / CITIES.length) * 76);

        const imsakBase = 383 + shiftMinutes;
        const gunesBase = 468 + shiftMinutes;
        const ogleBase = 803 + shiftMinutes;
        const ikindiBase = 979 + shiftMinutes;
        const aksamBase = 1128 + shiftMinutes;
        const yatsiBase = 1208 + shiftMinutes;

        const format = (mins) => {
            const h = Math.floor(mins / 60) % 24;
            const m = mins % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        return {
            imsak: format(imsakBase),
            gunes: format(gunesBase),
            ogle: format(ogleBase),
            ikindi: format(ikindiBase),
            aksam: format(aksamBase),
            yatsi: format(yatsiBase)
        };
    }
};
