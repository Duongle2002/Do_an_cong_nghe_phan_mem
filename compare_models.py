import re

def main():
    model_h_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\code_esp32\esp32_wroom_env_l298n\model.h"
    model_tflite_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite"
    
    with open(model_h_path, "r") as f:
        content = f.read()
        
    # Extract the hex values from model_tflite array in model.h
    match = re.search(r"model_tflite\[\]\s*=\s*\{(.*?)\};", content, re.DOTALL)
    if not match:
        print("Error: Could not find model_tflite array in model.h")
        return
        
    hex_str = match.group(1)
    h_bytes = []
    for val in re.findall(r"0x[0-9a-fA-F]+", hex_str):
        h_bytes.append(int(val, 16))
    h_data = bytes(h_bytes)
    
    with open(model_tflite_path, "rb") as f:
        tflite_data = f.read()
        
    print(f"model.h array size: {len(h_data)} bytes")
    print(f"model.tflite file size: {len(tflite_data)} bytes")
    
    if h_data == tflite_data:
        print("Success: model.h and model.tflite are identical!")
    else:
        print("WARNING: model.h and model.tflite are DIFFERENT!")
        # Print first diff
        diff_count = 0
        for i in range(min(len(h_data), len(tflite_data))):
            if h_data[i] != tflite_data[i]:
                if diff_count < 10:
                    print(f"Diff at index {i}: model.h={h_data[i]:02x}, tflite={tflite_data[i]:02x}")
                diff_count += 1
        print(f"Total different bytes: {diff_count}")

if __name__ == "__main__":
    main()
