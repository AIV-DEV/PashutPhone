#!/usr/bin/env python3
"""
פשוטלפון - סקריפט בדיקות קבלה אוטומטי (בדיקת תאימות למסמך האפיון ולהערות המשתמש)
פועל באמצעות הספרייה הסטנדרטית של פייתון בלבד (ללא תלויות חיצוניות).
"""

import os
import sys
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXACT_SLOGAN = "פשוט טלפון ורק טלפון"
FORBIDDEN_WORDS = ["כשרות", "גוף כשרות", "ועדת רבנים", "מושגח", "מאושרת"]

def run_tests():
    print("=" * 60)
    print(" בדיקות קבלה לפרויקט 'פשוטלפון'")
    print(" סלוגן נבדק: " + EXACT_SLOGAN)
    print("=" * 60)
    
    passed = 0
    failed = 0

    def check(name, condition, error_msg=""):
        nonlocal passed, failed
        if condition:
            print(f" [V] {name}")
            passed += 1
        else:
            print(f" [X] נכשל: {name} - {error_msg}")
            failed += 1

    # 1. בדיקת קבצים חיוניים
    required_files = [
        "index.html",
        "recommended.html",
        "assets/css/style.css",
        "assets/js/app.js",
        "assets/js/data-loader.js",
        "assets/js/questionnaire.js",
        "assets/js/sample-data.js",
        "assets/images/logo.svg",
        "data/phones.json",
        "data/glossary.json",
        "data/phones/index.json",
        "data/glossary/index.json",
        "data/glossary/clean-level.md",
        "scripts/build_data.py",
        "README.md"
    ]
    for rf in required_files:
        p = os.path.join(ROOT_DIR, rf)
        check(f"קובץ קיים: {rf}", os.path.exists(p), f"הקובץ {p} חסר")

    # 2. בדיקת RTL ועברית ב-index.html וב-recommended.html
    html_path = os.path.join(ROOT_DIR, "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    check("הגדרת lang=he ב-HTML הראשי", 'lang="he"' in html_content)
    check("הגדרת dir=rtl ב-HTML הראשי", 'dir="rtl"' in html_content)
    check("הסלוגן המדויק מופיע ב-HTML הראשי", EXACT_SLOGAN in html_content)
    check("הסרת סיבוך מערכת הפעלה מסרגל הסינון", 'id="filter-os"' not in html_content)
    check("נוסח התנדבות והיעדר אחריות מופיע באודות", "בהתנדבות מלאה ואין שום אחריות על המידע בו ישירה או עקיפה" in html_content)
    check("שאלה מחמירה לשיחות והודעות בלבד קיימת בשאלון", 'name="must_calls_only"' in html_content)
    check("אפשרות העדפה למצלמה קיימת בשאלון", 'id="pref_camera_check"' in html_content)
    check("אפשרות העדפה לכרטיס זיכרון קיימת בשאלון", 'id="pref_memory_card_check"' in html_content)
    check("משפט יצירת קשר ומייל מופיע באודות", 'info@pashutphone.example.com' in html_content)
    check("קישור לדף המומלצים קיים בניווט", 'href="recommended.html"' in html_content)

    # 3. בדיקת דף המומלצים הנפרד (recommended.html)
    rec_html_path = os.path.join(ROOT_DIR, "recommended.html")
    with open(rec_html_path, "r", encoding="utf-8") as f:
        rec_content = f.read()

    check("הגדרת lang=he בדף המומלצים", 'lang="he"' in rec_content)
    check("הגדרת dir=rtl בדף המומלצים", 'dir="rtl"' in rec_content)
    check("הסלוגן המדויק מופיע בדף המומלצים", EXACT_SLOGAN in rec_content)
    check("קריטריון 1 (מקשים בלבד) מופיע בבועית", "מקשים בלבד" in rec_content)
    check("קריטריון 2 (ללא וידאו ורדיו) מופיע בבועית", "ללא תמיכה בוידאו ורדיו" in rec_content)
    check("קריטריון 3 (ללא אינטרנט ואפליקציות) מופיע בבועית", "ללא אינטרנט, אפליקציות, או התקנת יישומים" in rec_content)
    check("קריטריון 4 (נקי לחלוטין) מופיע בבועית", "נקי לחלוטין" in rec_content)
    check("קריטריון 5 (כולל SMS) מופיע בבועית", "כולל SMS" in rec_content)
    check("מייל התקשרות מופיע בדף המומלצים", "info@pashutphone.example.com" in rec_content)

    # 4. בדיקת שלילת מילים אסורות (שלילת אישורים וגופים חיצוניים בקובצי המידע והממשק)
    all_files_to_scan = []
    excluded_paths = ["pashutphone-agent-spec.md", "scripts/verify.py", "scripts/build_data.py"]
    for root, dirs, files in os.walk(ROOT_DIR):
        if ".git" in root:
            continue
        for file in files:
            rel = os.path.relpath(os.path.join(root, file), ROOT_DIR)
            if rel in excluded_paths or rel.startswith("scripts/"):
                continue
            if file.endswith((".html", ".js", ".css", ".json", ".md")):
                all_files_to_scan.append(os.path.join(root, file))

    has_forbidden = False
    for fpath in all_files_to_scan:
        rel = os.path.relpath(fpath, ROOT_DIR)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
            # בדף המומלצים, פסקת ההבהרה המאושרת שנוסחה על ידי המשתמש מותרת
            if rel == "recommended.html":
                # מוודאים ששאר הדף ומאפייני המכשירים לא כוללים מילים אסורות
                content = content.replace("מי שאין לו צורך בSMS - שילך לטלפונים הכשרים של ועדת הרבנים", "")

            for w in FORBIDDEN_WORDS:
                if w in content:
                    print(f"    ! נמצאה מילה אסורה '{w}' בקובץ: {rel}")
                    has_forbidden = True

    check("ללא מונחי כשרות/אישורים אסורים בקובצי הנתונים והממשק", not has_forbidden, "נמצאו מילים אסורות")

    # 5. בדיקת 4 מושגים טכניים במילון
    glossary_json_path = os.path.join(ROOT_DIR, "data", "glossary.json")
    with open(glossary_json_path, "r", encoding="utf-8") as f:
        glossary_items = json.load(f)

    glossary_ids = [item["id"] for item in glossary_items]
    check("בדיוק 4 מושגים טכניים במילון", len(glossary_items) == 4, f"נמצאו {len(glossary_items)} מושגים במקום 4")
    expected_anchors = ["phone-type", "clean-level", "operating-system", "message-storage"]
    for anch in expected_anchors:
        check(f"עוגן מילון קיים: #{anch}", anch in glossary_ids, f"העוגן {anch} לא נמצא במילון")

    # 6. בדיקת קטלוג ומאפייני נקיות, מסך מגע, כרטיס זיכרון ומומלצים
    phones_json_path = os.path.join(ROOT_DIR, "data", "phones.json")
    with open(phones_json_path, "r", encoding="utf-8") as f:
        phones_data = json.load(f)

    check("קיימים לפחות 4 מכשירי תבנית לבדיקה", len(phones_data) >= 4)
    has_strictly_calls_only = any(p["id"] == "sample-calls-only" for p in phones_data)
    check("קיים דגם תבנית לשיחות והודעות בלבד לבדיקת הסינון המחמיר", has_strictly_calls_only)
    has_recommended = any(p.get("is_recommended") is True for p in phones_data)
    check("קיים דגם המסומן כמומלץ (is_recommended: true)", has_recommended)

    for p in phones_data:
        check(f"מכשיר {p['id']} כולל שדה רמת נקיות", p.get("clean_level") in ["נקי לחלוטין", "נקי", "מנוקה"])
        check(f"מכשיר {p['id']} כולל שדה מסך מגע", "has_touch_screen" in p)
        check(f"מכשיר {p['id']} כולל שדה כרטיס זיכרון", "has_memory_card" in p)

    # 6. בדיקת CSS עבור 4 עמודות בשורה למושגים
    css_path = os.path.join(ROOT_DIR, "assets", "css", "style.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
    check("עיצוב 4 מושגים בשורה אחת ב-CSS", "grid-template-columns: repeat(4, 1fr)" in css_content)
    check("עיצוב מעבר מספר בשורה נפרדת ב-CSS", ".glossary-numbered-item" in css_content)

    print("=" * 60)
    print(f" סיכום בדיקות: {passed} עברו בהצלחה, {failed} נכשלו.")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
