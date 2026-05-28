import os

def find_files(name, path):
    result = []
    for root, dirs, files in os.walk(path):
        if name in files:
            result.append(os.path.join(root, name))
    return result

paths_to_search = [
    r"C:\Users\huudu\OneDrive\Documents\Arduino",
    r"C:\Users\huudu\Documents\Arduino",
    r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem"
]

for p in paths_to_search:
    if os.path.exists(p):
        print(f"Searching {p}...")
        found = find_files("model.h", p)
        for f in found:
            print(f"  Found: {f} (size: {os.path.getsize(f)} bytes)")
    else:
        print(f"Path does not exist: {p}")
