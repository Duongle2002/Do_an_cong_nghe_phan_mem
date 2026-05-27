import os

def find_files(name, path):
    result = []
    for root, dirs, files in os.walk(path):
        if name in files:
            result.append(os.path.join(root, name))
    return result

paths_to_search = [
    r"d:\nam4\hk2\doan1",
    r"C:\Users\huudu\Documents",
    r"C:\Users\huudu\OneDrive"
]

for p in paths_to_search:
    if os.path.exists(p):
        print(f"Searching {p}...")
        found = find_files("esp32_wroom_env_l298n.ino", p)
        for f in found:
            print(f"  Found: {f}")
    else:
        print(f"Path does not exist: {p}")
