export const TAFSIR_SOURCES = [
    {
        id: 'kuran23',
        shortLabel: 'Kuran23',
        tabLabel: 'Kuran23 Tefsiri',
        sourceLabel: 'Kuran23 Tefsiri'
    },
    {
        id: 'diyanet',
        shortLabel: 'Diyanet',
        tabLabel: 'Diyanet Tefsiri',
        sourceLabel: "Diyanet İşleri Başkanlığı - Kur'an Yolu"
    },
    {
        id: 'razi',
        shortLabel: 'Râzî',
        tabLabel: "Fahreddin er-Râzî: Tefsîr-i Kebîr (Mefâtîhu'l-Gayb)",
        sourceLabel: "Fahreddin er-Râzî: Tefsîr-i Kebîr (Mefâtîhu'l-Gayb)"
    },
    {
        id: 'elmalili',
        shortLabel: 'Elmalılı',
        tabLabel: "Elmalılı M. Hamdi Yazır: Hak Dini Kur'an Dili",
        sourceLabel: "Elmalılı M. Hamdi Yazır: Hak Dini Kur'an Dili"
    },
    {
        id: 'zemahseri',
        shortLabel: 'Zemahşerî',
        tabLabel: "Zemahşerî: el-Keşşâf 'an Hakā'iki Ğavâmidi't-Tenzîl",
        sourceLabel: "Zemahşerî: el-Keşşâf 'an Hakā'iki Ğavâmidi't-Tenzîl"
    },
    {
        id: 'taberi',
        shortLabel: 'Taberî',
        tabLabel: "İbn Cerîr et-Taberî: Taberî Tefsiri (Câmiu'l-Beyân)",
        sourceLabel: "İbn Cerîr et-Taberî: Taberî Tefsiri (Câmiu'l-Beyân)"
    },
    {
        id: 'mukatil',
        shortLabel: 'Mukâtil',
        tabLabel: 'Mukatil bin Süleyman: Tefsîr-i Kebîr',
        sourceLabel: 'Mukatil bin Süleyman: Tefsîr-i Kebîr'
    },
    {
        id: 'ibnArabi',
        shortLabel: "İbnü'l-Arabî",
        tabLabel: "Muhyiddin İbnü'l-Arabî: Te'vilât (Tefsir-i Kebir / Te'vilât)",
        sourceLabel: "Muhyiddin İbnü'l-Arabî: Te'vilât (Tefsir-i Kebir / Te'vilât)"
    }
];

export const TAFSIR_SOURCE_MAP = Object.fromEntries(
    TAFSIR_SOURCES.map((source) => [source.id, source])
);

