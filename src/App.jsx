import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Search, X, CheckCircle, 
  PlusCircle, Sun, Moon, Users, Landmark, Database, Clock,
  ChevronDown, BookOpen, HelpCircle, ExternalLink, ShieldAlert, Activity, MapPin,
  Phone, CreditCard, Globe, FileText, Copy, Loader2, Flame
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// БАЗА ГОРОДОВ КАЗАХСТАНА ПО ОБЛАСТЯМ
const kazakhstanCitiesByRegions = {
  "Астана": ["Астана"],
  "Алматы": ["Алматы"],
  "Шымкент": ["Шымкент"],
  "Абайская область": ["Семей", "Аягоз", "Курчатов"],
  "Акмолинская область": ["Кокшетау", "Степногорск", "Щучинск", "Атбасар", "Макинск", "Акколь"],
  "Актюбинская область": ["Актобе", "Хромтау", "Шалкар", "Кандыагаш", "Эмба"],
  "Алматинская область": ["Конаев", "Талгар", "Каскелен", "Есик", "Шелек"],
  "Атырауская область": ["Атырау", "Кульсары"],
  "Западно-Казахстанская область": ["Уральск", "Аксай"],
  "Жамбылская область": ["Тараз", "Шу", "Каратау", "Жанатас"],
  "Жетысуская область": ["Талдыкорган", "Текели", "Ушарал", "Сарканд"],
  "Карагандинская область": ["Караганда", "Темиртау", "Балхаш", "Шахтинск", "Сарань", "Абай"],
  "Костанайская область": ["Костанай", "Рудный", "Житикара", "Аркалык", "Лисаковск", "Тобыл"],
  "Кызылординская область": ["Кызылорда", "Байконур", "Арал", "Казалинск"],
  "Мангистауская область": ["Актау", "Жанаозен", "Форт-Шевченко"],
  "Павлодарская область": ["Павлодар", "Экибастуз", "Аксу"],
  "Северо-Казахстанская область": ["Петропавловск", "Тайынша", "Сергеевка"],
  "Туркестанская область": ["Туркестан", "Кентау", "Арыс", "Сарыагаш", "Ленгер"],
  "Улытауская область": ["Жезказган", "Сатпаев", "Каражал"],
  "Восточно-Казахстанская область": ["Усть-Каменогорск", "Риддер", "Алтай", "Шемонаиха", "Зайсан"]
};

// Превращаем в плоский отсортированный список для выпадающего меню
const citiesList = Object.entries(kazakhstanCitiesByRegions)
  .flatMap(([region, cities]) => cities.map(city => `${city} (${region})`))
  .sort();

// УМНЫЙ АНАЛИЗАТОР ВВОДА
const detectAndFormatInput = (input) => {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'unknown', cleanValue: '', formatted: '' };

  const urlRegex = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/\S*)?$/;
  if (urlRegex.test(trimmed) || (trimmed.includes('.') && !trimmed.includes(' '))) {
    const match = trimmed.match(urlRegex);
    const domain = match ? match[3] : trimmed.toLowerCase();
    return { type: 'link', cleanValue: domain, formatted: domain };
  }

  const onlyDigits = trimmed.replace(/\D/g, '');

  if (onlyDigits.length >= 15 && onlyDigits.length <= 19) {
    const formatted = onlyDigits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2** **** $4');
    return { type: 'card', cleanValue: onlyDigits, formatted: formatted };
  }

  if (onlyDigits.length >= 9) {
    let cleanPhone = onlyDigits;
    if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
      cleanPhone = '7' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('7')) {
      cleanPhone = '7' + cleanPhone;
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('7')) {
      cleanPhone = '7' + cleanPhone;
    }
    
    const formatted = cleanPhone.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 ($2) $3-$4-$5');
    return { type: 'phone', cleanValue: `+${cleanPhone}`, formatted: formatted || `+${cleanPhone}` };
  }

  return { type: 'text', cleanValue: trimmed, formatted: trimmed };
};

const getBankByBin = (bin) => {
  if (!bin) return null;
  const first6 = bin.substring(0, 6);
  if (first6.startsWith('440043') || first6.startsWith('516949')) return 'Kaspi Bank';
  if (first6.startsWith('462319') || first6.startsWith('404505')) return 'Halyk Bank';
  if (first6.startsWith('548324')) return 'Jusan Bank';
  if (first6.startsWith('410313')) return 'BCC (ЦентрКредит)';
  if (first6.startsWith('524317')) return 'ForteBank';
  return 'Казахстанский или международный банк';
};

