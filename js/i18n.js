/**
 * Site i18n — EN (default) and RU. Preference: localStorage key `lang`.
 */

export const STORAGE_KEY = 'lang';
export const DEFAULT_LANG = 'en';
const SUPPORTED = new Set(['en', 'ru']);

/** @type {Set<(lang: string) => void>} */
const listeners = new Set();

export const translations = {
  en: {
    'meta.description': 'Julia Zhuravleva — Web Developer & UI/UX portfolio',
    'meta.title': 'Julia Zhuravleva — Portfolio',
    'nav.aria': 'Primary navigation',
    'nav.brandAria': 'Julia Zhuravleva home',
    'nav.toggleMenu': 'Toggle navigation menu',
    'nav.home': 'Home',
    'nav.work': 'Work',
    'nav.gallery': 'Gallery',
    'nav.contact': 'Contact',
    'nav.cta': 'Let’s talk',
    'nav.langGroup': 'Language',
    'nav.langEn': 'English',
    'nav.langRu': 'Russian',
    'hero.heading': 'Julia Zhuravleva',
    'hero.desc':
      'A row of three-dimensional domino tiles falls in a chain reaction. The final tile lands to reveal Julia Zhuravleva, Web Developer and UI/UX designer.',
    'hero.kicker': 'Interactive Intro',
    'hero.intro':
      'Distinctive web experiences with a bold visual point of view, built with responsive front-end craft and clear UI/UX thinking.',
    'hero.availability': 'Available for freelance',
    'hero.subtitle': 'Web Developer · UI/UX',
    'hero.replay': 'Replay',
    'hero.replayAria': 'Replay domino animation',
    'toolkit.kicker': 'Project Toolkit',
    'toolkit.heading': 'Technologies and services Julia can use for projects',
    'toolkit.marqueeAria': 'Technologies and services Julia can use for projects',
    'toolkit.responsiveDesign': 'Responsive Design',
    'toolkit.uiUx': 'UI/UX Design',
    'toolkit.webAnimation': 'Web Animation',
    'toolkit.accessibility': 'Accessibility',
    'toolkit.seoBasics': 'SEO Basics',
    'toolkit.performance': 'Performance',
    'toolkit.landingPages': 'Landing Pages',
    'toolkit.portfolioSites': 'Portfolio Websites',
    'toolkit.bookingFlows': 'Booking Flows',
    'toolkit.webConsulting': 'Web Consulting',
    'projects.kicker': 'Digital Projects',
    'projects.title': 'Selected Work',
    'projects.intro':
      'Web development with a UI/UX focus: refined interfaces, responsive layouts, and clear user paths for real service-based brands.',
    'projects.servicesAria': 'Project services',
    'project1.category': 'Interior Designer Website',
    'project1.desc':
      'Russian-language interior designer portfolio with an immersive project showcase, polished service flow, direct contact path, and refined visual presentation.',
    'project1.view': 'View Project',
    'project1.tagUiUx': 'UI/UX',
    'project1.tagFrontend': 'Front-end',
    'project1.tagResponsive': 'Responsive Website',
    'project1.tagBranding': 'Branding / Presentation',
    'project2.category': 'Travel / Transfers Platform',
    'project2.desc':
      'Transport and shuttle service website for Svaneti, covering Mestia, Ushguli, and Georgia routes with clear booking and service presentation.',
    'project2.view': 'View Project',
    'project2.tagUiUx': 'UI/UX',
    'project2.tagFrontend': 'Front-end',
    'project2.tagResponsive': 'Responsive Website',
    'project2.tagBooking': 'Booking Flow',
    'gallery.heading': 'Phone screen gallery',
    'gallery.gridAria': 'Additional website screenshots',
    'gallery.hse1Alt': 'HSE project mobile website screen',
    'gallery.hse2Alt': 'HSE project mobile website screen with additional page content',
    'gallery.tzeh0Alt': 'Tzeh project mobile website hero screen',
    'gallery.tzeh1Alt': 'Tzeh project mobile website content screen',
    'gallery.tzeh2Alt': 'Tzeh project mobile website detail screen',
    'gallery.laptopOlgaAria': 'Open Olga Bogoslavskaya website in a new tab',
    'gallery.laptopSvangoAria': 'Open SvanGo website in a new tab',
    'contact.kicker': 'Contact',
    'contact.title': 'Let\'s build something polished',
    'contact.copy':
      'Share a website idea, UI/UX brief, or consulting question. Julia will reply with a clear next step and a refined plan for the project.',
    'contact.methodsAria': 'Contact methods',
    'contact.methodsEyebrow': 'Fast ways to reach Julia',
    'contact.emailLabel': 'Email',
    'contact.sendMail': 'Send mail',
    'contact.telegramLabel': 'Telegram',
    'contact.openChat': 'Open chat',
    'contact.whatsappLabel': 'WhatsApp',
    'contact.whatsappAria': 'Message Julia on WhatsApp',
    'contact.whatsappText': 'Quick message for project details',
    'contact.message': 'Message',
    'contact.note': 'Available for freelance websites, UI/UX design, and consulting.',
    'form.eyebrow': 'Project inquiry',
    'form.title': 'Tell Julia what you need',
    'form.name': 'Name',
    'form.namePlaceholder': 'Your name',
    'form.email': 'Email',
    'form.emailPlaceholder': 'you@example.com',
    'form.projectType': 'Project type',
    'form.optionWebsite': 'Website',
    'form.optionUiUx': 'UI/UX Design',
    'form.optionConsulting': 'Consulting',
    'form.optionOther': 'Other',
    'form.message': 'Message',
    'form.messagePlaceholder': 'A few details about the project, timeline, and goals...',
    'form.submit': 'Write Julia',
    'form.errorName': 'Please add your name.',
    'form.errorEmail': 'Please add your email.',
    'form.errorEmailInvalid': 'Please enter a valid email address.',
    'form.errorMessage': 'Please describe what you would like to build.',
    'form.statusFix': 'Please fix the highlighted fields before sending.',
    'form.statusOpening': 'Opening your email app with the message prepared.',
    'form.mailtoSubject': 'Portfolio inquiry: {type}',
    'form.mailtoName': 'Name',
    'form.mailtoEmail': 'Email',
    'form.mailtoProjectType': 'Project type',
    'form.mailtoMessage': 'Message',
    'footer.heading': 'Julia Zhuravleva',
    'footer.tagline': 'Web Developer · UI/UX',
    'footer.backToTop': 'Back to top',
    'footer.copyright': '© 2026 Julia Zhuravleva. All rights reserved.',
    'footer.navAria': 'Footer navigation',
  },
  ru: {
    'meta.description': 'Юлия Журавлёва — веб-разработчик и UI/UX, портфолио',
    'meta.title': 'Юлия Журавлёва — Портфолио',
    'nav.aria': 'Основная навигация',
    'nav.brandAria': 'На главную — Юлия Журавлёва',
    'nav.toggleMenu': 'Открыть или закрыть меню',
    'nav.home': 'Главная',
    'nav.work': 'Работы',
    'nav.gallery': 'Галерея',
    'nav.contact': 'Контакты',
    'nav.cta': 'Обсудить проект',
    'nav.langGroup': 'Язык',
    'nav.langEn': 'Английский',
    'nav.langRu': 'Русский',
    'hero.heading': 'Юлия Журавлёва',
    'hero.desc':
      'Ряд трёхмерных домино падает цепной реакцией. Последняя плитка открывает имя Юлия Журавлёва — веб-разработчик и UI/UX-дизайнер.',
    'hero.kicker': 'Интерактивное вступление',
    'hero.intro':
      'Выразительные веб-проекты с сильным визуальным взглядом, адаптивным фронтендом и продуманным UI/UX.',
    'hero.availability': 'Открыта для фриланса',
    'hero.subtitle': 'Веб-разработчик · UI/UX',
    'hero.replay': 'Повторить',
    'hero.replayAria': 'Повторить анимацию домино',
    'toolkit.kicker': 'Инструменты проекта',
    'toolkit.heading': 'Технологии и услуги, которые Юлия использует в проектах',
    'toolkit.marqueeAria': 'Технологии и услуги, которые Юлия использует в проектах',
    'toolkit.responsiveDesign': 'Адаптивная вёрстка',
    'toolkit.uiUx': 'UI/UX-дизайн',
    'toolkit.webAnimation': 'Веб-анимация',
    'toolkit.accessibility': 'Доступность',
    'toolkit.seoBasics': 'Основы SEO',
    'toolkit.performance': 'Производительность',
    'toolkit.landingPages': 'Лендинги',
    'toolkit.portfolioSites': 'Сайты-портфолио',
    'toolkit.bookingFlows': 'Сценарии бронирования',
    'toolkit.webConsulting': 'Веб-консалтинг',
    'projects.kicker': 'Цифровые проекты',
    'projects.title': 'Избранные работы',
    'projects.intro':
      'Веб-разработка с фокусом на UI/UX: выверенные интерфейсы, адаптивная вёрстка и понятные пользовательские сценарии для сервисных брендов.',
    'projects.servicesAria': 'Услуги по проекту',
    'project1.category': 'Сайт дизайнера интерьеров',
    'project1.desc':
      'Портфолио дизайнера интерьеров на русском языке: иммерсивная витрина проектов, отточенный сценарий услуг, прямой контакт и аккуратная визуальная подача.',
    'project1.view': 'Смотреть проект',
    'project1.tagUiUx': 'UI/UX',
    'project1.tagFrontend': 'Фронтенд',
    'project1.tagResponsive': 'Адаптивный сайт',
    'project1.tagBranding': 'Брендинг / подача',
    'project2.category': 'Платформа трансферов / путешествий',
    'project2.desc':
      'Сайт транспортных и шаттл-услуг в Сванетии: Местия, Ушгули и маршруты по Грузии с понятным бронированием и подачей услуг.',
    'project2.view': 'Смотреть проект',
    'project2.tagUiUx': 'UI/UX',
    'project2.tagFrontend': 'Фронтенд',
    'project2.tagResponsive': 'Адаптивный сайт',
    'project2.tagBooking': 'Сценарий бронирования',
    'gallery.heading': 'Галерея экранов телефона',
    'gallery.gridAria': 'Дополнительные скриншоты сайтов',
    'gallery.hse1Alt': 'Мобильный экран сайта проекта HSE',
    'gallery.hse2Alt': 'Мобильный экран сайта HSE с дополнительным контентом',
    'gallery.tzeh0Alt': 'Мобильный главный экран сайта Tzeh',
    'gallery.tzeh1Alt': 'Мобильный экран контента сайта Tzeh',
    'gallery.tzeh2Alt': 'Мобильный экран деталей сайта Tzeh',
    'gallery.laptopOlgaAria': 'Открыть сайт Ольги Богославской в новой вкладке',
    'gallery.laptopSvangoAria': 'Открыть сайт SvanGo в новой вкладке',
    'contact.kicker': 'Контакты',
    'contact.title': 'Сделаем проект аккуратным и сильным',
    'contact.copy':
      'Опишите идею сайта, UI/UX-бриф или вопрос по консалтингу. Юлия ответит с понятным следующим шагом и выверенным планом проекта.',
    'contact.methodsAria': 'Способы связи',
    'contact.methodsEyebrow': 'Быстрые способы связаться с Юлией',
    'contact.emailLabel': 'Email',
    'contact.sendMail': 'Написать',
    'contact.telegramLabel': 'Telegram',
    'contact.openChat': 'Открыть чат',
    'contact.whatsappLabel': 'WhatsApp',
    'contact.whatsappAria': 'Написать Юлии в WhatsApp',
    'contact.whatsappText': 'Быстрое сообщение с деталями проекта',
    'contact.message': 'Сообщение',
    'contact.note': 'Открыта для сайтов на фрилансе, UI/UX-дизайна и консалтинга.',
    'form.eyebrow': 'Запрос по проекту',
    'form.title': 'Расскажите, что вам нужно',
    'form.name': 'Имя',
    'form.namePlaceholder': 'Ваше имя',
    'form.email': 'Email',
    'form.emailPlaceholder': 'you@example.com',
    'form.projectType': 'Тип проекта',
    'form.optionWebsite': 'Сайт',
    'form.optionUiUx': 'UI/UX-дизайн',
    'form.optionConsulting': 'Консалтинг',
    'form.optionOther': 'Другое',
    'form.message': 'Сообщение',
    'form.messagePlaceholder': 'Несколько деталей о проекте, сроках и целях...',
    'form.submit': 'Написать Юлии',
    'form.errorName': 'Укажите, пожалуйста, имя.',
    'form.errorEmail': 'Укажите, пожалуйста, email.',
    'form.errorEmailInvalid': 'Введите корректный адрес email.',
    'form.errorMessage': 'Опишите, пожалуйста, что вы хотите сделать.',
    'form.statusFix': 'Исправьте выделенные поля перед отправкой.',
    'form.statusOpening': 'Открываем почтовое приложение с подготовленным сообщением.',
    'form.mailtoSubject': 'Запрос с портфолио: {type}',
    'form.mailtoName': 'Имя',
    'form.mailtoEmail': 'Email',
    'form.mailtoProjectType': 'Тип проекта',
    'form.mailtoMessage': 'Сообщение',
    'footer.heading': 'Юлия Журавлёва',
    'footer.tagline': 'Веб-разработчик · UI/UX',
    'footer.backToTop': 'Наверх',
    'footer.copyright': '© 2026 Юлия Журавлёва. Все права защищены.',
    'footer.navAria': 'Навигация в подвале',
  },
};

