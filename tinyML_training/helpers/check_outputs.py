import numpy as np
import tensorflow as tf

def main():
    tflite_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite"
    try:
        interpreter = tf.lite.Interpreter(model_path=tflite_path, experimental_preserve_all_tensors=True)
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()[0]
        output_details = interpreter.get_output_details()[0]
        
        # [40, 52, -125, -122] - từ log ESP32 mới nhất
        input_data = np.array([[40, 52, -125, -122]], dtype=np.int8)
        
        interpreter.set_tensor(input_details['index'], input_data)
        interpreter.invoke()
        
        output_data = interpreter.get_tensor(output_details['index'])[0]
        h1_data = interpreter.get_tensor(5)[0]
        
        # Dequantize
        scale, zp = output_details['quantization']
        dequant_data = (output_data.astype(np.float32) - zp) * scale
        
        print("Model output in Python:")
        print(f"h1 quant (index 5): {list(h1_data)}")
        print(f"Raw outputs quant: {list(output_data)}")
        print(f"Dequantized outputs: Fan={dequant_data[0]:.3f}, Light={dequant_data[1]:.3f}, Pump={dequant_data[2]:.3f}")
        
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
