import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = ["g:/Platform/admin.html", "g:/Platform/index.html", "g:/Platform/dashboard.html", "g:/Platform/test.html"]

def fix_html_forms():
    for filepath in files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except FileNotFoundError:
            continue

        changes = []
        seen_ids = set()
        
        for i in range(len(lines)):
            line = lines[i]
            new_line = line
            
            # 1. <label> missing `for`
            if '<label' in new_line and 'for=' not in new_line:
                found_id = None
                for j in range(i, min(i+5, len(lines))):
                    id_match = re.search(r'id=["\']([^"\']+)["\']', lines[j])
                    if id_match and re.search(r'<(input|select|textarea)', lines[j]):
                        found_id = id_match.group(1)
                        break
                if found_id:
                    new_line = re.sub(r'<label([^>]*)>', r'<label\1 for="' + found_id + '">', new_line)

            # 2. inputs, selects, textareas
            for tag in ['input', 'select', 'textarea']:
                pattern = r'<' + tag + r'([^>]*)>'
                
                def replacer(match):
                    attrs = match.group(1)
                    if 'type="hidden"' in attrs or 'type="submit"' in attrs or 'type="button"' in attrs or 'display:none' in attrs.replace(' ', ''):
                        if 'name=' not in attrs:
                            # Try to add a name even for hidden or file inputs just in case
                            id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
                            if id_match:
                                clean_name = id_match.group(1).replace('$', '').replace('{', '').replace('}', '')
                                attrs += f' name="{clean_name}"'
                        return '<' + tag + attrs + '>'
                    
                    id_match = re.search(r'id=["\']([^"\']+)["\']', attrs)
                    field_id = id_match.group(1) if id_match else None
                    
                    if field_id:
                        if '$' not in field_id and field_id in seen_ids:
                            new_field_id = field_id + '_' + str(i)
                            attrs = re.sub(r'id=["\']' + re.escape(field_id) + r'["\']', 'id="' + new_field_id + '"', attrs)
                            field_id = new_field_id
                        elif '$' not in field_id:
                            seen_ids.add(field_id)
                    else:
                        field_id = tag + '_' + str(i)
                        attrs += f' id="{field_id}"'
                        seen_ids.add(field_id)

                    name_match = re.search(r'name=["\']([^"\']*)["\']', attrs)
                    clean_name = field_id.replace('$', '').replace('{', '').replace('}', '').replace('t.testId', 'test_id').replace('t.id', 'id')
                    
                    if not name_match or name_match.group(1) == 'create':
                        if name_match:
                            attrs = re.sub(r'name=["\'][^"\']+["\']', f'name="{clean_name}"', attrs)
                        else:
                            attrs += f' name="{clean_name}"'
                        
                    return '<' + tag + attrs + '>'
                
                new_line = re.sub(pattern, replacer, new_line)
                
            if line != new_line:
                changes.append({'line': i+1, 'before': line, 'after': new_line})
                lines[i] = new_line
                
        if changes:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            with open("g:/Platform/scratch/changes_" + filepath.split('/')[-1] + ".txt", "w", encoding="utf-8") as out:
                out.write(f"### FILE: {filepath.split('/')[-1]}\n")
                out.write("CHANGES:\n")
                for idx, change in enumerate(changes):
                    out.write(f"{idx+1}. Line {change['line']}\n")
                    out.write(f"   BEFORE: {change['before'].strip()}\n")
                    out.write(f"   AFTER:  {change['after'].strip()}\n\n")

if __name__ == '__main__':
    fix_html_forms()