/**
 * @param {string} key
 * @param {string} [lang]
 * @param {Record<string, string>} [vars]
 */
export function t(key, lang = getLang(), vars = {}) {
  const dict = translations[lang] ?? translations[DEFAULT_LANG];
  let text = dict[key] ?? translations[DEFAULT_LANG][key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, value);
  });
  return text;
}

export function getLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.has(stored)) return stored;
  } catch {
    /* private mode */
  }
  return DEFAULT_LANG;
}

/**
 * @param {string} lang
 */
export function setLang(lang) {
  const next = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyLanguage(next);
  listeners.forEach((fn) => fn(next));
}

/**
 * @param {(lang: string) => void} fn
 */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {string} lang
 */
export function applyLanguage(lang) {
  const active = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  document.documentElement.lang = active;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', t('meta.description', active));

  document.title = t('meta.title', active);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key, active);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && 'placeholder' in el) el.placeholder = t(key, active);
  });

  const attrMap = [
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-aria', 'aria-label'],
    ['data-i18n-title', 'title'],
    ['data-i18n-alt', 'alt'],
  ];

  attrMap.forEach(([dataAttr, domAttr]) => {
    document.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
      const key = el.getAttribute(dataAttr);
      if (key) el.setAttribute(domAttr, t(key, active));
    });
  });

  document.querySelectorAll('[data-lang-set]').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const isActive = btn.dataset.langSet === active;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

export function initI18n() {
  const lang = getLang();
  applyLanguage(lang);

  document.querySelectorAll('[data-lang-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-lang-set');
      if (next && next !== getLang()) setLang(next);
    });
  });
}
