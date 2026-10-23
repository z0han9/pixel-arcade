(function () {
  const HI_PREFIX = 'arcade:hi:';
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

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ru';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  window.ArcadeStorage = {
    getHighScore, setHighScoreIfBetter, getLang, setLang
  };
})();
