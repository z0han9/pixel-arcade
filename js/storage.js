(function () {
  const HI_PREFIX = 'arcade:hi:';
  const SOUND_KEY = 'arcade:sound';
  const LANG_KEY = 'arcade:lang';

  function getHighScore(id) {
    const v = localStorage.getItem(HI_PREFIX + id);
    return v ? parseInt(v, 10) : 0;
  }

  function setHighScoreIfBetter(id, score) {
    if (score > getHighScore(id)) {
      localStorage.setItem(HI_PREFIX + id, String(score));
      return true;
    }
    return false;
  }

  function getSoundEnabled() {
    return localStorage.getItem(SOUND_KEY) === '1';
  }

  function setSoundEnabled(enabled) {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ru';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  window.ArcadeStorage = {
    getHighScore, setHighScoreIfBetter, getSoundEnabled, setSoundEnabled, getLang, setLang
  };
})();
