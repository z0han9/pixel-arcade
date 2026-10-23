(function () {
  const translations = {
    ru: {
      back: '← Меню',
      tagline: 'Выбери игру',
      pause: 'Пауза',
      resume: 'Дальше',
      settingsBtn: 'Настройки',
      settingsTitle: 'Настройки',
      soundLabel: 'Звук',
      languageLabel: 'Язык',
      closeSettings: '← Назад',
      scoreLabel: 'Очки',
      highScoreLabel: 'Рекорд',
      pauseTitle: 'Пауза',
      menuBtn: 'В меню',
      gameOverTitle: 'Игра окончена',
      finalScorePrefix: 'Очки: ',
      newHighScoreSuffix: ' — новый рекорд!',
      retryBtn: 'Заново',
      'game.snake': 'Змейка',
      'game.breakout': 'Кирпичи',
      'game.flappy': 'Птичка',
      'game.2048': '2048',
      breakoutLaunchHint: 'Пробел / тап — запуск',
      flappyLaunchHint: 'Пробел / тап — взлёт'
    },
    en: {
      back: '← Menu',
      tagline: 'Choose a game',
      pause: 'Pause',
      resume: 'Resume',
      settingsBtn: 'Settings',
      settingsTitle: 'Settings',
      soundLabel: 'Sound',
      languageLabel: 'Language',
      closeSettings: '← Back',
      scoreLabel: 'Score',
      highScoreLabel: 'High score',
      pauseTitle: 'Paused',
      menuBtn: 'Menu',
      gameOverTitle: 'Game Over',
      finalScorePrefix: 'Score: ',
      newHighScoreSuffix: ' — new high score!',
      retryBtn: 'Retry',
      'game.snake': 'Snake',
      'game.breakout': 'Bricks',
      'game.flappy': 'Pixel Bird',
      'game.2048': '2048',
      breakoutLaunchHint: 'Space / tap to launch',
      flappyLaunchHint: 'Space / tap to flap'
    }
  };

  let currentLang = window.ArcadeStorage.getLang();
  if (!translations[currentLang]) currentLang = 'ru';

  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.ru[key] || key;
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    window.ArcadeStorage.setLang(lang);
  }

  window.ArcadeI18n = { t, getLang, setLang, available: Object.keys(translations) };
})();