// Данные для интерактивного графика киберугроз в РК
const chartData = [
  { name: 'Янв', угроз: 1850 },
  { name: 'Фев', угроз: 2100 },
  { name: 'Мар', угроз: 3800 },
  { name: 'Апр', угроз: 2400 },
  { name: 'Май', угроз: 2900 },
  { name: 'Июн', угроз: 4100 }
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedType, setDetectedType] = useState('unknown');
  const [showSosModal, setShowSosModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [generatedStatement, setGeneratedStatement] = useState('');
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Форма добавления прецедента
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('Звонок из «банка» / Киберпола');
  const [newLocation, setNewLocation] = useState(citiesList[0]); // По умолчанию первый город из списка
  const [newDescription, setNewDescription] = useState('');
  const [adding, setAdding] = useState(false);

  const [latestScammers, setLatestScammers] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  const [selectedRegion, setSelectedRegion] = useState(null);

  const [regionStats, setRegionStats] = useState({
    West: { name: 'Западный КЗ (Атырау, Актау, Уральск, Актобе)', count: 142, color: 'fill-amber-500/20' },
    North: { name: 'Северный КЗ (Костанай, Петропавловск, Павлодар)', count: 98, color: 'fill-yellow-500/15' },
    Center: { name: 'Центральный КЗ (Караганда, Жезказган)', count: 187, color: 'fill-orange-500/25' },
    East: { name: 'Восточный КЗ (Усть-Каменогорск, Семей)', count: 115, color: 'fill-yellow-500/15' },
    South: { name: 'Южный КЗ (Алматы, Астана, Шымкент, Тараз, Кызылорда)', count: 421, color: 'fill-red-500/30' }
  });

  const [liveEvents, setLiveEvents] = useState([
    { id: 1, city: 'Алматы', type: 'Проверка карты', time: 'Только что', status: 'safe', zone: 'South' },
    { id: 2, city: 'Астана', type: 'Звонок «банка»', time: '2 мин назад', status: 'danger', zone: 'South' },
    { id: 3, city: 'Караганда', type: 'Обман в Instagram', time: '5 мин назад', status: 'warning', zone: 'Center' },
  ]);

  const categories = [
    'Звонок из «банка» / Киберпола',
    'Фишинг (OLX, Казпочта, поддельные сайты)',
    'Обман в Instagram / Telegram (Продавцы-призраки)',
    'Инвестиционные мошенники (Крипта, лже-КазМунайГаз)',
    'Другое'
  ];

  const scamSchemes = [
    {
      title: "Звонок из «Нацбанка / КНБ»",
      desc: "Вам звонят в WhatsApp, называют по имени-отчеству и говорят о «подозрительной заявке на кредит». Требуют перевести деньги на «безопасный счёт»."
    },
    {
      title: "Фейковая доставка (OLX / Казпочта)",
      desc: "Покупатель отправляет ссылку на поддельный сайт Казпочты для получения денег. Как только вы вводите данные карты и код из СМС, деньги списываются."
    },
    {
      title: "Лже-инвестиции",
      desc: "Реклама в соцсетях обещает высокий доход от имени «КазМунайГаз» или «Air Astana». Вас заманивают на подставные платформы и воруют крупные суммы."
    }
  ];

  const faqData = [
    {
      q: "Что делать, если я уже ввёл данные карты на сомнительном сайте?",
      a: "Немедленно зайдите в приложение вашего банка и заблокируйте карту или установите лимит на интернет-операции до нуля. После этого позвоните в банк для перевыпуска карты."
    },
    {
      q: "Как быстро отправленный мной номер появится в вашей базе?",
      a: "Все заявки проходят ручную модерацию нашей командой в течение 1–2 часов. Мы проверяем совпадения в открытых источниках, чтобы исключить случайный наговор."
    },
    {
      q: "Куда ещё, кроме вашего сайта, нужно обратиться при обмане?",
      a: "Обязательно обратитесь в Киберпол (МВД РК) по месту жительства или оставьте заявление на портале eOtinish. Наш сайт — это база предупреждения, а расследованием занимаются госорганы."
    }
  ];

  // Обработчик изменения ввода телефона с принудительной маской +7
  const handlePhoneInputChange = (e) => {
    let val = e.target.value;
    
    // Если ввод пустой или пытается удалить префикс, принудительно ставим "+7 "
    if (!val || val.length < 3) {
      setNewValue('+7 ');
      return;
    }

    // Если пользователь стёр пробел после +7, возвращаем структуру
    if (val === '+7') {
      setNewValue('+7 ');
      return;
    }

    // Разрешаем ввод, только если он начинается на +7
    if (val.startsWith('+7 ')) {
      // Вытаскиваем только цифры после +7
      const digits = val.substring(3).replace(/\D/g, '');
      
      // Ограничиваем длину номера (10 цифр после +7)
      const limitedDigits = digits.substring(0, 10);
      
      // Форматируем маску по ходу ввода: +7 (707) 123-45-67
      let formatted = '+7 ';
      if (limitedDigits.length > 0) {
        const part1 = limitedDigits.substring(0, 3);
        formatted += `(${part1}`;
        if (limitedDigits.length >= 3) formatted += ') ';
      }
      if (limitedDigits.length > 3) {
        formatted += limitedDigits.substring(3, 6);
      }
      if (limitedDigits.length > 6) {
        formatted += '-' + limitedDigits.substring(6, 8);
      }
      if (limitedDigits.length > 8) {
        formatted += '-' + limitedDigits.substring(8, 10);
      }

      setNewValue(formatted);
    }
  };

  useEffect(() => {
    const { type } = detectAndFormatInput(searchQuery);
    setDetectedType(type);
  }, [searchQuery]);

  useEffect(() => {
    fetchLatestScammers();
    const citiesByZone = [
      { city: 'Алматы', zone: 'South' }, { city: 'Астана', zone: 'South' }, { city: 'Шымкент', zone: 'South' },
      { city: 'Караганда', zone: 'Center' }, { city: 'Актобе', zone: 'West' }, { city: 'Атырау', zone: 'West' },
      { city: 'Павлодар', zone: 'North' }, { city: 'Костанай', zone: 'North' }, { city: 'Усть-Каменогорск', zone: 'East' }
    ];
    const types = ['Проверка номера', 'Фишинг OLX', 'Звонок «банка»', 'Лже-инвестиции', 'Жалоба на аккаунт', 'Проверка карты'];
    const statuses = ['safe', 'danger', 'warning'];

    const interval = setInterval(() => {
      const randomPlace = citiesByZone[Math.floor(Math.random() * citiesByZone.length)];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      const newEvent = { 
        id: Date.now(), 
        city: randomPlace.city, 
        type: randomType, 
        time: 'Только что', 
        status: randomStatus,
        zone: randomPlace.zone
      };

      setRegionStats(prev => ({
        ...prev,
        [randomPlace.zone]: { ...prev[randomPlace.zone], count: prev[randomPlace.zone].count + 1 }
      }));

      setLiveEvents(prev => [newEvent, ...prev.map(e => ({ ...e, time: e.time === 'Только что' ? '1 мин назад' : 'Несколько мин назад' })).slice(0, 2)]);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const fetchLatestScammers = async () => {
    try {
      setLoadingLatest(true);
      const { data, error } = await supabase
        .from('scammers')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      setLatestScammers(data || []);
    } catch (error) {
      console.error("Ошибка загрузки ленты угроз:", error);
    } finally {
      setLoadingLatest(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchResult(null);

    const { type, cleanValue, formatted } = detectAndFormatInput(searchQuery);

    try {
      const { data, error } = await supabase
        .from('scammers')
        .select('*')
        .eq('value', cleanValue);

      if (error) throw error;

      if (data && data.length > 0) {
        const record = data[0];
        setSearchResult({ 
          score: record.is_approved ? 100 : 60, 
          status: record.is_approved ? 'danger' : 'warning', 
          details: record,
          inputType: type,
          formattedValue: formatted,
          totalComplaints: data.length
        });
      } else {
        setSearchResult({ 
          score: 0, 
          status: 'safe', 
          details: null,
          inputType: type,
          formattedValue: formatted,
          totalComplaints: 0
        });
      }
    } catch (error) {
      console.error("Ошибка при поиске:", error);
      alert("Не удалось связаться с базой данных.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddScammer = async (e) => {
    e.preventDefault();
    if (!newValue.trim() || !newDescription.trim() || !newLocation.trim()) {
      alert("Пожалуйста, заполните все поля!");
      return;
    }

    setAdding(true);
    const { cleanValue } = detectAndFormatInput(newValue);
    const fullDescription = `[${newCategory}] — ${newDescription.trim()}`;

    try {
      const { error } = await supabase
        .from('scammers')
        .insert([{ value: cleanValue, description: fullDescription, location: newLocation.trim() }]);

      if (error) throw error;

      alert(`Спасибо! Данные отправлены на модерацию.`);
      setNewValue('');
      setNewDescription('');
      setNewLocation(citiesList[0]);
      fetchLatestScammers();
    } catch (error) {
      console.error("Ошибка при добавлении:", error);
      alert("Ошибка добавления.");
    } finally {
      setAdding(false);
    }
  };

  const generateStatementText = () => {
    const type = searchResult?.inputType;
    const val = searchResult?.formattedValue;
    const desc = searchResult?.details?.description || 'интернет-мошенничество и попытка хищения денежных средств.';
    
    let template = `Начальнику Департамента полиции\n`;
    template += `От: ФИО (Укажите ваши данные)\n`;
    template += `ИИН: (Укажите ваш ИИН)\n`;
    template += `Телефон для связи: (Ваш телефон)\n\n`;
    template += `ЗАЯВЛЕНИЕ\n`;
    template += `о совершении уголовного правонарушения (ст. 190 УК РК «Мошенничество»)\n\n`;
    template += `Настоящим доношу до Вашего сведения, что в отношении меня были совершены противоправные действия мошеннического характера. \n\n`;

    if (type === 'phone') {
      template += `Злоумышленники вышли со мной на связь посредством телефонного звонка / мессенджера WhatsApp с номера: ${val}.\n`;
    } else if (type === 'card') {
      template += `Денежные средства под влиянием обмана были переведены (или требовалось перевести) на банковскую карту РК №: ${val}, банк получателя: ${getBankByBin(val.replace(/\D/g,''))}.\n`;
    } else if (type === 'link') {
      template += `Обман был осуществлен через мошеннический интернет-ресурс / фишинговый сайт по адресу: ${val}.\n`;
    } else {
      template += `В отношении меня была предпринята попытка обмана со следующими реквизитами: ${val}.\n`;
    }

    template += `Суть инцидента: ${desc}\n\n`;
    template += `В соответствии со статьей 181 УПК РК прошу зарегистрировать данное заявление в Едином реестре досудебных расследований (ЕРДР) Республики Казахстан и принять меры по установлению лиц, причастных к совершению данного преступления.\n\n`;
    template += `Об уголовной ответственности за заведомо ложный донос по ст. 419 УК РК предупрежден(а).\n\n`;
    template += `Дата подачи: ${new Date().toLocaleDateString('ru-RU')} г.`;

    setGeneratedStatement(template);
    setCopied(false);
    setShowLegalModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedStatement);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 relative flex flex-col justify-between overflow-x-hidden ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full">
        
        {/* Шапка */}
        <header className={`sticky top-0 z-50 transition-colors backdrop-blur-md border-b ${
          darkMode ? 'bg-slate-950/70 border-slate-900' : 'bg-white/70 border-slate-200'
        }`}>
          <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className={`font-black text-2xl tracking-tight ${darkMode ? 'bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent' : 'text-slate-900'}`}>
                AldarKose<span className="text-blue-500">.kz</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowSosModal(true)}
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black px-5 py-3 rounded-xl transition-all duration-300 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 active:scale-95"
              >
                МЕНЯ ОБМАНУЛИ (SOS)
              </button>
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                className={`p-2.5 rounded-xl border transition-all ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-yellow-400 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* Статистика */}
        <section className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Угроз в базе РК', val: '28,492', icon: Database, color: 'text-blue-400' },
            { label: 'Проверок граждан', val: '149,200+', icon: Users, color: 'text-emerald-400' },
            { label: 'Банков-партнеров', val: '5', icon: Landmark, color: 'text-purple-400' },
            { label: 'Бесплатная защита', val: '100%', icon: CheckCircle, color: 'text-teal-400' },
          ].map((item, idx) => (
            <div key={idx} className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 ${
              darkMode ? 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
            }`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className={`text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.val}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.label}</div>
                </div>
                <div className={`p-2 rounded-xl ${darkMode ? 'bg-slate-950 border border-slate-900' : 'bg-slate-50'} ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Основной блок */}
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* ЛЕВАЯ КОЛОНКА */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Форма поиска */}
              <div className={`border rounded-3xl p-6 sm:p-8 backdrop-blur-md relative overflow-hidden transition-all ${
                darkMode ? 'bg-slate-900/30 border-slate-800/60 shadow-2xl' : 'bg-white border-slate-200 shadow-md'
              }`}>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">Профессиональный щит безопасности</h1>
                <p className="text-slate-400 text-sm mb-6">Интеллектуальная система защиты мгновенно анализирует телефоны, банковские карты Казахстана и фишинговые домены в реальном времени.</p>

                <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 focus-within:from-blue-500 focus-within:to-indigo-500 transition-all duration-300 shadow-xl shadow-blue-950/10">
                  <form onSubmit={handleSearch} className={`flex flex-col sm:flex-row gap-2 p-2 rounded-[15px] ${darkMode ? 'bg-slate-950/95' : 'bg-white'}`}>
                    <div className="flex-1 relative flex items-center pl-3">
                      <input 
                        type="text" 
                        placeholder="Введите номер телефона, карту или домен..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder-slate-500 pr-10 py-3"
                      />
                      
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {detectedType === 'phone' && <Phone className="w-4 h-4 text-blue-500 animate-pulse" />}
                        {detectedType === 'card' && <CreditCard className="w-4 h-4 text-emerald-500 animate-pulse" />}
                        {detectedType === 'link' && <Globe className="w-4 h-4 text-purple-500" />}
                        {detectedType === 'text' && <Search className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Проверить"}
                    </button>
                  </form>
                </div>

                {searchQuery && (
                  <div className="text-[11px] mt-3 px-3 py-1.5 rounded-xl inline-flex bg-slate-500/5 border border-slate-800/60 text-slate-400 font-semibold">
                    {detectedType === 'phone' && "📱 Системный радар: Номер телефона (форматирование в +7...)"}
                    {detectedType === 'card' && `💳 Системный радар: Банковская карта. БИН: ${getBankByBin(searchQuery.replace(/\D/g, ''))}`}
                    {detectedType === 'link' && "🌐 Системный радар: Веб-сайт. Проверяется корневой домен."}
                    {detectedType === 'text' && "🔍 Системный радар: Текстовый запрос."}
                  </div>
                )}
              </div>

              {/* RISK SCORE РЕЗУЛЬТАТ */}
              {searchResult && (
                <div className={`rounded-3xl p-6 border shadow-2xl transition-all duration-300 ${
                  searchResult.status === 'danger' ? (darkMode ? 'bg-red-950/10 border-red-900/40 shadow-red-950/5' : 'bg-red-50/70 border-red-200/80') : 
                  searchResult.status === 'warning' ? (darkMode ? 'bg-amber-950/10 border-amber-900/40 shadow-amber-950/5' : 'bg-amber-50/70 border-amber-200/80') : 
                  (darkMode ? 'bg-emerald-950/10 border-emerald-900/40 shadow-emerald-950/5' : 'bg-emerald-50/70 border-emerald-200/80')
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-dashed border-slate-700/20">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2 rounded-xl border ${
                        searchResult.status === 'danger' ? 'bg-red-500/10 border-red-500/20' : 
                        searchResult.status === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                        <ShieldAlert className={`w-6 h-6 ${searchResult.status === 'danger' ? 'text-red-500' : searchResult.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-black tracking-tight">
                          Объект: <span className="font-mono text-blue-500 underline break-all">{searchResult.formattedValue}</span>
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1 items-center">
                          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                            Тип: {searchResult.inputType === 'phone' ? '📱 Телефон' : searchResult.inputType === 'card' ? '💳 Банковская карта' : searchResult.inputType === 'link' ? '🌐 Веб-сайт' : '🔍 Текст'}
                          </span>
                          
                          {searchResult.totalComplaints > 0 && (
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              searchResult.status === 'danger' 
                                ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                              ⚠️ Жалоб в базе: {searchResult.totalComplaints}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl text-center font-black text-xl border backdrop-blur-md min-w-[75px] shadow-sm ${
                      searchResult.status === 'danger' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 
                      searchResult.status === 'warning' ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 
                      'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                    }`}>
                      {searchResult.score}% <span className="text-[9px] block font-bold uppercase tracking-widest text-slate-400 mt-0.5">Риск</span>
                    </div>
                  </div>

                  <div className="mb-6 bg-slate-200 dark:bg-slate-900 h-2.5 rounded-full p-[2px] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${
                      searchResult.status === 'danger' ? 'bg-gradient-to-r from-orange-500 to-red-600' :
                      searchResult.status === 'warning' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-teal-400 to-emerald-500'
                    }`} style={{ width: `${searchResult.score === 0 ? 4 : searchResult.score}%` }} />
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {searchResult.status !== 'safe' ? (
                      <div>
                        <div className="font-extrabold text-sm text-red-500 dark:text-red-400 mb-2 uppercase tracking-wide">
                          🛑 ОБЪЕКТ ЗАФИКСИРОВАН В ЧЕРНОМ СПИСКЕ
                        </div>
                        <p className="mb-3 text-slate-400">Регион происхождения инцидента: <strong className="text-slate-800 dark:text-slate-200">{searchResult.details.location || 'Не указан'}</strong></p>
                        
                        <div className="p-3.5 mb-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-slate-500 dark:text-slate-400 font-medium">
                          {searchResult.inputType === 'phone' && "Никогда не вступайте в диалог в WhatsApp/Telegram. Мошенники используют подменные номера и виртуальные АТС."}
                          {searchResult.inputType === 'card' && `Внимание! Карточный счёт числится в банке [${getBankByBin(searchResult.formattedValue.replace(/\D/g,''))}]. Транзакции в пользу третьих лиц строго не рекомендуются.`}
                          {searchResult.inputType === 'link' && "Внимание! Это фишинговый дубликат официального сервиса. Ввод паролей приведет к краже аккаунта."}
                        </div>

                        <div className="p-4 rounded-2xl border italic font-mono bg-white dark:bg-slate-950/30 dark:border-slate-900 shadow-inner mb-4">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block not-italic mb-1.5">
                            {searchResult.totalComplaints > 1 ? "Сводка последней поданной жалобы:" : "Первичная сводка жалобы:"}
                          </span>
                          "{searchResult.details.description}"
                        </div>

                        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> Шаблон заявления для eOtinish.kz
                            </span>
                            <button 
                              onClick={() => {
                                const text = `Начальнику Департамента Полиции. ЗАЯВЛЕНИЕ. Прошу принять меры в отношении неустановленных лиц, совершивших мошеннические действия. В ходе инцидента использовались следующие данные: ${searchResult.formattedValue} (${searchResult.inputType === 'phone' ? 'Телефон' : searchResult.inputType === 'card' ? 'Карта' : 'Ссылка'}). Дополнительные детали происшествия: ${searchResult.details.description}. Регион: ${searchResult.details.location || 'РК'}.`;
                                navigator.clipboard.writeText(text);
                                alert("Текст заявления скопирован в буфер обмена!");
                              }}
                              className="text-[10px] font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors px-2 py-1 rounded-md bg-slate-500/5 border border-transparent hover:border-blue-500/20"
                            >
                              <Copy className="w-3 h-3" /> Копировать text
                            </button>
                          </div>
                          <div className="text-[11px] font-mono p-3 rounded-xl bg-white dark:bg-slate-950 border dark:border-slate-900/80 text-slate-500 dark:text-slate-400 h-24 overflow-y-auto leading-normal select-all">
                            Начальнику Департамента Полиции. <br />
                            <strong>ЗАЯВЛЕНИЕ.</strong> <br />
                            Прошу принять установленные законом меры в отношении лиц, совершивших мошеннические действия. В ходе правонарушения использовались данные: <span className="text-blue-500 font-bold">{searchResult.formattedValue}</span>. Сводка инцидента: "{searchResult.details.description}".
                          </div>
                          <a 
                            href="https://eotinish.kz/kk" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-2.5 w-full inline-flex justify-center items-center gap-1.5 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-[11px] font-black uppercase tracking-wider transition-all"
                          >
                            Перейти на eOtinish.kz <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                      </div>
                    ) : (
                      <div>
                        <div className="font-extrabold text-sm text-emerald-500 mb-2 uppercase tracking-wide">🟢 СОВПАДЕНИЙ НЕ ОБНАРУЖЕНО</div>
                        <p className="mb-3 text-slate-400 font-medium">В нашей базе угроз чисто. Но будьте бдительны:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-4">
                          <div className="p-3.5 rounded-2xl border dark:border-slate-900 bg-slate-100 dark:bg-slate-950/20">
                            <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Безопасность сделок</strong>
                            Не отправляйте предоплату на карты физ. лиц без договора.
                          </div>
                          <div className="p-3.5 rounded-2xl border dark:border-slate-900 bg-slate-100 dark:bg-slate-950/20">
                            <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">При звонках</strong>
                            Службы безопасности ведомств никогда не звонят через мессенджеры.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ЛЕНТА АКТУАЛЬНЫХ СХЕМ ОБМАНА */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="text-blue-500 w-4 h-4" /> Актуальные схемы обмана в РК
                  </h2>
                  <span className="text-[10px] bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Внимание</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {scamSchemes.map((scheme, idx) => (
                    <div key={idx} className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      darkMode ? 'bg-slate-900/20 border-slate-800/60 hover:border-slate-700' : 'bg-white border-slate-200 hover:shadow-md'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 dark:text-red-400">
                            Схема #{idx + 1}
                          </span>
                        </div>
                        <h4 className="text-xs font-black mb-1.5 text-slate-800 dark:text-slate-100 leading-tight">
                          {scheme.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                          {scheme.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Форма добавления */}
              <div className={`border rounded-3xl p-6 sm:p-8 shadow-inner ${
                darkMode ? 'bg-slate-900/20 border-slate-800/60' : 'bg-slate-100/60 border-slate-200 shadow-inner'
              }`}>
                <h2 className="text-base font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <PlusCircle className="text-blue-500 w-4 h-4" /> Отправить прецедент в базу
                </h2>
                <form onSubmit={handleAddScammer} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Данные (Телефон):</label>
                      <input 
                        type="text" 
                        placeholder="+7 (7XX) XXX-XX-XX" 
                        value={newValue} 
                        onChange={handlePhoneInputChange} 
                        onFocus={(e) => { if(!newValue) setNewValue('+7 ') }}
                        className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-mono font-bold ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-300'
                        }`} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Город / Область РК:</label>
                      <select 
                        value={newLocation} 
                        onChange={(e) => setNewLocation(e.target.value)} 
                        className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-medium max-h-[45px] overflow-y-auto ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                        }`}
                      >
                        {citiesList.map((city, idx) => (
                          <option key={idx} value={city} className={darkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Категория:</label>
                      <select 
                        value={newCategory} 
                        onChange={(e) => setNewCategory(e.target.value)} 
                        className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-medium ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300'
                        }`}
                      >
                        {categories.map((cat, idx) => <option key={idx} value={cat} className={darkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Описание инцидента:</label>
                    <textarea 
                      placeholder="Опишите детально суть обмана, чтобы предупредить других казахстанцев..." 
                      value={newDescription} 
                      onChange={(e) => setNewDescription(e.target.value)} 
                      rows="3" 
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all font-medium ${
                        darkMode ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-300'
                      }`} 
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={adding} 
                    className="w-full font-black text-xs uppercase tracking-wider py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-600/10 active:scale-[0.99] disabled:opacity-50"
                  >
                    {adding ? "Отправка..." : "Отправить на модерацию"}
                  </button>
                </form>
              </div>

              {/* Часто задаваемые вопросы */}
              <div className="space-y-4 pt-4">
                <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="text-indigo-400 w-4 h-4" /> Часто задаваемые вопросы
                </h2>
                <div className="space-y-2.5">
                  {faqData.map((faq, idx) => (
                    <div key={idx} className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                      darkMode ? 'border-slate-900 bg-slate-900/10' : 'border-slate-200 bg-white shadow-sm'
                    }`}>
                      <button 
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        className="w-full px-5 py-4 text-left font-bold text-xs sm:text-sm flex justify-between items-center hover:text-blue-400 transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${openFaq === idx ? 'rotate-180 text-blue-400' : ''}`} />
                      </button>
                      {openFaq === idx && (
                        <div className="px-5 pb-4 pt-1 text-xs text-slate-400 border-t border-dashed dark:border-slate-900/60 leading-relaxed font-medium">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА */}
            <div className="space-y-6">
              <div className={`border rounded-3xl p-5 backdrop-blur-md shadow-sm relative overflow-hidden ${
                darkMode ? 'bg-gradient-to-br from-slate-900/40 to-slate-950/45 border-slate-800/80' : 'bg-white border-slate-200'
              }`}>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-red-500/10 rounded-full blur-xl pointer-events-none" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Экстренные контакты РК
                </h3>
                <div className="space-y-2.5">
                  <a href="tel:102" className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    darkMode ? 'bg-slate-950/40 border-slate-900 hover:border-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs">102</div>
                      <div>
                        <div className="text-xs font-bold">Полиция РК</div>
                        <div className="text-[10px] text-slate-500">Подать экстренное сообщение</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <a href="tel:1414" className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    darkMode ? 'bg-slate-950/40 border-slate-900 hover:border-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-xs">1414</div>
                      <div>
                        <div className="text-xs font-bold">Единый контакт-центр</div>
                        <div className="text-[10px] text-slate-500">Блокировка документов, eGov</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <a href="tel:114" className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    darkMode ? 'bg-slate-950/40 border-slate-900 hover:border-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs">114</div>
                      <div>
                        <div className="text-xs font-bold">Горячая линия 114</div>
                        <div className="text-[10px] text-slate-500">Интернет-мошенничество</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>
              </div>

              {/* ГРАФИК ДИНАМИКИ КИБЕРУГРОЗ */}
              <div className={`border rounded-3xl p-5 backdrop-blur-md shadow-sm ${
                darkMode ? 'bg-slate-900/30 border-slate-800/60' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" /> Аналитика всплесков угроз
                  </h3>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Live</span>
                </div>
                <div className="h-44 w-full -ml-4 pr-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="neonBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <YAxis hide={true} domain={['dataMin - 500', 'dataMax + 500']} />
                      <Tooltip contentStyle={{ backgroundColor: darkMode ? '#020617' : '#ffffff', borderRadius: '12px', borderColor: darkMode ? '#1e293b' : '#e2e8f0', fontSize: '11px', fontWeight: '700' }} />
                      <Area type="monotone" dataKey="угроз" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#neonBlue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-2 font-medium">*Пики зафиксированы в марте (8 марта) и июне (период отпусков).</p>
              </div>

              {/* ТЕПЛОВАЯ КАРТА */}
              <div className={`border rounded-3xl p-5 backdrop-blur-md shadow-sm ${
                darkMode ? 'bg-slate-900/30 border-slate-800/60' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" /> Тепловая карта киберугроз РК
                </h3>
                <div className="w-full bg-slate-950/20 dark:bg-slate-950/60 rounded-2xl p-2 border dark:border-slate-900 flex justify-center items-center relative group overflow-hidden">
                  <svg viewBox="0 0 500 300" className="w-full h-auto transition-all">
                    <path d="M20,120 L130,80 L180,140 L160,230 L50,220 Z" className={`transition-colors cursor-pointer stroke-slate-800/40 stroke-2 ${regionStats.West.color} hover:fill-amber-500/50`} onMouseEnter={() => setSelectedRegion('West')} onMouseLeave={() => setSelectedRegion(null)} />
                    <path d="M130,80 L280,60 L320,110 L220,150 L180,140 Z" className={`transition-colors cursor-pointer stroke-slate-800/40 stroke-2 ${regionStats.North.color} hover:fill-yellow-500/50`} onMouseEnter={() => setSelectedRegion('North')} onMouseLeave={() => setSelectedRegion(null)} />
                    <path d="M180,140 L220,150 L320,110 L380,190 L260,230 Z" className={`transition-colors cursor-pointer stroke-slate-800/40 stroke-2 ${regionStats.Center.color} hover:fill-orange-500/50`} onMouseEnter={() => setSelectedRegion('Center')} onMouseLeave={() => setSelectedRegion(null)} />
                    <path d="M320,110 L450,110 L480,190 L380,190 Z" className={`transition-colors cursor-pointer stroke-slate-800/40 stroke-2 ${regionStats.East.color} hover:fill-yellow-500/50`} onMouseEnter={() => setSelectedRegion('East')} onMouseLeave={() => setSelectedRegion(null)} />
                    <path d="M160,230 L260,230 L380,190 L420,260 L240,280 L120,270 Z" className={`transition-colors cursor-pointer stroke-slate-800/40 stroke-2 ${regionStats.South.color} hover:fill-red-500/60`} onMouseEnter={() => setSelectedRegion('South')} onMouseLeave={() => setSelectedRegion(null)} />
                    <circle cx="360" cy="230" r="4" className="fill-white stroke-red-500 stroke-2 animate-pulse" />
                    <circle cx="270" cy="100" r="4" className="fill-white stroke-red-500 stroke-2 animate-pulse" />
                    <circle cx="230" cy="240" r="4" className="fill-white stroke-red-500 stroke-2 animate-pulse" />
                  </svg>
                  <div className={`absolute bottom-2 left-2 right-2 p-2.5 rounded-xl border text-[11px] font-semibold backdrop-blur-md transition-all duration-300 shadow-xl ${selectedRegion ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'} ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                    {selectedRegion && (
                      <div>
                        <div className="font-extrabold text-blue-500">{regionStats[selectedRegion].name}</div>
                        <div className="text-slate-400 mt-0.5">Активных инцидентов: <span className="font-black text-red-500">{regionStats[selectedRegion].count}</span></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 text-center mt-2 font-medium tracking-wide">Наведите на регион для просмотра уровня угроз</div>
              </div>

              {/* Поток активности */}
              <div className={`border rounded-3xl p-5 backdrop-blur-md shadow-sm ${
                darkMode ? 'bg-slate-900/30 border-slate-800/60' : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> Поток активности AntiScam (РК)
                </h3>
                <div className="space-y-3">
                  {liveEvents.map((event) => (
                    <div key={event.id} className={`p-3.5 rounded-xl border flex justify-between items-center text-xs font-medium ${
                      darkMode ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-50 border-slate-100 shadow-sm'
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`w-1.5 h-1.5 rounded-full ${event.status === 'danger' ? 'bg-red-500' : event.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                          <span>{event.city}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-normal">{event.type}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{event.time}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Лента свежих угроз */}
              <div className={`border rounded-3xl p-5 backdrop-blur-md shadow-sm ${
                darkMode ? 'bg-slate-900/30 border-slate-800/60' : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-500" /> Свежие угрозы (РК)
                </h3>
                {loadingLatest ? (
                  <div className="flex justify-center py-4 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {latestScammers.map((scammer) => (
                      <div key={scammer.id} className="p-3.5 border-l-2 border-red-500 rounded-r-2xl text-xs font-medium bg-red-500/5 dark:bg-slate-950/50 border dark:border-slate-900/60 border-l-red-500">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="font-mono font-black text-red-500 break-all">{scammer.value}</div>
                          {scammer.location && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 flex items-center gap-0.5 shrink-0">
                              <MapPin className="w-2.5 h-2.5" />{scammer.location}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 italic line-clamp-2 font-medium">"{scammer.description}"</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* МОДАЛЬНЫЕ ОКНА */}
      {showLegalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl relative max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setShowLegalModal(false)} className="absolute right-4 top-4 p-2 rounded-full hover:bg-slate-500/10 transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 text-blue-500">
              <FileText className="w-6 h-6" />
              <h2 className="text-xl font-black tracking-tight uppercase">Готовое заявление для eOtinish.kz</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Скопируйте текст ниже, перейдите на портал <strong>eOtinish.kz</strong>, выберите «Подать обращение» -> «Министерство внутренних дел РК» и вставьте в поле текста.</p>
            <div className="relative">
              <pre className={`p-4 rounded-2xl border text-xs font-mono whitespace-pre-wrap h-64 overflow-y-auto leading-relaxed shadow-inner ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                {generatedStatement}
              </pre>
              <button onClick={copyToClipboard} className="absolute top-3 right-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md active:scale-95">
                <Copy className="w-3.5 h-3.5" /> {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-slate-400 leading-normal font-medium">
              <strong>💡 Совет:</strong> Перед отправкой обязательно замените заглушки в скобках своими личными данными (ФИО, ИИН), чтобы полиция приняла заявление в обработку.
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLegalModal(false)} className="flex-1 font-bold py-3.5 rounded-xl bg-slate-500/10 text-xs tracking-wider uppercase transition-colors">Закрыть</button>
              <a href="https://eotinish.kz" target="_blank" rel="noreferrer" className="flex-1 font-black py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10">
                Открыть eOtinish <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {showSosModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-xl rounded-3xl p-6 border shadow-2xl relative max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setShowSosModal(false)} className="absolute right-4 top-4 p-2 rounded-full hover:bg-slate-500/10 transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-black tracking-tight uppercase">Экстренный план действий</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Если вы только что отправили деньги мошенникам или сообщили коды, действуйте по шагам в течение первых 15 минут:</p>
            <div className="space-y-3 text-xs leading-relaxed font-medium">
              <div className="p-4 border border-blue-500/20 rounded-2xl bg-blue-500/5">
                <strong className="text-blue-400 block mb-1 uppercase text-[10px] tracking-wider font-black">Шаг 1. Блокировка карт и счетов</strong>
                Срочно зайдите в мобильное приложение (Kaspi, Halyk и др.), откройте настройки карты и заблокируйте её. Либо позвоните на горячую линию банка (Kaspi: 9999, Halyk: 7111).
              </div>
              <div className="p-4 border border-amber-500/20 rounded-2xl bg-amber-500/5">
                <strong className="text-amber-400 block mb-1 uppercase text-[10px] tracking-wider font-black">Шаг 2. Защита личного кабинета</strong>
                Если мошенники получили СМС-коды, они могут зайти в ваш eGov Mobile или банкинг. Зайдите в настройки приложений и завершите все активные сессии на других устройствах.
              </div>
              <div className="p-4 border border-purple-500/20 rounded-2xl bg-purple-500/5">
                <strong className="text-purple-400 block mb-1 uppercase text-[10px] tracking-wider font-black">Шаг 3. Фиксация улик</strong>
                Сделайте скриншоты переписки, номеров телефонов и сохраните квитанцию о переводе. Не удаляйте чат сами!
              </div>
              <div className="p-4 border border-red-500/20 rounded-2xl bg-red-500/5">
                <strong className="text-red-400 block mb-1 uppercase text-[10px] tracking-wider font-black">Шаг 4. Подача заявления</strong>
                Подайте официальное обращение онлайн через портал <strong>eOtinish.kz</strong> в Министерство внутренних дел РК (МВД) или обратитесь в ближайший отдел полиции (Киберпол).
              </div>
            </div>
            <button onClick={() => setShowSosModal(false)} className="w-full font-black text-xs uppercase tracking-wider py-4 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 mt-5 transition-all active:scale-[0.99]">Я всё понял, закрыть</button>
          </div>
        </div>
      )}

      {/* Подвал */}
      <footer className={`border-t py-6 text-center text-[11px] font-semibold tracking-wide text-slate-500 ${darkMode ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-slate-100'}`}>
        <p>© 2026 AntiScam.kz — Общественный проект защиты от киберугроз в Республике Казахстан.</p>
      </footer>
      
    </div>
  );
}