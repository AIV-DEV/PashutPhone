/**
 * פשוטלפון - לוגיקת ממשק משתמש ואינטראקטיביות ראשית
 * סלוגן: פשוט טלפון ורק טלפון
 */

document.addEventListener('DOMContentLoaded', async () => {
  // מצב האפליקציה
  const state = {
    phones: [],
    glossary: [],
    expandedCardId: null, // בדיוק כרטיס אחד פתוח בכל רגע!
    filters: {
      search: '',
      phoneType: 'all',
      cleanLevel: 'all',
      touch: 'all'
    },
    quizAnswers: {
      mustPhoneType: 'any',
      mustCleanLevel: 'any',
      mustTouchScreen: 'any',
      mustMaxBudget: null,
      prefSimplicity: 'neutral',
      prefStrictClean: false,
      prefMusic: false,
      prefExtendedMessages: false,
      prefLongBattery: false
    }
  };

  // אלמנטים בדף
  const phonesGrid = document.getElementById('phones-grid');
  const catalogEmpty = document.getElementById('catalog-empty');
  const searchInput = document.getElementById('search-input');
  const filterPhoneType = document.getElementById('filter-phone-type');
  const filterCleanLevel = document.getElementById('filter-clean-level');
  const filterTouch = document.getElementById('filter-touch');
  const resultsCount = document.getElementById('results-count');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const activeChipsContainer = document.getElementById('active-chips-container');
  const glossaryGrid = document.getElementById('glossary-grid');

  const isRecommendedPage = document.body.getAttribute('data-page') === 'recommended';

  // טעינת נתונים
  try {
    const allPhones = await DataLoader.loadPhones();
    state.phones = isRecommendedPage 
      ? allPhones.filter(p => p.is_recommended === true)
      : allPhones;
    state.glossary = await DataLoader.loadGlossary();
  } catch (e) {
    console.error('שגיאה בטעינת נתונים:', e);
  }

  // אתחול הממשק
  renderGlossary();
  renderCatalog();
  initSearchAndFilters();
  initQuestionnaire();
  initNavigation();

  // טיפול בעוגן קיים ב-URL (למשל אם נפתח עם #clean-level)
  if (window.location.hash) {
    handleHashNavigation(window.location.hash);
  }
  window.addEventListener('hashchange', () => {
    handleHashNavigation(window.location.hash);
  });

  // =========================================================================
  // רינדור קטלוג המכשירים
  // =========================================================================

  function getFilteredPhones() {
    return state.phones.filter(phone => {
      // 1. חיפוש טקסטואלי חופשי
      if (state.filters.search.trim()) {
        const q = state.filters.search.toLowerCase().trim();
        const searchable = [
          phone.manufacturer || '',
          phone.model || '',
          phone.phone_type || '',
          phone.clean_level || '',
          phone.has_touch_screen ? 'מסך מגע מגע' : 'ללא מגע מקשים בלבד',
          ...(phone.features || [])
        ].join(' ').toLowerCase();

        if (!searchable.includes(q)) return false;
      }

      // 2. סינון סוג מכשיר
      if (state.filters.phoneType !== 'all') {
        if (phone.phone_type !== state.filters.phoneType) return false;
      }

      // 3. סינון רמת נקיות
      if (state.filters.cleanLevel !== 'all') {
        if (phone.clean_level !== state.filters.cleanLevel) return false;
      }

      // 4. סינון מסך מגע
      if (state.filters.touch !== 'all') {
        if (state.filters.touch === 'touch' && !phone.has_touch_screen) return false;
        if (state.filters.touch === 'no_touch' && phone.has_touch_screen) return false;
      }

      return true;
    });
  }

  function renderCatalog() {
    if (!phonesGrid) return;

    const filtered = getFilteredPhones();
    phonesGrid.innerHTML = '';

    // עדכון מונה תוצאות
    if (resultsCount) {
      resultsCount.textContent = `מציג ${filtered.length} מתוך ${state.phones.length} מכשירים`;
    }

    // תגיות מסננים פעילים
    renderActiveFilterChips();

    if (filtered.length === 0) {
      if (catalogEmpty) catalogEmpty.style.display = 'block';
      phonesGrid.style.display = 'none';
      return;
    }

    if (catalogEmpty) catalogEmpty.style.display = 'none';
    phonesGrid.style.display = 'grid';

    filtered.forEach(phone => {
      const isExpanded = state.expandedCardId === phone.id;
      const card = document.createElement('article');
      card.className = `phone-card ${isExpanded ? 'expanded' : ''}`;
      card.id = `phone-card-${phone.id}`;

      // תוכן הכרטיס
      card.innerHTML = isExpanded 
        ? renderExpandedCardHtml(phone) 
        : renderClosedCardHtml(phone);

      // אירועי לחיצה להרחבה / כיווץ
      attachCardEvents(card, phone);
      phonesGrid.appendChild(card);
    });
  }

  function formatDetailFieldValue(val, defaultText = 'לא ידוע') {
    if (!val || val === 'מידע חסר' || val === 'חסר') {
      return '<span class="badge badge-missing-info" title="פרט מידע זה חסר כרגע ויושלם בהמשך">מידע חסר</span>';
    }
    if (val === 'מידע שלא אומת') {
      return '<span class="badge badge-certainty unverified" title="מידע שלא אומת">מידע שלא אומת</span>';
    }
    return escapeHtml(val || defaultText);
  }

  function renderClosedCardHtml(phone) {
    const priceText = formatPrice(phone.price);
    const certaintyBadge = formatCertaintyBadge(phone.price ? phone.price.certainty : 'לא ידוע');
    const cleanBadge = formatCleanLevelBadge(phone.clean_level);
    const touchBadge = phone.has_touch_screen 
      ? '<span class="badge badge-touch">משולב מגע ומקשים</span>' 
      : '<span class="badge badge-keypad">מקשים בלבד</span>';
    const memoryBadge = phone.has_memory_card
      ? '<span class="badge badge-memory" title="תומך בכרטיס זיכרון">כרטיס זיכרון</span>'
      : '';

    const sampleNoticeText = phone.sample_notice || 'נתוני דוגמה לתבנית (אינו מוצר מאומת)';

    return `
      ${phone.is_sample ? `<div class="card-sample-tag">${escapeHtml(sampleNoticeText)}</div>` : ''}
      <div class="card-closed-view">
        <div class="card-image-wrapper">
          <img src="${phone.image || 'assets/images/phones/sample-dumb-phone.svg'}" alt="${phone.image_alt || phone.model}" loading="lazy">
        </div>
        <div class="card-header-info">
          <div class="card-manufacturer">${escapeHtml(phone.manufacturer || 'לא ידוע')}</div>
          <h3 class="card-model">${escapeHtml(phone.model || 'דגם לא צוין')}</h3>
        </div>
        <div class="card-meta-row">
          <span class="badge badge-type">${escapeHtml(phone.phone_type || 'לא ידוע')}</span>
          ${cleanBadge}
          ${touchBadge}
          ${memoryBadge}
          ${certaintyBadge}
        </div>
        <div class="card-price-row">
          <span class="price-label">טווח מחירים:</span>
          <span class="price-value">${priceText}</span>
        </div>
        <button type="button" class="card-expand-btn" aria-expanded="false" data-action="expand">
          <span>פרטים נוספים ומפרט</span>
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    `;
  }

  function renderExpandedCardHtml(phone) {
    const glossaryPrefix = isRecommendedPage ? 'index.html' : '';
    const priceText = formatPrice(phone.price);
    const certaintyBadge = formatCertaintyBadge(phone.price ? phone.price.certainty : 'לא ידוע');
    const checkedDate = phone.price && phone.price.checked_date ? `תאריך בדיקה: ${phone.price.checked_date}` : '';
    const priceSource = phone.price && phone.price.source ? `מקור: ${escapeHtml(phone.price.source)}` : '';
    const cleanBadge = formatCleanLevelBadge(phone.clean_level);

    const touchText = phone.has_touch_screen 
      ? 'משולב: מקלדת מקשים פיזית + מסך מגע' 
      : 'מקלדת מקשים פיזית בלבד (ללא מסך מגע)';

    const featuresHtml = (phone.features && phone.features.length > 0)
      ? phone.features.map(f => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')
      : '<span class="detail-field-sub">לא צוינו תכונות נוספות</span>';

    let purchaseLinksArray = [];
    if (Array.isArray(phone.purchase_links)) {
      purchaseLinksArray = phone.purchase_links;
    } else if (typeof phone.purchase_links === 'string' && phone.purchase_links.trim()) {
      purchaseLinksArray = [phone.purchase_links.trim()];
    }

    const purchaseLinksHtml = (purchaseLinksArray.length > 0)
      ? purchaseLinksArray.map(l => {
          const url = (typeof l === 'string') ? l : (l.url || '#');
          const title = (typeof l === 'string') ? 'האתר הרשמי / לרכישה' : (l.title || 'קישור לרכישה');
          return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">${escapeHtml(title)}</a>`;
        }).join(' ')
      : '<p class="detail-field-sub">אין קישורי רכישה מאומתים כרגע. האתר אינו מוכר מכשירים בעצמו.</p>';

    const sampleNoticeText = phone.sample_notice || 'נתוני דוגמה לתבנית (אינו מוצר מאומת)';

    return `
      ${phone.is_sample ? `<div class="card-sample-tag">${escapeHtml(sampleNoticeText)}</div>` : ''}
      <div class="card-expanded-view">
        <div class="expanded-left-col">
          <div class="expanded-image-box">
            <img src="${phone.image || 'assets/images/phones/sample-dumb-phone.svg'}" alt="${phone.image_alt || phone.model}">
          </div>
          <button type="button" class="expanded-collapse-btn" data-action="collapse">
            <span>▲ סגור פרטי מכשיר</span>
          </button>
        </div>

        <div class="expanded-right-col">
          <div class="card-header-info">
            <div class="card-manufacturer">${escapeHtml(phone.manufacturer || 'לא ידוע')}</div>
            <h3 class="card-model" style="font-size: 1.6rem; margin-bottom: 0.5rem;">${escapeHtml(phone.model || '')}</h3>
          </div>

          <div class="expanded-fields-grid">
            <!-- 1. סוג המכשיר -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>סוג המכשיר</span>
                <a href="${glossaryPrefix}#phone-type" class="help-icon-link" title="הסבר במדריך על סוג המכשיר" aria-label="הסבר על סוג המכשיר">?</a>
              </div>
              <div class="detail-field-value">${escapeHtml(phone.phone_type || 'לא ידוע')}</div>
            </div>

            <!-- 2. רמת נקיות -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>רמת נקיות</span>
                <a href="${glossaryPrefix}#clean-level" class="help-icon-link" title="הסבר במדריך על רמת נקיות" aria-label="הסבר על רמת נקיות">?</a>
              </div>
              <div class="detail-field-value" style="display: flex; align-items: center; gap: 0.5rem;">
                ${cleanBadge}
              </div>
              ${phone.clean_level_details ? `<div class="detail-field-sub" style="margin-top: 0.5rem; line-height: 1.4; color: #334155;">${escapeHtml(phone.clean_level_details)}</div>` : ''}
            </div>

            <!-- 3. מסך ומקשים -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>תצוגה ומקלדת</span>
              </div>
              <div class="detail-field-value" style="font-size: 0.95rem;">${touchText}</div>
            </div>

            <!-- כרטיס זיכרון -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>כרטיס זיכרון</span>
              </div>
              <div class="detail-field-value">${phone.memory_card ? formatDetailFieldValue(phone.memory_card) : (phone.has_memory_card ? 'נתמך' : 'ללא חריץ לכרטיס זיכרון')}</div>
            </div>

            <!-- 4. מערכת הפעלה -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>מערכת הפעלה</span>
                <a href="${glossaryPrefix}#operating-system" class="help-icon-link" title="הסבר במדריך על מערכת הפעלה" aria-label="הסבר על מערכת הפעלה">?</a>
              </div>
              <div class="detail-field-value">${formatDetailFieldValue(phone.operating_system)}</div>
            </div>

            <!-- 5. אחסון הודעות -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>אחסון הודעות</span>
                <a href="${glossaryPrefix}#message-storage" class="help-icon-link" title="הסבר במדריך על אחסון הודעות" aria-label="הסבר על אחסון הודעות">?</a>
              </div>
              <div class="detail-field-value">${formatDetailFieldValue(phone.message_storage)}</div>
            </div>

            <!-- 6. טווח מחירים בשוק -->
            <div class="detail-field">
              <div class="detail-field-title">
                <span>טווח מחירים בשוק</span>
                ${certaintyBadge}
              </div>
              <div class="detail-field-value">${priceText}</div>
              ${(priceSource || checkedDate) ? `<div class="detail-field-sub">${priceSource} ${checkedDate ? `| ${checkedDate}` : ''}</div>` : ''}
            </div>
          </div>

          <!-- פיצ'רים ותכונות נוספות -->
          <div class="detail-field" style="margin-bottom: 1.5rem;">
            <div class="detail-field-title">
              <span>פיצ'רים ותכונות נוספות</span>
            </div>
            <div class="features-tags-list">
              ${featuresHtml}
            </div>
          </div>

          <!-- תיאור והערות מ-Markdown -->
          <div class="expanded-description-section">
            <h3>אודות הדגם</h3>
            <div>${formatMarkdownToHtml(phone.description || 'לא נוסף תיאור מילולי.')}</div>
          </div>

          <!-- דרכי רכישה -->
          <div class="purchase-links-block">
            <div class="purchase-links-title">אפשרויות רכישה וקישורים:</div>
            ${purchaseLinksHtml}
          </div>
        </div>
      </div>
    `;
  }

  function attachCardEvents(cardElement, phone) {
    const expandBtn = cardElement.querySelector('[data-action="expand"]');
    const collapseBtn = cardElement.querySelector('[data-action="collapse"]');

    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // דרישת יסוד: בדיוק כרטיס אחד פתוח בכל רגע!
        state.expandedCardId = phone.id;
        renderCatalog();

        // גלילה עדינה אל הכרטיס שנפתח
        setTimeout(() => {
          const el = document.getElementById(`phone-card-${phone.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      });
    }

    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.expandedCardId = null;
        renderCatalog();
      });
    }

    // תמיכה בקישורי עזרה מתוך הכרטיס
    const helpLinks = cardElement.querySelectorAll('.help-icon-link');
    helpLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const hash = link.getAttribute('href');
        if (hash) {
          handleHashNavigation(hash);
        }
      });
    });
  }

  // =========================================================================
  // חיפוש ומסננים (פשוט ונוח, ללא מערכת הפעלה)
  // =========================================================================

  function initSearchAndFilters() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        renderCatalog();
      });
    }

    if (filterPhoneType) {
      filterPhoneType.addEventListener('change', (e) => {
        state.filters.phoneType = e.target.value;
        renderCatalog();
      });
    }

    if (filterCleanLevel) {
      filterCleanLevel.addEventListener('change', (e) => {
        state.filters.cleanLevel = e.target.value;
        renderCatalog();
      });
    }

    if (filterTouch) {
      filterTouch.addEventListener('change', (e) => {
        state.filters.touch = e.target.value;
        renderCatalog();
      });
    }

    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', resetAllFilters);
    }

    const emptyResetBtn = document.getElementById('btn-empty-reset');
    if (emptyResetBtn) {
      emptyResetBtn.addEventListener('click', resetAllFilters);
    }
  }

  function resetAllFilters() {
    state.filters.search = '';
    state.filters.phoneType = 'all';
    state.filters.cleanLevel = 'all';
    state.filters.touch = 'all';

    if (searchInput) searchInput.value = '';
    if (filterPhoneType) filterPhoneType.value = 'all';
    if (filterCleanLevel) filterCleanLevel.value = 'all';
    if (filterTouch) filterTouch.value = 'all';

    renderCatalog();
  }

  function renderActiveFilterChips() {
    if (!activeChipsContainer) return;
    activeChipsContainer.innerHTML = '';

    const chips = [];

    if (state.filters.search.trim()) {
      chips.push({
        label: `חיפוש: "${state.filters.search.trim()}"`,
        onRemove: () => {
          state.filters.search = '';
          if (searchInput) searchInput.value = '';
          renderCatalog();
        }
      });
    }

    if (state.filters.phoneType !== 'all') {
      chips.push({
        label: `סוג: ${state.filters.phoneType}`,
        onRemove: () => {
          state.filters.phoneType = 'all';
          if (filterPhoneType) filterPhoneType.value = 'all';
          renderCatalog();
        }
      });
    }

    if (state.filters.cleanLevel !== 'all') {
      chips.push({
        label: `נקיות: ${state.filters.cleanLevel}`,
        onRemove: () => {
          state.filters.cleanLevel = 'all';
          if (filterCleanLevel) filterCleanLevel.value = 'all';
          renderCatalog();
        }
      });
    }

    if (state.filters.touch !== 'all') {
      chips.push({
        label: state.filters.touch === 'touch' ? 'משולב מגע' : 'מקשים בלבד',
        onRemove: () => {
          state.filters.touch = 'all';
          if (filterTouch) filterTouch.value = 'all';
          renderCatalog();
        }
      });
    }

    chips.forEach(chip => {
      const chipEl = document.createElement('span');
      chipEl.className = 'filter-chip';
      chipEl.innerHTML = `
        <span>${escapeHtml(chip.label)}</span>
        <button type="button" class="filter-chip-remove" title="הסר מסנן">✕</button>
      `;
      chipEl.querySelector('button').addEventListener('click', chip.onRemove);
      activeChipsContainer.appendChild(chipEl);
    });
  }

  // =========================================================================
  // מדריך מושגים טכניים (Glossary - בדיוק 4 מושגים בשורה אחת)
  // =========================================================================

  function renderGlossary() {
    if (!glossaryGrid || !state.glossary) return;

    glossaryGrid.innerHTML = '';
    state.glossary.forEach(item => {
      const card = document.createElement('div');
      card.className = 'glossary-card';
      card.id = item.id; // עוגן יציב

      card.innerHTML = `
        <div class="glossary-term-header">
          <h3 class="glossary-term-title">${escapeHtml(item.term)}</h3>
          <span class="glossary-term-category">${escapeHtml(item.category || 'מושג טכני')}</span>
        </div>
        <div class="glossary-content">
          ${formatMarkdownToHtml(item.content)}
        </div>
      `;
      glossaryGrid.appendChild(card);
    });
  }

  function handleHashNavigation(hash) {
    if (!hash) return;
    const targetId = hash.replace('#', '');
    const element = document.getElementById(targetId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // הדגשה חזותית מוארת למושג שנבחר
      element.classList.remove('highlight-pulse');
      void element.offsetWidth; // Force reflow
      element.classList.add('highlight-pulse');
      setTimeout(() => {
        element.classList.remove('highlight-pulse');
      }, 3500);
    }
  }

  // =========================================================================
  // שאלון התאמה (Questionnaire)
  // =========================================================================

  function initQuestionnaire() {
    const quizForm = document.getElementById('quiz-form');
    const quizResultsBox = document.getElementById('quiz-results');
    const btnRunQuiz = document.getElementById('btn-run-quiz');
    const btnResetQuiz = document.getElementById('btn-reset-quiz');

    if (!quizForm || !btnRunQuiz) return;

    btnRunQuiz.addEventListener('click', () => {
      // 1. קריאת תשובות תנאי חובה
      const typeRadio = document.querySelector('input[name="must_phone_type"]:checked');
      state.quizAnswers.mustPhoneType = typeRadio ? typeRadio.value : 'any';

      const cleanRadio = document.querySelector('input[name="must_clean_level"]:checked');
      state.quizAnswers.mustCleanLevel = cleanRadio ? cleanRadio.value : 'any';

      const touchRadio = document.querySelector('input[name="must_touch"]:checked');
      state.quizAnswers.mustTouchScreen = touchRadio ? touchRadio.value : 'any';

      const callsOnlyRadio = document.querySelector('input[name="must_calls_only"]:checked');
      state.quizAnswers.mustCallsOnly = callsOnlyRadio ? (callsOnlyRadio.value === 'strict') : false;

      const budgetSelect = document.getElementById('must_budget_select');
      const budgetVal = budgetSelect ? budgetSelect.value : 'none';
      state.quizAnswers.mustMaxBudget = (budgetVal !== 'none') ? parseInt(budgetVal, 10) : null;

      // 2. קריאת תשובות העדפות
      const simplicityRadio = document.querySelector('input[name="pref_simplicity"]:checked');
      state.quizAnswers.prefSimplicity = simplicityRadio ? simplicityRadio.value : 'neutral';

      const strictCleanCheck = document.getElementById('pref_strict_clean_check');
      state.quizAnswers.prefStrictClean = strictCleanCheck ? strictCleanCheck.checked : false;

      const musicCheck = document.getElementById('pref_music_check');
      state.quizAnswers.prefMusic = musicCheck ? musicCheck.checked : false;

      const cameraCheck = document.getElementById('pref_camera_check');
      state.quizAnswers.prefCamera = cameraCheck ? cameraCheck.checked : false;

      const memoryCheck = document.getElementById('pref_memory_card_check');
      state.quizAnswers.prefMemoryCard = memoryCheck ? memoryCheck.checked : false;

      const batteryCheck = document.getElementById('pref_battery_check');
      state.quizAnswers.prefLongBattery = batteryCheck ? batteryCheck.checked : false;

      const msgCheck = document.getElementById('pref_storage_check');
      state.quizAnswers.prefExtendedMessages = msgCheck ? msgCheck.checked : false;

      // הפעלת מנוע השאלון
      const results = QuestionnaireEngine.evaluate(state.phones, state.quizAnswers);
      renderQuizResults(results, quizResultsBox);

      // גלילה לתוצאות
      if (quizResultsBox) {
        quizResultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    if (btnResetQuiz) {
      btnResetQuiz.addEventListener('click', () => {
        quizForm.reset();
        if (quizResultsBox) quizResultsBox.innerHTML = '';
      });
    }
  }

  function renderQuizResults(results, container) {
    if (!container) return;
    container.innerHTML = '';

    // מקרה 1: אין מכשירים במאגר כלל
    if (results.emptyCatalog) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-title">הקטלוג ריק כרגע</div>
          <p class="empty-state-desc">טרם הוזנו מכשירים למאגר כדי לבצע שאלון התאמה.</p>
        </div>
      `;
      return;
    }

    // מקרה 2: תנאי חובה נכשלו (אף מכשיר לא עמד בתנאי החובה!) - ניתוח מרוכז של תנאים וסתירות
    if (results.diagnostics) {
      const diag = results.diagnostics;

      let contradictionsHtml = '';
      if (diag.contradictions && diag.contradictions.length > 0) {
        const items = diag.contradictions.map(c => `
          <div class="diagnostic-contradiction-item">
            <div class="diagnostic-contradiction-title">⚡ ${escapeHtml(c.title)}</div>
            <p class="diagnostic-contradiction-desc">${escapeHtml(c.desc)}</p>
          </div>
        `).join('');

        contradictionsHtml = `
          <div class="diagnostic-section diagnostic-contradictions-box">
            <h4 class="diagnostic-section-title">זוהו דרישות סותרות:</h4>
            ${items}
          </div>
        `;
      }

      let failedConditionsHtml = '';
      if (diag.failedConditionsList && diag.failedConditionsList.length > 0) {
        const items = diag.failedConditionsList.map(cond => `
          <div class="diagnostic-condition-row">
            <div class="condition-name">
              <strong>${escapeHtml(cond.title)}</strong>
              <span class="condition-reason">${escapeHtml(cond.reason)}</span>
            </div>
            <div class="condition-badge-stat">הכשיל ${cond.count} מתוך ${diag.totalPhones} דגמים</div>
          </div>
        `).join('');

        failedConditionsHtml = `
          <div class="diagnostic-section">
            <h4 class="diagnostic-section-title">ניתוח התנאים שהכשילו את מכשירי המאגר:</h4>
            <div class="diagnostic-conditions-list">
              ${items}
            </div>
          </div>
        `;
      }

      let recommendationsHtml = '';
      if (diag.recommendations && diag.recommendations.length > 0) {
        const items = diag.recommendations.map(r => `<li>💡 ${escapeHtml(r)}</li>`).join('');
        recommendationsHtml = `
          <div class="diagnostic-section diagnostic-recommendations-box">
            <h4 class="diagnostic-section-title">המלצות למציאת התאמה:</h4>
            <ul class="diagnostic-recommendations-list">
              ${items}
            </ul>
          </div>
        `;
      }

      container.innerHTML = `
        <div class="must-have-failed-box">
          <div class="must-have-failed-title">
            <span aria-hidden="true">⚠️</span>
            <span>לא נמצאו מכשירים העונים על שילוב תנאי החובה שהוגדרו</span>
          </div>
          <p class="must-have-failed-text">
            כל ${diag.totalPhones} המכשירים במאגר נפסלו משום שלא התאימו לצירוף התנאים המחמירים שהוגדרו בשאלון.
            להלן ניתוח הדרישות שהכשילו את הדגמים והמלצות קונקרטיות לפתרון:
          </p>
          
          ${contradictionsHtml}
          ${failedConditionsHtml}
          ${recommendationsHtml}

          <div style="margin-top: 1.5rem; text-align: center;">
            <a href="#quiz-form" class="btn btn-primary" style="display: inline-block;">התאם מחדש את תנאי החובה בשאלון</a>
          </div>
        </div>
      `;
      return;
    }

    // מקרה 3: נמצאו תוצאות מתאימות שעברו את תנאי החובה
    const count = results.qualified.length;
    let cardsHtml = '';

    results.qualified.forEach(item => {
      const p = item.phone;
      const reasonsList = item.matchReasons.map(r => `<li>✓ ${escapeHtml(r)}</li>`).join('');

      cardsHtml += `
        <div class="result-card">
          <div class="result-card-img">
            <img src="${p.image || 'assets/images/phones/sample-dumb-phone.svg'}" alt="${p.model}">
          </div>
          <div class="result-card-info">
            <div class="result-explanation-badge">התאמה של ${item.score}% לפי העדפותיך</div>
            <h3 style="font-size: 1.35rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHtml(p.manufacturer)} ${escapeHtml(p.model)}</h3>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span>סוג: ${escapeHtml(p.phone_type)}</span> | 
              <span>רמת נקיות: ${escapeHtml(p.clean_level)}</span> |
              <span>מחיר: ${formatPrice(p.price)}</span>
            </div>
            
            <div style="font-weight: 600; font-size: 0.9rem; color: #0f172a; margin-top: 0.5rem;">מדוע המכשיר מתאים לך?</div>
            <ul class="result-reasons-list">
              ${reasonsList}
            </ul>

            <div style="margin-top: 1rem;">
              <button type="button" class="btn btn-sm btn-primary" onclick="window.__openPhoneInCatalog('${p.id}')">
                הצג מפרט מלא בקטלוג
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="quiz-results-box">
        <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 0.5rem;">
          נמצאו ${count} מכשירים שעמדו בכל תנאי החובה:
        </h3>
        <p style="font-size: 0.95rem; color: #64748b; margin-bottom: 1.5rem;">
          המכשירים מדורגים לפי מידת ההתאמה להעדפות שציינת:
        </p>
        ${cardsHtml}
      </div>
    `;
  }

  // חשיפת פונקציית מעבר ישיר לכרטיס בקטלוג
  window.__openPhoneInCatalog = (phoneId) => {
    state.expandedCardId = phoneId;
    renderCatalog();
    const catalogSection = document.getElementById('catalog');
    if (catalogSection) {
      catalogSection.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
      const el = document.getElementById(`phone-card-${phoneId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // =========================================================================
  // ניווט חלק ותפריטים
  // =========================================================================

  function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(section => {
        const top = section.offsetTop - 120;
        if (window.pageYOffset >= top) {
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    });
  }

  // =========================================================================
  // פונקציות עזר ופורמט
  // =========================================================================

  function formatPrice(priceObj) {
    if (!priceObj || typeof priceObj !== 'object') return 'לא ידוע';
    const { min, max, currency = '₪' } = priceObj;

    if (typeof min === 'number' && typeof max === 'number') {
      if (min === max) return `${min} ${currency}`;
      return `${min} - ${max} ${currency}`;
    }
    if (typeof min === 'number') return `החל מ-${min} ${currency}`;
    return 'לא ידוע';
  }

  function formatCertaintyBadge(certainty) {
    if (!certainty || certainty === 'לא ידוע') {
      return '<span class="badge badge-certainty unknown">ודאות: לא ידוע</span>';
    }
    if (certainty === 'מדווח') {
      return '<span class="badge badge-certainty verified">מחיר מדווח</span>';
    }
    if (certainty === 'טווח משוער') {
      return '<span class="badge badge-certainty estimated">טווח משוער</span>';
    }
    if (certainty === 'מידע שלא אומת') {
      return '<span class="badge badge-certainty unverified">מידע שלא אומת</span>';
    }
    return `<span class="badge badge-certainty">${escapeHtml(certainty)}</span>`;
  }

  function formatCleanLevelBadge(cleanLevel) {
    if (!cleanLevel) return '';
    if (cleanLevel === 'נקי לחלוטין') {
      return '<span class="badge badge-clean-strict" title="נמכר רק עם הפונקציות שבאתר">נקי לחלוטין</span>';
    }
    if (cleanLevel === 'נקי') {
      return '<span class="badge badge-clean-standard" title="קיים גם בגרסאות פתוחות יותר">נקי</span>';
    }
    if (cleanLevel === 'מנוקה') {
      return '<span class="badge badge-clean-cleansed" title="קיים גם פתוח לחלוטין כמו סמארטפון רגיל">מנוקה</span>';
    }
    return `<span class="badge">${escapeHtml(cleanLevel)}</span>`;
  }

  function formatMarkdownToHtml(markdownText) {
    if (!markdownText) return '';
    
    let html = escapeHtml(markdownText);

    // כותרות
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    // טקסט מודגש
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // פריטים ממוספרים (1. ... 2. ... 3. ...) - כל מספר בשורה נפרדת לחלוטין
    html = html.replace(/(?:^|\n)\s*(\d+)\.\s+(.*$)/gim, '\n<div class="glossary-numbered-item"><strong class="num-prefix">$1.</strong> $2</div>\n');

    // פריטי רשימה רגילה עם מקף
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)+/gis, '<ul>$&</ul>');

    // ירידות שורה ורווחים
    html = html.replace(/\n\n+/g, '<br><br>');
    html = html.replace(/(?<!<\/div>|<br>)\n/g, '<br>');

    return html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
