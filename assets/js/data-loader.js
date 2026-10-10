/**
 * פשוטלפון - מנהל טעינת נתונים
 * סלוגן: פשוט טלפון ורק טלפון
 * טוען נתונים באופן סטטי ישיר, עם תמיכה מלאה ב-GitHub Pages ובפרוטוקול file://
 */

const DataLoader = (() => {
  let cache = {
    phones: null,
    glossary: null
  };

  /**
   * טעינת רשימת המכשירים
   */
  async function loadPhones() {
    if (cache.phones) return cache.phones;

    // נסה לטעון מ-data/phones.json (פועל ברשת / GitHub Pages / שרת מקומי)
    try {
      const response = await fetch('data/phones.json', { cache: 'no-cache' });
      if (response.ok) {
        cache.phones = await response.json();
        return cache.phones;
      }
    } catch (err) {
      console.warn('הטעינה דרך fetch נכשלה (נורמלי בריצה ישירה מקובץ), עובר לנתונים המובנים:', err);
    }

    // גיבוי לטעינה ישירה (למשל פתיחה בלחיצה כפולה דרך file://)
    if (window.__PASHUTPHONE_DATA__ && window.__PASHUTPHONE_DATA__.phones) {
      cache.phones = window.__PASHUTPHONE_DATA__.phones;
      return cache.phones;
    }

    return [];
  }

  /**
   * טעינת מילון המושגים
   */
  async function loadGlossary() {
    if (cache.glossary) return cache.glossary;

    try {
      const response = await fetch('data/glossary.json', { cache: 'no-cache' });
      if (response.ok) {
        cache.glossary = await response.json();
        return cache.glossary;
      }
    } catch (err) {
      console.warn('הטעינה דרך fetch נכשלה (נורמלי בריצה ישירה מקובץ), עובר לנתונים המובנים:', err);
    }

    if (window.__PASHUTPHONE_DATA__ && window.__PASHUTPHONE_DATA__.glossary) {
      cache.glossary = window.__PASHUTPHONE_DATA__.glossary;
      return cache.glossary;
    }

    return [];
  }

  return {
    loadPhones,
    loadGlossary
  };
})();
