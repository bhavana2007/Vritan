import os

REPLACEMENTS = {
    "Vritan": "Vritan",
    "vritanadmin@gmail.com": "vritanadmin@gmail.com",
    "AI-Powered Intelligent Healthcare Collaboration Platform": "AI-Powered Intelligent Healthcare Collaboration Platform",
    "AI-Powered Intelligent Healthcare Collaboration Platform": "AI-Powered Intelligent Healthcare Collaboration Platform",
    "AI-Powered Intelligent Healthcare Collaboration Platform": "AI-Powered Intelligent Healthcare Collaboration Platform"
}

for root, _, files in os.walk('d:/Medilocker'):
    if 'node_modules' in root or '.git' in root or 'venv' in root or 'dist' in root or '__pycache__' in root or '.pytest_cache' in root:
        continue
        
    for file in files:
        if file.endswith(('.jsx', '.js', '.html', '.py', '.md', '.css')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                new_content = content
                for old, new in REPLACEMENTS.items():
                    new_content = new_content.replace(old, new)
                    
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {path}")
            except Exception as e:
                pass
