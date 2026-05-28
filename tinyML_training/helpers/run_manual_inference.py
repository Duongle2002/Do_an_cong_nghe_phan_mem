import tensorflow as tf
import numpy as np

tflite_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite"
interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()
# Run a dummy invoke to make sure all tensors are allocated in memory
input_details = interpreter.get_input_details()[0]
interpreter.set_tensor(input_details['index'], np.zeros(input_details['shape'], dtype=np.int8))
interpreter.invoke()

# Extract weights and biases
details = interpreter.get_tensor_details()
w1 = None
b1 = None
w2 = None
b2 = None

w1 = interpreter.get_tensor(4)
w1_scale, w1_zp = [d for d in details if d['index'] == 4][0]['quantization']
b1 = interpreter.get_tensor(3)

w2 = interpreter.get_tensor(2)
w2_scale, w2_zp = [d for d in details if d['index'] == 2][0]['quantization']
b2 = interpreter.get_tensor(1)

# Let's print details
print("w1 shape:", w1.shape, "scale:", w1_scale, "zp:", w1_zp)
print("b1 shape:", b1.shape)
print("w2 shape:", w2.shape, "scale:", w2_scale, "zp:", w2_zp)
print("b2 shape:", b2.shape)

# Input details
input_details = interpreter.get_input_details()[0]
in_scale, in_zp = input_details['quantization']
print("input scale:", in_scale, "zp:", in_zp)

output_details = interpreter.get_output_details()[0]
out_scale, out_zp = output_details['quantization']
print("output scale:", out_scale, "zp:", out_zp)

# Input vector
x = np.array([41, 44, -125, -122], dtype=np.int8)

# Manual float inference (dequantizing first)
print("\n--- Manual Floating Point Inference ---")
x_float = (x.astype(np.float32) - in_zp) * in_scale
w1_float = (w1.astype(np.float32) - w1_zp) * w1_scale
b1_float = b1.astype(np.float32) * (in_scale * w1_scale) # bias scale is input_scale * weight_scale

# Layer 1: Dense 8 Relu
h1_float = np.dot(x_float, w1_float.T) + b1_float
h1_float = np.maximum(h1_float, 0) # ReLU

# Layer 2: Dense 3 Sigmoid
w2_float = (w2.astype(np.float32) - w2_zp) * w2_scale
b2_float = b2.astype(np.float32) * (w1_scale * w2_scale) # Wait, is this correct? Actually TFLite bias scale for Layer 2 is input_scale_of_layer2 * weight_scale_of_layer2
# Let's get the scale of activation after Layer 1.
# In TFLite, the activation tensor after ReLU has its own scale and zp. Let's find it.
h1_tensor_details = [d for d in details if 'dense_8_relu' in d['name'] and 'Relu' in d['name'] and 'MatMul' not in d['name']][0]
h1_scale, h1_zp = h1_tensor_details['quantization']
print("h1 scale:", h1_scale, "zp:", h1_zp)

b2_float = b2.astype(np.float32) * (h1_scale * w2_scale)
h1_dequant = (np.round(h1_float / h1_scale) + h1_zp) # Quantized h1
h1_dequant = np.clip(h1_dequant, -128, 127).astype(np.int8)
h1_dequant_float = (h1_dequant.astype(np.float32) - h1_zp) * h1_scale

h2_float = np.dot(h1_dequant_float, w2_float.T) + b2_float
out_sigmoid = 1.0 / (1.0 + np.exp(-h2_float))
print("Sigmoid outputs:", out_sigmoid)

# Quantized outputs
out_quant = np.round(out_sigmoid / out_scale) + out_zp
out_quant = np.clip(out_quant, -128, 127).astype(np.int8)
print("Quantized outputs (predicted):", out_quant)
