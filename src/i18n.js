// English / Bengali strings and helpers.
// t('key') returns the string in the current language.
// num(n) formats numbers with Bengali digits (০১২৩…) when Bengali is active.

const STRINGS = {
  en: {
    title: 'DHAKA DASH',
    titleAlt: 'ঢাকা দৌড়',
    subtitle: "Help Rupa cross Dhaka's ten wildest roads",
    pressStart: 'PRESS ENTER OR TAP TO START',
    langButton: 'বাংলা',
    langLabel: 'Language: English',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    scanOn: 'Scanlines: On',
    scanOff: 'Scanlines: Off',
    hiScore: 'HI',
    bestNg: 'BEST NG+',
    score: 'SCORE',
    level: 'LV',
    levelWord: 'Level',
    hp: 'HP',
    time: 'TIME',
    perception: 'PERCEPTION',
    speed: 'SPEED',
    percShort: 'PER',
    speedShort: 'SPD',
    ngPlus: 'NG+',
    paused: 'PAUSED',
    resume: 'Resume',
    quit: 'Quit to title',
    gameOver: 'GAME OVER',
    gameOverSub: 'Dhaka traffic wins this round.',
    finalScore: 'Score',
    highScore: 'High score',
    newHigh: 'NEW HIGH SCORE!',
    retry: 'Retry level',
    toTitle: 'Title screen',
    victory: 'DHAKA CONQUERED!',
    victorySub: 'Rupa crossed all ten roads. Time for cha.',
    newGamePlus: 'New Game+',
    ngExplain: 'Faster, denser, ruder traffic. Keep your score & upgrades.',
    levelClear: 'ROAD CROSSED!',
    clearBonus: 'Clear bonus',
    timeBonus: 'Time bonus',
    noDamage: 'No-damage bonus',
    total: 'Total',
    tapContinue: 'Enter / tap to continue',
    controls: 'Arrows/WASD hop · P pause · M mute · L language',
    // Toasts
    tea: 'Cha! Perception XP',
    cookie: 'Biscuit! Speed XP',
    daab: 'Daab! +30 HP',
    percUp: 'PERCEPTION UP!',
    speedUp: 'SPEED UP!',
    maxed: 'MAX',
    extraLife: 'EXTRA LIFE!',
    fullHeal: 'FULL HEAL +250',
    splash: 'SPLASH!',
    lifeLost: 'Ouch! Life lost',
    wrongWay: 'WRONG WAY!',
    trainWarn: 'TRAIN!',
    // Tutorial hints (level 1)
    hint1: 'Arrows / WASD / swipe to hop',
    hint1Touch: 'Swipe, or tap the pad, to hop',
    hint2: 'Reach the far footpath',
    hint3: 'Dividers & footpaths are safe',
    hint4: 'Tea = Perception · Biscuit = Speed',
    hint5: 'Flashing lights + ! = wrong-way driver',
  },
  bn: {
    title: 'ঢাকা দৌড়',
    titleAlt: 'DHAKA DASH',
    subtitle: 'রূপাকে ঢাকার দশটি ভয়ংকর রাস্তা পার করাও',
    pressStart: 'শুরু করতে এন্টার চাপো বা ট্যাপ করো',
    langButton: 'English',
    langLabel: 'ভাষা: বাংলা',
    soundOn: 'শব্দ: চালু',
    soundOff: 'শব্দ: বন্ধ',
    scanOn: 'স্ক্যানলাইন: চালু',
    scanOff: 'স্ক্যানলাইন: বন্ধ',
    hiScore: 'সেরা',
    bestNg: 'সেরা নতুন+',
    score: 'স্কোর',
    level: 'স্তর',
    levelWord: 'স্তর',
    hp: 'শক্তি',
    time: 'সময়',
    perception: 'সতর্কতা',
    speed: 'গতি',
    percShort: 'সতর্ক',
    speedShort: 'গতি',
    ngPlus: 'নতুন+',
    paused: 'বিরতি',
    resume: 'চালিয়ে যাও',
    quit: 'মূল পাতায় ফেরো',
    gameOver: 'খেলা শেষ',
    gameOverSub: 'এবারের মতো ঢাকার জ্যাম জিতে গেল।',
    finalScore: 'স্কোর',
    highScore: 'সর্বোচ্চ স্কোর',
    newHigh: 'নতুন রেকর্ড!',
    retry: 'আবার চেষ্টা করো',
    toTitle: 'মূল পাতা',
    victory: 'ঢাকা জয়!',
    victorySub: 'রূপা দশটি রাস্তাই পার হয়েছে। এবার এক কাপ চা।',
    newGamePlus: 'নতুন খেলা+',
    ngExplain: 'আরও দ্রুত, আরও ঘন, আরও বেপরোয়া ট্রাফিক। স্কোর আর শক্তি থাকছে।',
    levelClear: 'রাস্তা পার!',
    clearBonus: 'পার বোনাস',
    timeBonus: 'সময় বোনাস',
    noDamage: 'অক্ষত বোনাস',
    total: 'মোট',
    tapContinue: 'এগোতে এন্টার / ট্যাপ',
    controls: 'তীর/WASD লাফ · P বিরতি · M শব্দ · L ভাষা',
    tea: 'চা! সতর্কতা বাড়ছে',
    cookie: 'বিস্কুট! গতি বাড়ছে',
    daab: 'ডাব! +৩০ শক্তি',
    percUp: 'সতর্কতা বাড়ল!',
    speedUp: 'গতি বাড়ল!',
    maxed: 'সর্বোচ্চ',
    extraLife: 'বাড়তি জীবন!',
    fullHeal: 'পুরো সুস্থ +২৫০',
    splash: 'ঝপাং!',
    lifeLost: 'উফ! একটা জীবন গেল',
    wrongWay: 'উল্টো পথ!',
    trainWarn: 'ট্রেন!',
    hint1: 'তীর / WASD / সোয়াইপ করে লাফাও',
    hint1Touch: 'সোয়াইপ করো বা প্যাড চেপে লাফাও',
    hint2: 'ওপারের ফুটপাতে পৌঁছাও',
    hint3: 'ডিভাইডার আর ফুটপাত নিরাপদ',
    hint4: 'চা = সতর্কতা · বিস্কুট = গতি',
    hint5: 'জ্বলা-নেভা আলো + ! = উল্টো পথের গাড়ি',
  },
};

