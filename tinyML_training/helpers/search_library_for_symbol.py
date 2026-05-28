import os

def search_word(word, path):
    result = []
    for root, dirs, files in os.walk(path):
        for f in files:
            if f.endswith(('.h', '.cpp', '.c')):
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                        if word in file.read():
                            result.append(filepath)
                except Exception as e:
                    pass
    return result

library_path = r"C:\Users\huudu\OneDrive\Documents\Arduino\libraries\TensorFlowLite_ESP32"
if os.path.exists(library_path):
    print(f"Searching library in {library_path}...")
    found = search_word("model_tflite", library_path)
    for f in found:
        print(f"  Found in: {f}")
else:
    print("Library path does not exist!")
