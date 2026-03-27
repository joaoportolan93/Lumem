import os

search_replace = [
    ('Lumem', 'Lumem'),
    ('lumem', 'lumem'),
    ('Lumem', 'Lumem'),
    ('lumem', 'lumem')
]

def replace_in_files(directory):
    for root, dirs, files in os.walk(directory):
        if '.git' in root or 'node_modules' in root or '__pycache__' in root or '.dart_tool' in root or 'build' in root or '.gemini' in root:
            continue
        for file in files:
            if file.endswith(('.py', '.js', '.jsx', '.html', '.css', '.md', '.json', '.env', '.env.example', '.dart', '.yaml', '.yml', '.xml', 'Dockerfile', '.sh', '.ini')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    new_content = content
                    for old, new in search_replace:
                        new_content = new_content.replace(old, new)
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f'Updated {filepath}')
                except Exception as e:
                    print(f'Failed {filepath}: {e}')

replace_in_files('.')
print("Substituição concluída.")