let lang = 'en';

export const STRINGS_FOR_TEST = STRINGS;

export function setLang(l) { lang = l === 'bn' ? 'bn' : 'en'; }
export function getLang() { return lang; }

export function t(key) {
  const s = STRINGS[lang][key];
  return s === undefined ? STRINGS.en[key] ?? key : s;
}

// Pick from an { en, bn } object (used for level names etc.)
export function tr(obj) {
  return obj ? (obj[lang] ?? obj.en) : '';
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export function toBnDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

// Format a number for display in the current language
export function num(n) {
  const s = String(n);
  return lang === 'bn' ? toBnDigits(s) : s;
}

// Font helpers. English uses a pixel display face, Bengali a bold readable face.
export const FONTS = {
  pixel: '"Press Start 2P", monospace',
  bnBody: '"Hind Siliguri", sans-serif',
  bnDisplay: '"Baloo Da 2", "Hind Siliguri", sans-serif',
};

// CSS font string for UI text. `size` is the English pixel size;
// Bengali glyphs are taller/denser so they get a larger size.
export function uiFont(size, display = false) {
  if (lang === 'bn') {
    const s = Math.round(size * 1.55);
    return display ? `800 ${s}px ${FONTS.bnDisplay}` : `700 ${s}px ${FONTS.bnBody}`;
  }
  return `${size}px ${FONTS.pixel}`;
}
