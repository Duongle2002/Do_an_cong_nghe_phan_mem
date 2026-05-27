from pathlib import Path

model_path = Path(r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite")
blob = model_path.read_bytes()
checksum = sum(blob)
print(f"Model: {model_path.name}")
print(f"Size: {len(blob)} bytes")
print(f"Checksum (sum of all bytes): {checksum}")
