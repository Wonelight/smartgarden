import zipfile
import xml.etree.ElementTree as ET
import re
from collections import Counter

def extract_text_from_docx(docx_path):
    try:
        doc = zipfile.ZipFile(docx_path)
        xml_content = doc.read('word/document.xml')
        doc.close()
        tree = ET.XML(xml_content)
        
        paragraphs = []
        for paragraph in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            texts = [node.text for node in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
            if texts:
                paragraphs.append(''.join(texts))
        
        return '\n'.join(paragraphs)
    except Exception as e:
        return str(e)

path = r"d:\DoAn_Garden\smart_garden\22111060935_TranHaiAnh.docx"
text = extract_text_from_docx(path)

# Extract combinations of uppercase strings, e.g., IoT, WiFi, API, HTTP
# We match words that have at least two uppercase letters, or start with capital and end with capital, etc.
# Actually, just finding all words that look like abbreviations.
abbrs = set()
for word in re.findall(r'\b[A-Za-z0-9-]+\b', text):
    # Rule: mostly uppercase, or well known ones
    if len(word) >= 2:
        if word.upper() == word and any(c.isalpha() for c in word):
            abbrs.add(word)
        elif word in ["IoT", "WiFi", "Wi-Fi", "FreeRTOS", "XGBoost", "FastAPI", "PostgreSQL", "ReactJS", "NodeJS", "ESP32", "DHT11", "YFS201", "JSON", "JWT"]:
            abbrs.add(word)

counts = Counter()
for word in re.findall(r'\b[A-Za-z0-9-]+\b', text):
    if word in abbrs:
        counts[word] += 1

print("--- TOP ABBREVIATIONS ---")
for k, v in counts.most_common(50):
    print(f"{k}: {v}")
