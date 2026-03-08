import sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

def check_docx(file_path):
    doc = Document(file_path)
    issues = []
    
    # Styles that generally require first-line indent and justified alignment
    target_styles = ["Normal", "Body Text", "Default Paragraph Font"]
    
    for i, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        if not text:
            continue
            
        style_name = p.style.name
        
        # Only check styles that act like normal text
        is_target_style = any(t in style_name for t in target_styles)
        if not is_target_style:
            continue
            
        issues_in_p = []
        
        # 1. Check Justified alignment
        align = p.alignment
        if align is None and p.style.paragraph_format.alignment is not None:
            align = p.style.paragraph_format.alignment
            
        if align != WD_ALIGN_PARAGRAPH.JUSTIFY:
            issues_in_p.append(f"Không căn đều hai bên (Alignment hiện tại: {align})")
            
        # 2. Check First line indent (tab đầu dòng)
        first_indent = p.paragraph_format.first_line_indent
        if first_indent is None and p.style.paragraph_format.first_line_indent is not None:
            first_indent = p.style.paragraph_format.first_line_indent
            
        has_first_indent = False
        if first_indent is not None and first_indent.pt > 0:
            has_first_indent = True
            
        if not has_first_indent:
            # Check for manual tabs or spaces at the start of original text
            orig_text = p.text
            if orig_text.startswith("\t") or orig_text.startswith(" ") or orig_text.startswith("\xa0"):
                issues_in_p.append("Dùng phím Space/Tab thủ công thay vì format First Line Indent (Tab đầu dòng)")
            else:
                issues_in_p.append("Thiếu định dạng Tab đầu dòng (First Line Indent)")
                
        if issues_in_p:
            issues.append({
                "para_idx": i + 1,
                "text": text[:80] + ("..." if len(text) > 80 else ""),
                "style": style_name,
                "issues": issues_in_p
            })
            
    return issues

if __name__ == "__main__":
    file_path = r"d:\DoAn_Garden\smart_garden\22111060935_TranHaiAnh.docx"
    try:
        issues = check_docx(file_path)
        with open('formatting_report.md', 'w', encoding='utf-8') as f:
            if not issues:
                f.write("Không tìm thấy lỗi format cơ bản (căn đều 2 bên, tab đầu dòng) trong văn bản Normal!\n")
            else:
                f.write("# Báo cáo lỗi trình bày Word\n\n")
                f.write(f"Tìm thấy **{len(issues)}** đoạn văn bản (Style Normal/Body Text) có thể bị lỗi trình bày:\n\n")
                for issue in issues:
                    f.write(f"### Đoạn {issue['para_idx']} (Style: {issue['style']})\n")
                    f.write(f"> {issue['text']}\n\n")
                    f.write("**Lỗi:**\n")
                    for err in issue['issues']:
                        f.write(f"- {err}\n")
                    f.write("\n")
        print("Report written to formatting_report.md")
    except Exception as e:
        print(f"ERROR: {e}")