const RAZI_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>I. SURE ÖZELİNDE TOPLU TEFSİR (Genel Değerlendirme)</h2>
            <p>Fahreddin er-Râzî, Fatiha Suresi'ni salt bir metin olarak değil, evrenin, insanın ve yaratıcının akli delillerle kavranmasını sağlayan bir "İlahiyat, Nübüvvet ve Mead (Ahiret)" özeti olarak ele alır.</p>

            <h3>Surenin İsimleri ve Aklî Sırları</h3>
            <p>Râzî'ye göre Fatiha'nın birden fazla isme sahip olması, onun barındırdığı manaların yüceliğine ve şerefine delalet eder.</p>
            <ul>
                <li><strong>Ümmü'l-Kitap / Ümmü'l-Kur'an (Kitabın Anası):</strong> Sure; usul (inanç esasları), fürû (ibadetler ve fıkıh) ve mükâşefe (kalbin arınması) ilimlerinin tamamını kapsadığı için bu ismi almıştır.</li>
                <li><strong>es-Seb'u'l-Mesânî (Tekrarlanan Yedi):</strong> Yedi ayetten oluştuğu ve namazlarda tekrarlandığı için bu ismi almıştır. Râzî'ye göre bu isim aynı zamanda surenin "ikiye ayrılmasına" (Allah'ın övülmesi ve kulun duası) işaret eder. Surenin ilk yarısı Rububiyyet (Rabb'in hakkı olan övgü), ikinci yarısı ise Ubudiyyet (kulun hakkı olan dua ve yakarış) makamıdır.</li>
                <li><strong>eş-Şifâ (Şifa Suresi):</strong> Küfür ve sapkınlık bir hastalıktır. Fatiha, içerdiği tevhid ve marifet bilgileriyle kalpteki bu manevi hastalıklara şifa olduğu için bu isimle anılmıştır.</li>
                <li><strong>es-Salât (Namaz Suresi):</strong> Râzî, "Namazı (Fatiha'yı) kulumla aramda ikiye böldüm" şeklindeki kudsî hadisi delil getirerek surenin Allah ile kul arasındaki varoluşsal sözleşmeyi (ahdi) temsil ettiğini belirtir.</li>
            </ul>

            <h3>Surenin Nüzulü (İnişi)</h3>
            <p>Râzî, surenin şerefi ve öneminden dolayı hem Mekke'de hem de Medine'de olmak üzere iki defa nazil olduğunu belirtir.</p>

            <h3>Aklî ve Kelâmî Bağlam</h3>
            <p>Râzî'ye göre Fatiha Suresi, insanın ontolojik (varoluşsal) serüvenini üç aşamada özetler: Mebde' (Başlangıç ve Yaratıcıyı tanıma), Vasat (Dünya hayatındaki kulluk) ve Me'âd (Ahiret ve dönüş). Sure, Mebde'i "Âlemlerin Rabbi" ile, Vasat'ı "Ancak sana ibadet ederiz" ile, Me'âd'ı ise "Din gününün maliki" ifadeleriyle akla ispat eder.</p>
        </section>
    </div>
`;

const RAZI_VERSE_1 = `
    <div class="verse-tafsir-detail">
        <h3>II. AYET AYET AYRINTILI TEFSİR</h3>
        <h4>Besmele: "Bismillâhirrahmânirrahîm"</h4>
        <p><strong>Birinci Mesele (Fıkhî ve Kelâmî Boyut):</strong> Râzî, Eş'ari ve Şafii usulünü takip ederek Besmele'nin Fatiha'nın ilk ve ayrılmaz bir ayeti olduğunu aklî ve naklî delillerle savunur. Ebû Hanîfe'nin "Besmele sureleri ayırmak için inmiş müstakil bir ayettir" görüşünü tartışmaya açar ve "Fatiha yedi ayettir" nassını delil göstererek, Besmele'nin bu yedi ayetin ilki olarak kabul edilmesinin zorunlu olduğunu belirtir.</p>
        <h4>1. Ayet: "Hamd, âlemlerin Rabbi olan Allah'a mahsustur."</h4>
        <p><strong>Birinci Mesele (Hamd, Medh ve Şükür Farkı):</strong> Râzî kelimelerin kavramsal tahlilini yapar. Şükür, yalnızca verilen bir nimete karşılık yapılırken; "Hamd", hem ihsan edilen nimete karşılık hem de Allah'ın zatındaki mutlak mükemmellik ve ezelî kusursuzluk için yapılır. Bu nedenle Hamd, şükürden çok daha geniş ve yüce bir kavramdır.</p>
        <p><strong>İkinci Mesele (Âlemlerin Rabbi Olmanın Aklî Delili):</strong> Râzî'ye göre "Âlem", Allah'ın dışındaki her varlık (mümkinü'l-vücud) demektir. Her değişken ve sonradan olan varlık türü, kendisini yoktan var edip terbiye eden bir "Rabb"e muhtaçtır. Bu ayet, Allah'ın varlığının ve yaratıcılığının en büyük kozmolojik delilidir.</p>
    </div>
`;

const RAZI_VERSE_2 = `
    <div class="verse-tafsir-detail">
        <h4>2. Ayet: "O, Rahmân ve Rahîm'dir."</h4>
        <p><strong>Birinci Mesele (İlahi Rahmetin Tecellisi):</strong> Allah'ın kulları üzerindeki "Rabb" (Terbiye edici/Sahip) sıfatı bir korku ve çekinme hissi uyandırabileceğinden, hemen ardından "Rahmân ve Rahîm" sıfatları zikredilerek denge kurulmuştur. Allah, âlemleri yaratırken rahmetiyle yarattığı için Rahmân'dır.</p>
    </div>
`;

const RAZI_VERSE_3 = `
    <div class="verse-tafsir-detail">
        <h4>3. Ayet: "Din gününün mâlikidir."</h4>
        <p><strong>Birinci Mesele (Din ve Mülkiyetin Sınırları):</strong> Râzî, kelâmî bir yaklaşımla "Din" kelimesini "hesap, ceza ve amellerin karşılığı" olarak tanımlar. Kıraatlerde bu kelimenin hem "Mâlik" (Mülk sahibi) hem de "Melik" (Hükümdar/Kral) olarak okunduğunu belirtir. Her iki okuyuş da o gün, otoritenin ve mutlak mülkiyetin dünyadaki geçici sahiplerinden alınıp sadece Allah'a ait olacağının aklî ispatıdır.</p>
    </div>
`;

const RAZI_VERSE_4 = `
    <div class="verse-tafsir-detail">
        <h4>4. Ayet: "Ancak sana kulluk eder ve ancak senden yardım dileriz."</h4>
        <p><strong>Birinci Mesele (İltifat Sanatı ve Huzur Makamı):</strong> Râzî, bu ayetteki belagat sırrına dikkat çeker. İlk üç ayette Allah'tan "O" şeklinde üçüncü şahıs olarak bahsedilirken, bu ayette "Sen" hitabına geçilir. Râzî bu durumu aklî ve psikolojik olarak şöyle temellendirir: Namaza duran kul başlangıçta gaip bir yabancı gibidir. Ancak Allah'a hamd edip O'nun yüce sıfatlarını saydıkça manen yücelir, aradaki perdeler kalkar ve Allah'ın huzurunda doğrudan O'na hitap edebilecek makama erer.</p>
        <p><strong>İkinci Mesele (İbadetin Yardımdan Önce Gelmesi):</strong> Neden "yardım dileriz" denmeden önce "kulluk ederiz" denilmiştir? Râzî'nin akli izahına göre; kulluk (ibadet) bir vesiledir, yardım istemek (istiâne) ise bir taleptir. İstekte bulunan kişinin, talebinden önce vesilesini (kulluğunu) sunması rasyonel bir gerekliliktir.</p>
    </div>
`;

const RAZI_VERSE_5 = `
    <div class="verse-tafsir-detail">
        <h4>5. Ayet: "Bizi dosdoğru yola ilet."</h4>
        <p><strong>Birinci Mesele (Hidayetin Sürekliliği):</strong> "Mümin zaten hidayettedir, öyleyse neden tekrar hidayet ister?" sorusuna Râzî şu kelâmî cevabı verir: Buradaki talep, zaten var olan hidayetin derecelerinde yükselmek, hidayette sabit kadem olmak (sebat) ve ahirette de cennete götürecek yolda başarının lütfedilmesini istemektir.</p>
    </div>
`;

const RAZI_VERSE_6_7 = `
    <div class="verse-tafsir-detail">
        <h4>6 ve 7. Ayetler: "Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapıtanların yoluna değil."</h4>
        <p><strong>Birinci Mesele (Nimet ve Hak Ehli):</strong> Nimet verilenler, sadece dünyalık rızık elde edenler değil, hak ehlinin akıllarının nuruna uyan, salih amellerle marifetullahı (Allah'ı bilmeyi) birleştiren kimselerdir.</p>
        <p><strong>İkinci Mesele (Gazap ve Sapıklığın Kelâmî Boyutu):</strong> Râzî, "Gazaba uğrayanlar Yahudiler, sapıtanlar Hristiyanlardır" şeklindeki genel rivayet tefsirini aktarmakla birlikte, dirayet ve felsefi aklın gereği olarak ayeti evrenselleştirir. Ona göre; "Gazaba uğrayanlar" (Mağdûb), inançta hakkı bildiği halde amelî olarak itaat etmeyen, salih amelleri ihlal eden inatçılardır. "Sapıtanlar" (Dâllîn) ise doğru inancı (sahih itikadı) ihlal eden, cehalet ve şüphe içinde bocalayanlardır. Böylece sure, ahlakî ve itikadî her türlü ifrat (aşırılık) ve tefritten (eksiklik) korunma duası ile son bulur.</p>
    </div>
`;

const ZEMAHSERI_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>Fâtiha Suresi: Genel Bakış ve Kimlik (Toplu Tefsir)</h2>
            <p>Ebü'l-Kāsım Cârullah Mahmûd b. Ömer ez-Zemahşerî, el-Keşşâf'ta Fâtiha'yı Arap dili grameri (nahiv), belagat, i'caz ve kelime kökenleri (etimoloji) merkezinde ele alır.</p>
            <p>Zemahşerî'ye göre Fâtiha sûresi Mekkîdir. Ancak bir görüşe göre hem Mekke'de hem de Medine'de iki kez nazil olduğu için hem Mekkî hem Medenîdir.</p>

            <h3>Surenin İsimleri</h3>
            <ul>
                <li><strong>Ümmü'l-Kur'ân (Kur'an'ın Özü):</strong> Allah'ı layık olduğu şekilde övme, ilâhî emir-yasaklara uyma, vaat ve tehditleri birlikte içermesi sebebiyle bu isim verilmiştir.</li>
                <li><strong>Kenz (Hazine) ve Vâfiye (Eksiksiz):</strong> Anlam bütünlüğü taşıması ve eksiklik barındırmaması sebebiyle anılır.</li>
                <li><strong>Mesânî:</strong> Namazın her rekâtında düzenli tekrar edildiği için bu isimle anılmıştır.</li>
                <li><strong>Salât (Namaz):</strong> Namazın bu sureyle kemale ermesi/fazilet kazanması sebebiyle bu adla da zikredilir.</li>
                <li><strong>Şifâ ve Şâfiye:</strong> Manevî hastalıklara deva olan sure anlamında kullanılır.</li>
            </ul>
        </section>
    </div>
`;

const ZEMAHSERI_VERSE_1 = `
    <div class="verse-tafsir-detail">
        <h3>Ayet Ayet Ayrıntılı Tefsir (el-Keşşâf Metodolojisiyle)</h3>
        <h4>Besmele: "Bismillâhirrahmânirrahîm"</h4>
        <p><strong>Nahiv (Gramer) İncelemesi:</strong> Zemahşerî, Besmele'deki "Bâ" harf-i cerinin hazfedilmiş bir fiile taalluk ettiğini belirtir. Cümlenin takdiri "Allah'ın adıyla okurum" şeklindedir. Arapçada "Bismillâh" ifadesi, fiilin bağlamdan anlaşılmasıyla kullanılır.</p>
        <p><strong>Etimolojik İnceleme ("İsm" Kelimesi):</strong> "İsm" kelimesinin başındaki hemze, sakin harfle başlamayı önlemek için telaffuz kolaylığı sağlayan bir unsurdur.</p>
        <h4>1. Ayet: "Hamd, âlemlerin Rabbi olan Allah'a mahsustur."</h4>
        <p><strong>Belagat (Lâm-ı Tarifin Sırrı):</strong> "El-Hamd"deki belirlilik, hamd cinsinin diğer fiil cinslerinden hususen Allah'a ait olduğunu vurgular.</p>
        <p><strong>Lügat ("Âlemîn" Kelimesi):</strong> "Âlem", Yaratıcı'yı bildiren varlıklar kümesini ifade eder. Sıfat anlamı taşıdığı için çoğul yapısı akıllı varlık çoğulu kalıbına yaklaştırılarak kurulmuştur.</p>
    </div>
`;

const ZEMAHSERI_VERSE_2 = `
    <div class="verse-tafsir-detail">
        <h4>2. Ayet: "O, Rahmân ve Rahîm'dir."</h4>
        <p><strong>Kelime Kökeni ve Vezin:</strong> "Rahmân", fa'lân vezninde olup mübalağa ve doluluk ifade eder; "Rahîm" ise fa'îl veznindedir.</p>
        <p><strong>İ'caz (Harf Fazlalığı):</strong> Lafızdaki artışın anlamda genişleme doğurduğu prensibiyle "Rahmân", "Rahîm"e göre daha kuşatıcı bir rahmet vurgusu taşır.</p>
    </div>
`;

const ZEMAHSERI_VERSE_3 = `
    <div class="verse-tafsir-detail">
        <h4>3. Ayet: "Din gününün mâlikidir."</h4>
        <p><strong>Gramer ve İzafet:</strong> "Mâlik" ism-i fâilinin izafet yapısında kullanımıyla, hesap-ceza günündeki mutlak otorite ve mülkiyetin yalnız Allah'a ait olduğu ifade edilir.</p>
    </div>
`;

const ZEMAHSERI_VERSE_4 = `
    <div class="verse-tafsir-detail">
        <h4>4. Ayet: "Ancak sana kulluk eder ve ancak senden yardım dileriz."</h4>
        <p><strong>Belagat (Takdim-Tehir / Tahsis):</strong> "İyyâke" mef'ûlünün fiilden önce gelmesi, ibadetin yalnız Allah'a tahsis edildiğini gösterir.</p>
        <p><strong>Belagat (İltifat Sanatı):</strong> Gaip sigasından (O) muhatap sigasına (Sen) geçiş, yüce vasıfların sahibi olan Allah'ın doğrudan muhatap alınmasıyla kulluğun kuvvetli biçimde temellendirildiğini gösterir.</p>
    </div>
`;

const ZEMAHSERI_VERSE_5 = `
    <div class="verse-tafsir-detail">
        <h4>5. Ayet: "Bizi dosdoğru yola ilet."</h4>
        <p><strong>Nahiv ve Anlam İlişkisi:</strong> Mevcut bir nimetin artması için dua örneklerinde olduğu gibi, "ihdinâ" talebi de hidayetin sürmesi, artması ve sebat etmesi anlamına gelir.</p>
    </div>
`;

const ZEMAHSERI_VERSE_6_7 = `
    <div class="verse-tafsir-detail">
        <h4>6 ve 7. Ayetler: "Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapıtanların yoluna değil."</h4>
        <p><strong>Belagat (Bedel ve Açıklama):</strong> "Sırâtallezîne..." ifadesi, "sırâta'l-müstekîm"in açıklayıcı bedelidir; dosdoğru yol müşahhas bir örnekle belirginleşir.</p>
        <p><strong>Tarihsel ve Dilsel Referans:</strong> Zemahşerî, Kur'an'ın Kur'an'la tefsiri yaklaşımıyla "gazaba uğrayanlar"ı Yahudiler, "dâllîn"i Hristiyanlar bağlamında açıklar.</p>
        <p><strong>Âmin:</strong> Fâtiha sonundaki "Âmin", Zemahşerî'nin naklettiği rivayette mektuba vurulan mühür gibidir; kul bu duayı mühürlemiş olur.</p>
    </div>
`;



const ELMALILI_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>I. SURE OZELINDE TOPLU TEFSIR (Genel Degerlendirme)</h2>
            <h3>Surenin Isimleri ve Ozu</h3>
            <p>Lugatte "acilabilecek seylerin bas tarafi, ilk acilan yeri" anlamina gelen Fatiha, Kur'an'in tertibinde, yazilmasinda ve namazda okunmasinda ilk sirada yer aldigi icin bu ismi almistir.</p>
            <p>Elmalili'ya gore Fatiha, siradan bir giris degil; butun Kur'an'in koku, tohumu ve aslidir. Bu sebeple en meshur isimleri "Ummu'l-Kur'an" ve "Ummu'l-Kitap"tir. Sure; inanc esaslarini, ahireti, nazari hikmetleri ve amelle ilgili hukumleri kusursuz bir edebi ozet halinde sunar.</p>
            <p>Surenin ilk yarisi (Allah'i ovme kismi) Mekke'de inen surelerin karakterini, ikinci yarisi (dua ve hukum kismi) ise Medine'de inen surelerin karakterini temsil eder. Fatiha, Allah ile mahlukat arasindaki uluhiyet-ubudiyet iliskisini en dengeli sekilde kurar.</p>

            <h3>Ayet Sayisi, Besmele ve Fasila (Ahenk) Ozelligi</h3>
            <p>Fatiha'nin yedi ayet oldugunda ittifak vardir. Elmalili, Hanefi cizgiye dayanarak Besmele'nin sureleri ayiran mustakil bir ayet oldugunu; Fatiha'nin ilk ayetinin "Elhamdulillahi rabbilalemin" ile basladigini belirtir.</p>
            <p>Surenin fasila duzeninde mim ve nun harfleri one cikar. Bu duzen, siir ve nesir arasinda akici, ritmik ve tertilli bir ahenk olusturur.</p>

            <h3>Surenin Temel Kurgusu ve Analitik Sentezi</h3>
            <p>Elmalili, surenin basindaki uc ayet ile sonundaki uc ayet arasindaki dengeye dikkat ceker. Ilk kisim marifetullah'i, orta kisim uluhiyet-ubudiyet bagini, son kisim ise hak yolun sinirlarini belirler.</p>
        </section>
    </div>
`;

const ELMALILI_VERSE_1_2_3 = `
    <div class="verse-tafsir-detail">
        <h3>II. AYET AYET AYRINTILI TEFSIR</h3>
        <h4>1., 2. ve 3. Ayetler: "Hamd, alemlerin Rabbi, Rahman ve Rahim olan Allah'a mahsustur."</h4>
        <p><strong>Akli ve Mantiksal Cikarin:</strong> Elmalili, bu bolumu "istenen hukum + deliller" yapisinda degerlendirir: "Hamd Allah'a mahsustur." Cunku O, zati ve sifatlari geregi buna layiktir; O, alemlerin Rabbi'dir, Rahman'dir, Rahim'dir ve Din gununun malikidir.</p>
        <p><strong>Gormeyerek Anlatim (Gaip Sigasi):</strong> Surenin basinda Allah'tan "O" diye bahsedilir. Kul, kainattaki rabbani duzeni tefekkur ederek gaip olan o ezeli varligin huzuruna zihnen hazirlanir.</p>
    </div>
`;

const ELMALILI_VERSE_4 = `
    <div class="verse-tafsir-detail">
        <h4>4. Ayet: "O, din gununun maliki Allah'in."</h4>
        <p><strong>Mulkiyetin Sinirlari (Malik ve Melik):</strong> Elmalili'ya gore "Malik" kiraati ferdi mulkiyeti, "Melik" kiraati sosyal-siyasi otoriteyi simgeler. Ahiret ve din gununde hem ferdi hem toplumsal mutlak otoritenin yalniz Allah'a ait oldugu boylece ilan edilir.</p>
    </div>
`;

const ELMALILI_VERSE_5 = `
    <div class="verse-tafsir-detail">
        <h4>5. Ayet: "Ancak sana ederiz kullugu, ibadeti ve ancak senden dileriz yardimi, inayeti (Ya Rab!)."</h4>
        <p><strong>Iltifat Sanati ve Idrakin Yukselisi:</strong> Ilk ayetlerde "O" diye anilan Allah'a burada "Sana" diye dogrudan hitap edilir. Bu iltifat, kulun tefekkurle manen yukselip huzur makamina erismesini gosterir.</p>
        <p><strong>Tevhidin Pratik Hayata Yansimasi:</strong> "Iyyake" kelimesinin one alinmasi, ibadet ve yardim talebinin yalniz Allah'a hasredildigini ortaya koyar.</p>
    </div>
`;

const ELMALILI_VERSE_6_7 = `
    <div class="verse-tafsir-detail">
        <h4>6. ve 7. Ayetler: "Hidayet eyle bizi dogru yola, o kendilerine nimet verdigin mutlu kimselerin yoluna; o gazaba ugramislarin ve o sapmislarin yoluna degil."</h4>
        <p><strong>Sirat-i Mustakim:</strong> Kul, kullugunu arz ettikten sonra en buyuk talebini dile getirir: dogru yol. Bu yol; Allah'in yolu, Islam seriati, Hz. Peygamber ve ashabinin yolu olarak yorumlanir; ozeti Islam milleti ve dogruluk yoludur.</p>
        <p><strong>Toplumsal ve Ahlaki Ayrim:</strong> Fatiha insanligi uc grupta toplar: nimet verilenler (hakka tabi olanlar), magdub olanlar (hakikati bilip direnenler) ve dallin (hakikati bulamayip sasiranlar). Boylece sure, tevhidin bireysel ve toplumsal sinirlarini belirleyen bir hayat nizamnamesi kurar.</p>
    </div>
`;

const TABERI_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>I. SURE OZELINDE TOPLU TEFSIR (Genel Degerlendirme)</h2>
            <p>Ibn Cerir et-Taberi'nin "Camiu'l-Beyan an Te'vili Ayi'l-Kur'an" eseri, mesur tefsir merkezli en temel kaynaklardan biridir. Taberi, sahabe ve tabiin rivayetlerini merkeze alir; ihtilafli gorusleri aktarir, sonra kendi tercihlerini belirtir.</p>
            <p>Metodunda Arap dili, siirden sahitler, irab tahlilleri ve gerekli oldugunda fikhi-kelami incelemeler vardir. Faydasiz ve gereksiz yorumlardan kacinarak delile dayali bir cizgi izler.</p>
            <p>Fatiha'nin nuzul baglaminda Taberi, ilk donem nakillerine ve fikhi uygulamalara dayanarak surenin Mekki oldugunu kabul eder. Namazin Mekke devrinde farz kilinmasi ve Fatiha olmadan namazin gecerli olmayacagi ilkesi, bu kabulun tarihsel delili olarak sunulur.</p>
        </section>
    </div>
`;

const TABERI_VERSE_1 = `
    <div class="verse-tafsir-detail">
        <h3>II. AYET AYET AYRINTILI TEFSIR</h3>
        <h4>1. Ayet: "Hamd, alemlerin Rabbi olan Allah'a mahsustur."</h4>
        <p>Taberi, "Hamd" kavramini sahabe ve tabiin anlayisina uygun bicimde kapsamli ele alir. Hamd, Allah'in kullarina lutfettigi sayisiz nimetlere ve O'nun yuce sifatlarina karsi yapilan ovgudur. Bu ovgu mutlak surette ve sadece O'na mahsustur.</p>
    </div>
`;

const TABERI_VERSE_3 = `
    <div class="verse-tafsir-detail">
        <h4>3. Ayet: "Din gununun malikidir."</h4>
        <p>Taberi, rivayetlere ve Arap dilinin kok kullanimlarina dayanarak "din" kelimesini "ceza, hesap ve amellerin karsiligi" olarak tefsir eder. "Kema tedinu tudanu" deyisini anlami guclendiren dilsel delil olarak aktarir.</p>
        <p>Din gunu, dunyadaki gecici otoritelerin bittigi; mutlak hukmun, mulkiyetin ve emrin sadece Allah'a ait oldugu gundur.</p>
    </div>
`;

const TABERI_VERSE_5 = `
    <div class="verse-tafsir-detail">
        <h4>5. Ayet: "Bizi dosdogru yola ilet."</h4>
        <p>Taberi, onceki kusaklardan gelen rivayetleri bir araya getirerek Sirat-i Mustakim kavramini aciklar. Bu yol; egriligi olmayan apacik yoldur. Rivayetleri sentezleyerek bunun Islam dini, Kur'an-i Kerim ve Hz. Peygamber'in yolu anlamlarina geldigini nakleder.</p>
    </div>
`;

const TABERI_VERSE_6_7 = `
    <div class="verse-tafsir-detail">
        <h4>6. ve 7. Ayetler: "Kendilerine nimet verdiklerinin yoluna; gazaba ugrayanlarin ve sapitanlarin yoluna degil."</h4>
        <p>Taberi, bu ayetlerde Hz. Peygamber ve sahabe nakillerine bagli kalir. Buna gore gazaba ugrayanlar (Magdub), hakki bildigi halde reddeden Yahudiler; sapitanlar (Dallin) ise haktan bilgisizce sapan Hiristiyanlardir.</p>
        <p><strong>Amin:</strong> Surenin sonunda soylenen "Amin" lafzinin "Allah'im kabul et" manasina geldigi ve surenin sonuna eklenmesinin sunnet ile sabit oldugu aktarilir.</p>
    </div>
`;

const TABERI_VERSE_NO_DATA = `
    <div class="verse-tafsir-detail">
        <h4>Kaynak Notu</h4>
        <p>KAYNAK TEFSIR MODU geregi, mevcut Camiu'l-Beyan verilerimizde Fatiha suresinin bu ayetine dair acik ve dogrudan bir rivayet/analiz metni bulunmadigindan disaridan yorum eklenmemistir.</p>
    </div>
`;

const MUKATIL_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>I. SURE OZELINDE TOPLU TEFSIR (Genel Degerlendirme)</h2>
            <p>Mukatil bin Suleyman'in tefsir anlayisi; ayetlerin zahiri manasina, Kur'an butunlugundeki kelime kullanimlarina (vucuh ve nezair) ve rivayetlere dayanir. Felsefi-kelami detaylardan cok, ayetin kimi ve neyi gosterdigini dogrudan belirtmeyi tercih eder.</p>
            <p>Surenin nuzul yeri hakkinda Mukatil bin Suleyman, Fatiha suresinin Medine'de nazil oldugu gorusunu benimser.</p>
        </section>
    </div>
`;

const MUKATIL_VERSE_1 = `
    <div class="verse-tafsir-detail">
        <h3>II. AYET AYET AYRINTILI TEFSIR</h3>
        <h4>1. Ayet: "Hamd, alemlerin Rabbi olan Allah'a mahsustur."</h4>
        <p>Mukatil, vucuh metoduna uygun olarak bu ayetteki "Alemin" ifadesini somutlastirir: Burada kastedilen zahiri mana "Cinler ve Insanlar"dir.</p>
    </div>
`;

const MUKATIL_VERSE_3 = `
    <div class="verse-tafsir-detail">
        <h4>3. Ayet: "Din gununun malikidir."</h4>
        <p>Mukatil, "Yevmu'd-Din" ifadesini dogrudan "Hesap Gunu" olarak tefsir eder. Bu gunun belirgin vasfi, Allah'tan baska hic kimsenin hukum veremeyecek olmasidir.</p>
    </div>
`;

const MUKATIL_VERSE_6_7 = `
    <div class="verse-tafsir-detail">
        <h4>6. ve 7. Ayetler: "Kendilerine nimet verdiklerinin yoluna; gazaba ugrayanlarin ve sapitanlarin yoluna degil."</h4>
        <p>Mukatil, rivayetlere dayanarak zumereleri dogrudan tespit eder:</p>
        <ul>
            <li><strong>Kendilerine nimet verilenler:</strong> Peygamberler.</li>
            <li><strong>Gazaba ugrayanlar (Magdubi aleyhim):</strong> Hak yoldan sapan Yahudiler.</li>
            <li><strong>Sapitanlar (Dallin):</strong> Bilgisizce yoldan cikan Hiristiyanlar.</li>
        </ul>
        <p>Mukatil'in yaklasiminda bu ayetler, tarihi ve inancsal zumereleri en zahiri bicimde ifade eder.</p>
    </div>
`;

const MUKATIL_VERSE_NO_DATA = `
    <div class="verse-tafsir-detail">
        <h4>Kaynak Notu</h4>
        <p>Mevcut Mukatil verilerimizde bu ayete dair acik bir rivayet metni bulunmadigindan disaridan yorum eklenmemistir.</p>
    </div>
`;

const IBN_ARABI_SURAH_1 = `
    <div class="tafsir-content-wrapper">
        <section>
            <h2>I. SURE OZELINDE TOPLU TEFSIR (Genel Degerlendirme)</h2>
            <p>Ibnul-Arabi'nin tasavvufi ve isari tefsir anlayisina gore, Fatiha suresi Mekke'de inzal olmus olup 7 ayettir. Ibnul-Arabi, Fatiha suresini siradan bir metin olarak degil, ontolojik (varliksal) ve batini bir boyutta ele alir. Ona gore bir seyin ismi, o seyin bilinmesinin ve taninmasinin aracidir.</p>
            <p>Kur'an sirlarina vakif olan ariflere gore, her surenin basindaki Besmele o surenin butun sirlarini ozunde barindirir. Ibnul-Arabi sureyi bir "ev" (beyt) olarak niteler ve Besmele'yi de anlamlarin kendisiyle acildigi bu evin "kapisi" hukmunde gorur.</p>
            <p>Fatiha kelimesinin bizzat "acis yapan, acan" anlamina geldigini belirten Ibnul-Arabi, bu surenin herkese acilmadigini; ancak bir arife acildiginda menzillerdeki hazinelerin anahtarlarini ve cok yuce ilimleri musahede ettigini ifade eder. Bu baglamda Fatiha, kainatin Allah'tan nasil mevcut oldugunu tahakkuk ettiren, varligin ve sirlarin merkezidir.</p>
        </section>
    </div>
`;

const IBN_ARABI_VERSE_1 = `
    <div class="verse-tafsir-detail">
        <h3>II. AYET AYET AYRINTILI TEFSIR</h3>
        <h4>Kaynak Notu</h4>
        <p>Saglanan kaynak metinlerde ve onceki diyaloglarda Ibnul-Arabi'nin Fatiha suresinin tum ayetlerine dair tasavvufi tefsiri eksiksiz bulunmamaktadir. Kural geregi disaridan yorum veya felsefi ekleme yapilmamis, asagidaki analiz mevcut veriyle sinirli tutulmustur.</p>

        <h4>Besmele: "Bismillahirrahmanirrahim"</h4>
        <p>Ibnul-Arabi'nin isari yaklasiminda Besmele, "Ism-i Azam"dir. Varliklar, Besmele'nin basindaki "Ba" (Be) harfiyle zuhur etmistir. Bu harf, Allah'in zatina isaret eden "Elif"ten sonra gelen ilk harftir ve "Ilk Akil"a delalet eder.</p>
        <p>Besmele ile baslamak, ilahi zatin ve sifatlarin mazhari olan kamil insan suretiyle ise baslamak demektir. Allah ile konusma makamina eren bir Arif icin Besmele, Hak Teala'nin kainati yaratirken kullandigi "Kun" (Ol) ilahi emri ve sozu mesabesindedir.</p>

        <h4>1. Ayet: "Hamd, alemlerin Rabbi olan Allah'a mahsustur."</h4>
        <p>Ibnul-Arabi'nin ontolojik varlik anlayisina gore bu ayetteki alem tasviri, alemin uzak bir yaratisla degil "Rahman" isminin bir nefesi (Nefes-i Rahmani) olarak varlik sahasina cikisi hakikatine isaret eder.</p>
    </div>
`;

const IBN_ARABI_VERSE_4 = `
    <div class="verse-tafsir-detail">
        <h4>4. Ayet: "Ancak sana kulluk eder ve ancak senden yardim dileriz."</h4>
        <p>Ibnul-Arabi'nin batini okumasina gore Fatiha suresi, kutlu bir taksimatla Allah ile kul arasinda ikiye ayrilmistir. Bu ayet ("Iyyake na'budu ve iyyake neste'in"), Allah ile kul arasindaki ortak noktayi temsil eder.</p>
        <p>Cumlenin yarisi Allah'in mutlak hakki olan "ibadet"i, diger yarisi ise acziyet icindeki kulun hakki olan "yardim talebi"ni icerir; boylece uluhiyet ile ubudiyet mertebeleri birbirine baglanir.</p>
    </div>
`;

const IBN_ARABI_VERSE_NO_DATA = `
    <div class="verse-tafsir-detail">
        <h4>Kaynak Notu</h4>
        <p>KAYNAK TEFSIR MODU geregi, mevcut Ibnul-Arabi verilerimizde bu ayete dair acik bir rivayet/tevil metni bulunmadigindan disaridan yorum eklenmemistir.</p>
    </div>
`;

const MANUAL_SOURCE_TAFSIR = {
    razi: {
        surah: {
            1: RAZI_SURAH_1
        },
        verse: {
            '1:1': RAZI_VERSE_1,
            '1:2': RAZI_VERSE_2,
            '1:3': RAZI_VERSE_3,
            '1:4': RAZI_VERSE_4,
            '1:5': RAZI_VERSE_5,
            '1:6': RAZI_VERSE_6_7,
            '1:7': RAZI_VERSE_6_7
        }
    },

    elmalili: {
        surah: {
            1: ELMALILI_SURAH_1
        },
        verse: {
            '1:1': ELMALILI_VERSE_1_2_3,
            '1:2': ELMALILI_VERSE_1_2_3,
            '1:3': ELMALILI_VERSE_1_2_3,
            '1:4': ELMALILI_VERSE_4,
            '1:5': ELMALILI_VERSE_5,
            '1:6': ELMALILI_VERSE_6_7,
            '1:7': ELMALILI_VERSE_6_7
        }
    },
    taberi: {
        surah: {
            1: TABERI_SURAH_1
        },
        verse: {
            '1:1': TABERI_VERSE_1,
            '1:2': TABERI_VERSE_NO_DATA,
            '1:3': TABERI_VERSE_3,
            '1:4': TABERI_VERSE_NO_DATA,
            '1:5': TABERI_VERSE_5,
            '1:6': TABERI_VERSE_6_7,
            '1:7': TABERI_VERSE_6_7
        }
    },
    mukatil: {
        surah: {
            1: MUKATIL_SURAH_1
        },
        verse: {
            '1:1': MUKATIL_VERSE_1,
            '1:2': MUKATIL_VERSE_NO_DATA,
            '1:3': MUKATIL_VERSE_3,
            '1:4': MUKATIL_VERSE_NO_DATA,
            '1:5': MUKATIL_VERSE_NO_DATA,
            '1:6': MUKATIL_VERSE_6_7,
            '1:7': MUKATIL_VERSE_6_7
        }
    },
    ibnArabi: {
        surah: {
            1: IBN_ARABI_SURAH_1
        },
        verse: {
            '1:1': IBN_ARABI_VERSE_1,
            '1:2': IBN_ARABI_VERSE_NO_DATA,
            '1:3': IBN_ARABI_VERSE_NO_DATA,
            '1:4': IBN_ARABI_VERSE_4,
            '1:5': IBN_ARABI_VERSE_NO_DATA,
            '1:6': IBN_ARABI_VERSE_NO_DATA,
            '1:7': IBN_ARABI_VERSE_NO_DATA
        }
    },
    zemahseri: {
        surah: {
            1: ZEMAHSERI_SURAH_1
        },
        verse: {
            '1:1': ZEMAHSERI_VERSE_1,
            '1:2': ZEMAHSERI_VERSE_2,
            '1:3': ZEMAHSERI_VERSE_3,
            '1:4': ZEMAHSERI_VERSE_4,
            '1:5': ZEMAHSERI_VERSE_5,
            '1:6': ZEMAHSERI_VERSE_6_7,
            '1:7': ZEMAHSERI_VERSE_6_7
        }
    }
};

export function getManualSurahSourceTafsir(sourceId, surahId) {
    const sid = Number(surahId);
    return MANUAL_SOURCE_TAFSIR[sourceId]?.surah?.[sid] || '';
}

export function getManualVerseSourceTafsir(sourceId, surahId, ayahNo) {
    const sid = Number(surahId);
    const ayah = Number(ayahNo);
    return MANUAL_SOURCE_TAFSIR[sourceId]?.verse?.[`${sid}:${ayah}`] || '';
}

const SOURCE_MATCHERS = {
    razi: ['fahreddin', 'razi'],
    elmalili: ['elmalili', 'elmal', 'hamdi yazir'],
    zemahseri: ['zemahseri', 'zemah', 'kessaf', 'kesaf'],
    taberi: ['taberi', 'taber', 'camiul beyan', 'camiu l beyan'],
    mukatil: ['mukatil'],
    ibnArabi: ["ibnul arabi", 'ibnul', 'ibnu l arabi', 'ibn arabi']
};

function normalizeText(value) {
    if (!value) return '';

    return String(value)
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesSource(normalizedText, sourceId) {
    const patterns = SOURCE_MATCHERS[sourceId];
    if (!patterns || !normalizedText) return false;

    if (sourceId === 'ibnArabi') {
        return normalizedText.includes('arabi') && (normalizedText.includes('ibn') || normalizedText.includes('bn'));
    }

    return patterns.some((pattern) => normalizedText.includes(pattern));
}

function collectTagBlocks(html, tagName) {
    const regex = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
    return html.match(regex) || [];
}

function listItemToParagraph(html) {
    return html
        .replace(/^<li\b[^>]*>/i, '<p>• ')
        .replace(/<\/li>$/i, '</p>');
}

export function extractSourceSpecificTafsir(html, sourceId) {
    if (!html || sourceId === 'kuran23' || sourceId === 'diyanet') return '';

    const blocks = [
        ...collectTagBlocks(html, 'p'),
        ...collectTagBlocks(html, 'li')
    ];

    if (!blocks.length) return '';

    const unique = new Set();
    const matchedBlocks = [];

    for (const block of blocks) {
        const normalized = normalizeText(block);
        if (!matchesSource(normalized, sourceId)) continue;

        const key = normalized.slice(0, 220);
        if (unique.has(key)) continue;
        unique.add(key);

        if (block.toLowerCase().startsWith('<li')) {
            matchedBlocks.push(listItemToParagraph(block));
        } else {
            matchedBlocks.push(block);
        }
    }

    if (!matchedBlocks.length) return '';

    return `<div class="tafsir-content-wrapper">${matchedBlocks.join('')}</div>`;
}
