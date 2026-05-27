import tensorflow as tf
tflite_path = r"d:\nam4\hk2\doan1\Do_an_cong_nghe_phan_mem\tinyML_training\artifacts\model.tflite"
interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()
print("Input details:")
print(interpreter.get_input_details()[0])
print("\nOutput details:")
print(interpreter.get_output_details()[0])
