/**
 * פשוטלפון - מנוע שאלון התאמה
 * סלוגן: פשוט טלפון ורק טלפון
 * 
 * עקרונות המנוע:
 * 1. סינון ראשוני וקפדני לפי 'תנאי חובה' (Must-haves).
 *    - אם משתמש מחייב 'שיחות והודעות בלבד' - כל מכשיר עם נגן מוזיקה או מצלמה נפסל לחלוטין!
 * 2. אם מכשיר לא עומד באחד מתנאי החובה - הוא נפסל מיידית ולא יוצג כהתאמה.
 * 3. דירוג המכשירים שעברו את תנאי החובה לפי 'העדפות' (Preferences).
 *    - אפשרות העדפה למוזיקה, העדפה למצלמה, סוללה ועוד.
 * 4. מתן הסבר שקוף לכל תוצאה: מדוע המכשיר מתאים ואילו תנאים הוא מילא.
 */

const QuestionnaireEngine = (() => {
  /**
   * הרצת הערכת התאמה
   * @param {Array} phones - רשימת המכשירים בקטלוג
   * @param {Object} answers - תשובות המשתמש לשאלון
   * @returns {Object} { qualified: Array, failedMustHaves: Object|null }
   */
  function evaluate(phones, answers) {
    if (!phones || phones.length === 0) {
      return { qualified: [], failedMustHaves: null, emptyCatalog: true };
    }

    const {
      mustPhoneType = 'any',
      mustCleanLevel = 'any',
      mustTouchScreen = 'any',
      mustCallsOnly = false,
      mustMaxBudget = null,
      prefSimplicity = 'neutral',
      prefStrictClean = false,
      prefMusic = false,
      prefCamera = false,
      prefMemoryCard = false,
      prefExtendedMessages = false,
      prefLongBattery = false
    } = answers;

    const conditionFailures = {
      budget: { count: 0, title: 'מגבלת תקציב מרבי', reason: `המחיר עולה על התקציב המרבי (עד ₪${mustMaxBudget})` },
      callsOnly: { count: 0, title: 'חובת שיחות ו-SMS בלבד ללא מולטימדיה', reason: 'המכשיר כולל נגן שמע, רדיו, מצלמה או הרחבת זיכרון' },
      cleanLevel: { count: 0, title: 'דרישת רמת נקיות', reason: mustCleanLevel === 'strictly_clean' ? 'המכשיר אינו "נקי לחלוטין" (קיימת גרסה פתוחה)' : 'המכשיר ברמת "מנוקה"' },
      touchScreen: { count: 0, title: 'דרישת מסך ומקשים', reason: mustTouchScreen === 'with_touch' ? 'המכשיר ללא מסך מגע (מקשים בלבד)' : 'המכשיר משלב מסך מגע' },
      phoneType: { count: 0, title: 'סוג המכשיר המבוקש', reason: `המכשיר אינו שייך לקטגוריה שנבחרה` }
    };

    const qualifiedDevices = [];

    for (const phone of phones) {
      let isDisqualified = false;
      const phoneFeatures = phone.features || [];

      // 1. בדיקת תנאי חובה: סוג מכשיר
      if (mustPhoneType === 'dumb_only' && phone.phone_type !== 'טלפון טיפש') {
        isDisqualified = true;
        conditionFailures.phoneType.count++;
      } else if (mustPhoneType === 'feature_only' && phone.phone_type !== 'פיצ\'ר פון') {
        isDisqualified = true;
        conditionFailures.phoneType.count++;
      } else if (mustPhoneType === 'smart_only' && phone.phone_type !== 'סמארטפון מצומצם') {
        isDisqualified = true;
        conditionFailures.phoneType.count++;
      }

      // 2. בדיקת תנאי חובה: חובה לשיחות והודעות בלבד (פסילת כל מולטימדיה / נגן / מצלמה / כרטיס זיכרון)
      if (mustCallsOnly) {
        const hasMusic = phoneFeatures.some(f => 
          (f.includes('נגן') || f.includes('מוזיקה') || f.includes('שמע')) && !f.includes('ללא נגן')
        );
        const hasCamera = phoneFeatures.some(f => 
          f.includes('מצלמה') && !f.includes('ללא מצלמה')
        );
        const hasMemoryCard = phone.has_memory_card === true;

        if (hasMusic || hasCamera || hasMemoryCard) {
          isDisqualified = true;
          conditionFailures.callsOnly.count++;
        }
      }

      // 3. בדיקת תנאי חובה: רמת נקיות
      if (mustCleanLevel === 'strictly_clean') {
        if (phone.clean_level !== 'נקי לחלוטין') {
          isDisqualified = true;
          conditionFailures.cleanLevel.count++;
        }
      } else if (mustCleanLevel === 'no_cleansed') {
        if (phone.clean_level === 'מנוקה') {
          isDisqualified = true;
          conditionFailures.cleanLevel.count++;
        }
      }

      // 4. בדיקת תנאי חובה: מסך מגע
      if (mustTouchScreen === 'no_touch') {
        if (phone.has_touch_screen === true) {
          isDisqualified = true;
          conditionFailures.touchScreen.count++;
        }
      } else if (mustTouchScreen === 'with_touch') {
        if (phone.has_touch_screen !== true) {
          isDisqualified = true;
          conditionFailures.touchScreen.count++;
        }
      }

      // 5. בדיקת תנאי חובה: תקציב מקסימלי
      if (mustMaxBudget !== null && mustMaxBudget > 0) {
        if (phone.price && typeof phone.price.min === 'number') {
          if (phone.price.min > mustMaxBudget) {
            isDisqualified = true;
            conditionFailures.budget.count++;
          }
        }
      }

      if (isDisqualified) {
        continue;
      }

      // -------------------------------------------------------------
      // דירוג לפי העדפות (Preferences) למכשירים שעברו את תנאי החובה
      // -------------------------------------------------------------
      let score = 50; // ציון בסיס למכשיר שעבר את כל תנאי החובה
      const matchReasons = ['עומד בכל תנאי החובה שהגדרת'];

      // העדפת רמת נקיות (עדיפות ל"נקי לחלוטין")
      if (prefStrictClean) {
        if (phone.clean_level === 'נקי לחלוטין') {
          score += 25;
          matchReasons.push('רמת נקיות: נקי לחלוטין (ללא אפשרות לגרסאות פתוחות)');
        } else if (phone.clean_level === 'נקי') {
          score += 10;
        }
      }

      // העדפת פשטות וסגנון שימוש
      if (prefSimplicity === 'minimal') {
        if (phone.phone_type === 'טלפון טיפש') {
          score += 25;
          matchReasons.push('טלפון טיפש ללא דפדפן וללא אפליקציות אינטרנט כלל');
        } else if (phone.phone_type === 'פיצ\'ר פון') {
          score += 10;
        }
      } else if (prefSimplicity === 'tools') {
        if (phone.phone_type === 'טלפון טיפש') {
          score += 20;
          matchReasons.push('משלב פונקציות מקומיות (שמע/רדיו/פנס) עם חסימה מוחלטת מאינטרנט');
        } else if (phone.phone_type === 'פיצ\'ר פון') {
          score += 20;
          matchReasons.push('מספק תכונות מולטימדיה לצד ממשק מקשים');
        } else if (phone.phone_type === 'סמארטפון מצומצם') {
          score += 20;
          matchReasons.push('כולל אפשרות לכלים פרקטיים כגון ניווט ויומן');
        }
      }

      // העדפת שמע ומוזיקה
      if (prefMusic) {
        const hasAudio = phoneFeatures.some(f => 
          (f.includes('רדיו') || f.includes('שמע') || f.includes('נגן') || f.includes('מוזיקה')) && !f.includes('ללא נגן')
        );
        if (hasAudio) {
          score += 15;
          matchReasons.push('תומך בנגן מוזיקה או רדיו FM');
        }
      }

      // העדפת מצלמה (לא בחובה)
      if (prefCamera) {
        const hasCamera = phoneFeatures.some(f => 
          f.includes('מצלמה') && !f.includes('ללא מצלמה')
        );
        if (hasCamera) {
          score += 15;
          matchReasons.push('כולל מצלמה לצילום תמונות בסיסי');
        }
      }

      // העדפת כרטיס זיכרון
      if (prefMemoryCard) {
        if (phone.has_memory_card) {
          score += 15;
          matchReasons.push('תומך בהרחבת זיכרון (כרטיס זיכרון MicroSD)');
        }
      }

      // העדפת סוללה
      if (prefLongBattery) {
        const hasBattery = phoneFeatures.some(f => f.includes('סוללה') || f.includes('סוללה ארוכת טווח'));
        if (hasBattery || phone.phone_type === 'טלפון טיפש') {
          score += 15;
          matchReasons.push('מצטיין בחיי סוללה ממושכים וצריכת אנרגיה נמוכה');
        }
      }

      // העדפת אחסון הודעות
      if (prefExtendedMessages) {
        if (phone.message_storage && (phone.message_storage.includes('מורחב') || phone.message_storage.includes('ללא הגבלה'))) {
          score += 15;
          matchReasons.push('נפח אחסון הודעות מורחב המתאים לקבלת הודעות רבות');
        }
      }

      // נרמול ציון (עד 100%)
      const matchPercentage = Math.min(100, Math.round(score));

      qualifiedDevices.push({
        phone,
        score: matchPercentage,
        matchReasons
      });
    }

    // מיון התוצאות מהציון הגבוה לנמוך
    qualifiedDevices.sort((a, b) => b.score - a.score);

    // ניתוח אבחון סתירות ותנאים שהכשילו במקרה שאין התאמות
    let diagnostics = null;
    if (qualifiedDevices.length === 0) {
      const contradictions = [];
      const recommendations = [];

      // זיהוי סתירות מובהקות
      if (mustCallsOnly && (mustPhoneType === 'feature_only' || mustPhoneType === 'smart_only')) {
        contradictions.push({
          title: 'סתירה בין חובת שיחות ו-SMS בלבד לסוג המכשיר שנבחר',
          desc: 'הוגדרה חובת "שיחות ו-SMS בלבד" (הפוסלת כל מולטימדיה או יישומים), אך נבחר סוג מכשיר של פיצ\'ר פון או סמארטפון מצומצם. מכשירים מקטגוריות אלו כוללים מעצם טבעם נגני מדיה, מצלמה או אפליקציות, ולכן לא קיים מכשיר כזה.'
        });
        recommendations.push('אם הינך מעוניין בשיחות ו-SMS בלבד, בחר בסוג מכשיר "טלפון טיפש" או "הצג הכל".');
      }

      if (mustCallsOnly && mustTouchScreen === 'with_touch') {
        contradictions.push({
          title: 'סתירה בין חובת שיחות בלבד לדרישת מסך מגע',
          desc: 'מכשירי מקשים המשלבים מסך מגע מבוססים על מערכות הפעלה חכמות וכוללים מולטימדיה, ולכן אין בנמצא מכשיר משולב מגע שהוא לשיחות והודעות בלבד.'
        });
        recommendations.push('לשיחות ו-SMS בלבד ללא מולטימדיה, סמן "ללא מסך מגע (מקשים בלבד)".');
      }

      if (mustPhoneType === 'dumb_only' && mustTouchScreen === 'with_touch') {
        contradictions.push({
          title: 'סתירה בין טלפון טיפש לדרישת מסך מגע',
          desc: 'טלפונים טיפשים מגיעים במבנה מקשים קלאסי ומסך רגיל ללא מגע. לא קיימים טלפונים טיפשים עם מסך מגע.'
        });
        recommendations.push('לבחירת טלפון טיפש, הגדר "ללא מסך מגע" או אפשר גם "סמארטפון מצומצם".');
      }

      if (mustPhoneType === 'smart_only' && mustCleanLevel === 'strictly_clean') {
        contradictions.push({
          title: 'סתירה בין סמארטפון מצומצם לרמת "נקי לחלוטין"',
          desc: 'סמארטפונים מצומצמים מבוססים על מערכת אנדרואיד ומסווגים תמיד כ"מנוקה" (ניתן להשיג דגם זהה פתוח או ברמות סינון שונות בחנויות), ולכן אינם עונים להגדרה של "נקי לחלוטין".'
        });
        recommendations.push('עבור סמארטפון מצומצם, אפשר רמת נקיות "מנוקה" (מסונן).');
      }

      if (mustMaxBudget !== null && mustMaxBudget < 90) {
        contradictions.push({
          title: 'מסגרת תקציב נמוכה ממחיר המינימום בשוק',
          desc: `הוגדר תקציב מרבי של עד ₪${mustMaxBudget}, בעוד שהמכשירים הבסיסיים ביותר במאגר מתחילים מ-₪90 ומעלה.`
        });
        recommendations.push('העלה את מסגרת התקציב לפחות ל-₪150-200 כדי לאפשר התאמה לדגמים קיימים.');
      }

      if (mustCallsOnly && (prefMusic || prefCamera)) {
        contradictions.push({
          title: 'חוסר תאימות בין תנאי החובה להעדפות',
          desc: 'בחלק תנאי החובה הוגדר "שיחות ו-SMS בלבד ללא שום מולטימדיה", אך בהעדפות סומנה דרישה למוזיקה או למצלמה. תנאי החובה פוסל כל מכשיר שמכיל נגן או מצלמה.'
        });
        recommendations.push('אם הינך מעוניין בנגן מוזיקה או מצלמה, בחר בחובת שיחות "אפשר גם נגן מוזיקה / פונקציות בסיסיות".');
      }

      // המלצות כלליות נוספות על פי התנאים שהכשילו
      if (conditionFailures.budget.count > 0 && mustMaxBudget !== null && mustMaxBudget >= 90) {
        recommendations.push(`הגדלת התקציב מעבר ל-₪${mustMaxBudget} תאפשר גישה לדגמים נוספים שנפסלו בשל המחיר.`);
      }
      if (conditionFailures.callsOnly.count === phones.length && !mustCallsOnly) {
        // ...
      } else if (mustCallsOnly && recommendations.length === 0) {
        recommendations.push('חובת שיחות ו-SMS בלבד פוסלת את מרבית המכשירים הכוללים נגן או מצלמה. אפשור נגן שמע ירחיב את האפשרויות.');
      }
      if (mustCleanLevel === 'strictly_clean' && conditionFailures.cleanLevel.count > 0) {
        recommendations.push('דרישת "נקי לחלוטין" פוסלת מכשירים שקיימת עבורם גם גרסה פתוחה בשוק. אפשור רמת "נקי" יציג מכשירים נוספים.');
      }

      // איסוף התנאים שהכשילו בפועל (רק כאלו שהכשילו לפחות מכשיר אחד)
      const failedConditionsList = Object.keys(conditionFailures)
        .map(key => ({ key, ...conditionFailures[key] }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      diagnostics = {
        totalPhones: phones.length,
        contradictions,
        failedConditionsList,
        recommendations
      };
    }

    return {
      qualified: qualifiedDevices,
      diagnostics
    };
  }

  return {
    evaluate
  };
})();
