import tensorflow as tf
import numpy as np

tflite_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite"
interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()

print("All tensors in model:")
for i in range(len(interpreter.get_tensor_details())):
    detail = interpreter.get_tensor_details()[i]
    print(f"Index {detail['index']}: {detail['name']}, shape={detail['shape']}, dtype={detail['dtype']}")

# Let's print weights of the first Dense layer (usually index 1 or 2 or 3)
# From the list we can find the indices. Let's find any tensor with 'weight' or 'bias' in name.
for detail in interpreter.get_tensor_details():
    name = detail['name']
    if 'weight' in name or 'bias' in name or 'dense' in name:
        tensor_data = interpreter.get_tensor(detail['index'])
        print(f"\nTensor '{name}' (index {detail['index']}):")
        print(f"Shape: {tensor_data.shape}")
        print(f"Dtype: {tensor_data.dtype}")
        print(f"Min: {np.min(tensor_data)}, Max: {np.max(tensor_data)}, Mean: {np.mean(tensor_data)}")
        print("Values (flattened, first 20):")
        print(tensor_data.flatten()[:20])
