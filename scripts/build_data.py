#!/usr/bin/env python3
"""
פשוטלפון - סקריפט עיבוד ואימות נתונים מקובצי Markdown
ממיר את קובצי ה-Markdown בתיקיות data/phones/ ו-data/glossary/ ל-JSON
ללא כל תלות חיצונית (ספרייה סטנדרטית של פייתון בלבד).
"""

import os
import sys
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHONES_DIR = os.path.join(ROOT_DIR, "data", "phones")
GLOSSARY_DIR = os.path.join(ROOT_DIR, "data", "glossary")

FORBIDDEN_TERMS = [
    "כשרות", "גוף כשרות", "ועדת רבנים", "מאושר", "מושגח", "אישור כשרות"
]

def parse_yaml_frontmatter(content):
    """פירוק פשוט של YAML Frontmatter מראש קובץ Markdown ללא ספריות חיצוניות."""
    if not content.startswith("---"):
        return {}, content
    
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    
    yaml_text = parts[1]
    markdown_body = parts[2].strip()
    
    data = {}
    current_key = None
    current_list = None
    
    lines = yaml_text.strip().splitlines()
    for line in lines:
        raw_line = line
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        
        # בדוק אם מדובר בפריט רשימה
        if line.startswith("- "):
            val = line[2:].strip().strip('"\'')
            if current_list is not None:
                current_list.append(val)
            continue
            
        # מפתח ראשי
        if ":" in line and not raw_line.startswith("  "):
            k, v = line.split(":", 1)
            k = k.strip()
            v = v.strip()
            current_key = k
            current_list = None
            
            if v == "":
                current_list = []
                data[k] = current_list
            elif v == "[]":
                data[k] = []
                current_list = data[k]
            elif v.startswith("[") and v.endswith("]"):
                inner = v[1:-1].strip()
                if not inner:
                    data[k] = []
                else:
                    raw_items = [x.strip() for x in inner.split(",") if x.strip()]
                    parsed_items = []
                    for item in raw_items:
                        item = item.strip('"\'')
                        if item.startswith("http://") or item.startswith("https://"):
                            parsed_items.append({"title": "האתר הרשמי / לרכישה", "url": item})
                        else:
                            parsed_items.append(item)
                    data[k] = parsed_items
                current_list = data[k]
            elif v.lower() == "true":
                data[k] = True
            elif v.lower() == "false":
                data[k] = False
            elif v.isdigit():
                data[k] = int(v)
            else:
                data[k] = v.strip('"\'')
            continue
            
        # תת-מפתח (מוזח)
        if raw_line.startswith("  ") and ":" in line:
            k, v = line.split(":", 1)
            k = k.strip()
            v = v.strip()
            if current_key not in data or not isinstance(data[current_key], dict):
                data[current_key] = {}
            if v == "":
                data[current_key][k] = ""
            elif v == "[]":
                data[current_key][k] = []
            elif v.lower() == "true":
                data[current_key][k] = True
            elif v.lower() == "false":
                data[current_key][k] = False
            elif v.isdigit():
                data[current_key][k] = int(v)
            else:
                data[current_key][k] = v.strip('"\'')
            continue
            
        # פריט רשימה של מפתח ראשי
        if raw_line.startswith("  - "):
            val = line[2:].strip().strip('"\'')
            if current_key:
                if current_key not in data or not isinstance(data[current_key], list):
                    data[current_key] = []
                data[current_key].append(val)
                
    return data, markdown_body

def build():
    print("מתחיל עיבוד נתונים עבור 'פשוטלפון'...")
    
    # 1. עיבוד מכשירים
    phones = []
    if os.path.exists(PHONES_DIR):
        index_file = os.path.join(PHONES_DIR, "index.json")
        ordered_files = []
        if os.path.exists(index_file):
            try:
                with open(index_file, "r", encoding="utf-8") as f:
                    ordered_files = json.load(f)
            except Exception:
                ordered_files = []

        dir_files = [f for f in os.listdir(PHONES_DIR) if f.endswith(".md")]
        all_files = []
        for of in ordered_files:
            if of in dir_files and of not in all_files:
                all_files.append(of)
        for df in sorted(dir_files):
            if df not in all_files:
                all_files.append(df)

        for filename in all_files:
            filepath = os.path.join(PHONES_DIR, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            for forbidden in FORBIDDEN_TERMS:
                if forbidden in content:
                    raise ValueError(f"שגיאת אבטחה/אפיון: נמצא מונח אסור '{forbidden}' בקובץ {filename}")
                    
            frontmatter, body = parse_yaml_frontmatter(content)
            frontmatter["description"] = body
            phones.append(frontmatter)
            print(f"  [+] מכשיר: {frontmatter.get('model', filename)}")
            
    phones_json_path = os.path.join(ROOT_DIR, "data", "phones.json")
    with open(phones_json_path, "w", encoding="utf-8") as f:
        json.dump(phones, f, ensure_ascii=False, indent=2)
    print(f"נשמר בהצלחה: {phones_json_path} ({len(phones)} מכשירים)")
    
    # 2. עיבוד מילון מושגים (בדיוק 4 המושגים המוגדרים)
    glossary = []
    glossary_index_path = os.path.join(GLOSSARY_DIR, "index.json")
    if os.path.exists(glossary_index_path):
        with open(glossary_index_path, "r", encoding="utf-8") as f:
            glossary_files = json.load(f)
    else:
        glossary_files = ["phone-type.md", "clean-level.md", "operating-system.md", "message-storage.md"]

    for filename in glossary_files:
        filepath = os.path.join(GLOSSARY_DIR, filename)
        if not os.path.exists(filepath):
            continue
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        for forbidden in FORBIDDEN_TERMS:
            if forbidden in content:
                raise ValueError(f"שגיאת אבטחה/אפיון: נמצא מונח אסור '{forbidden}' בקובץ מילון {filename}")
                
        frontmatter, body = parse_yaml_frontmatter(content)
        frontmatter["content"] = body
        glossary.append(frontmatter)
        print(f"  [+] מונח: {frontmatter.get('term', filename)}")
            
    glossary.sort(key=lambda x: x.get("order", 999))
    glossary_json_path = os.path.join(ROOT_DIR, "data", "glossary.json")
    with open(glossary_json_path, "w", encoding="utf-8") as f:
        json.dump(glossary, f, ensure_ascii=False, indent=2)
    print(f"נשמר בהצלחה: {glossary_json_path} ({len(glossary)} מושגים)")
    
    # 3. עדכון assets/js/sample-data.js (לטעינה מקומית חלקה)
    sample_data_path = os.path.join(ROOT_DIR, "assets", "js", "sample-data.js")
    combined = {
        "phones": phones,
        "glossary": glossary
    }
    js_content = "/**\n * פשוטלפון - נתונים מובנים (נוצר אוטומטית)\n * סלוגן: פשוט טלפון ורק טלפון\n */\n"
    js_content += "window.__PASHUTPHONE_DATA__ = " + json.dumps(combined, ensure_ascii=False, indent=2) + ";\n"
    with open(sample_data_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"עודכן בהצלחה: {sample_data_path}")
    print("העיבוד הושלם בהצלחה!")

if __name__ == "__main__":
    build()
