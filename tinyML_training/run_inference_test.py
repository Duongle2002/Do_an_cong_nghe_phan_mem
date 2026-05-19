from pathlib import Path
import json
import numpy as np
from tensorflow.lite.python.interpreter import Interpreter

model_path = Path('artifacts/model.tflite').resolve()
scaler_path = Path('artifacts/scaler.json').resolve()
print('Model:', model_path)
print('Scaler:', scaler_path)
scaler = json.loads(scaler_path.read_text())
FEATURE_COLUMNS = scaler['input_order']
FEATURE_RANGES = {k:(v['min'], v['max']) for k,v in scaler['feature_ranges'].items()}

def normalize(val, lo, hi):
    v = float(val)
    if v < lo: v = lo
    if v > hi: v = hi
    return (v - lo) / (hi - lo) if hi>lo else 0.5


def run_sample(temp, hum, soil, lux):
    inp = [temp, hum, soil, lux]
    norm = [normalize(x, *FEATURE_RANGES[name]) for x,name in zip(inp, FEATURE_COLUMNS)]
    interp = Interpreter(str(model_path))
    interp.allocate_tensors()
    input_details = interp.get_input_details()[0]
    output_details = interp.get_output_details()[0]
    # debug info
    print('input_details dtype', input_details['dtype'], 'quant', input_details['quantization'])
    print('output_details dtype', output_details['dtype'], 'quant', output_details['quantization'])
    # prepare input according to dtype
    dtype = input_details['dtype']
    if 'int8' in str(dtype):
        scale, zp = input_details['quantization']
        q = np.array(norm, dtype=np.float32) / (scale if scale!=0 else 1.0) + zp
        q = np.round(q).astype(np.int8)
        input_data = np.array(q, dtype=np.int8).reshape(1, -1)
    elif 'uint8' in str(dtype):
        scale, zp = input_details['quantization']
        q = np.array(norm, dtype=np.float32) / (scale if scale!=0 else 1.0) + zp
        q = np.round(q).astype(np.uint8)
        input_data = np.array(q, dtype=np.uint8).reshape(1, -1)
    else:
        input_data = np.array(norm, dtype=np.float32).reshape(1, -1)
    interp.set_tensor(input_details['index'], input_data)
    interp.invoke()
    out = interp.get_tensor(output_details['index'])[0]
    # dequantize if needed
    odtype = output_details['dtype']
    if 'int8' in str(odtype) or 'uint8' in str(odtype):
        scale, zp = output_details['quantization']
        out = (out.astype(np.float32) - zp) * scale
    return norm, out


def run_with_custom_ranges(temp, hum, soil, lux, ranges):
    inp = [temp, hum, soil, lux]
    norm = [normalize(x, *ranges[name]) for x,name in zip(inp, FEATURE_COLUMNS)]
    interp = Interpreter(str(model_path))
    interp.allocate_tensors()
    input_details = interp.get_input_details()[0]
    output_details = interp.get_output_details()[0]
    # prepare input according to dtype
    dtype = input_details['dtype']
    if 'int8' in str(dtype):
        scale, zp = input_details['quantization']
        q = np.array(norm, dtype=np.float32) / (scale if scale!=0 else 1.0) + zp
        q = np.round(q).astype(np.int8)
        input_data = np.array(q, dtype=np.int8).reshape(1, -1)
    elif 'uint8' in str(dtype):
        scale, zp = input_details['quantization']
        q = np.array(norm, dtype=np.float32) / (scale if scale!=0 else 1.0) + zp
        q = np.round(q).astype(np.uint8)
        input_data = np.array(q, dtype=np.uint8).reshape(1, -1)
    else:
        input_data = np.array(norm, dtype=np.float32).reshape(1, -1)
    interp.set_tensor(input_details['index'], input_data)
    interp.invoke()
    out = interp.get_tensor(output_details['index'])[0]
    odtype = output_details['dtype']
    if 'int8' in str(odtype) or 'uint8' in str(odtype):
        scale, zp = output_details['quantization']
        out = (out.astype(np.float32) - zp) * scale
    return norm, out

samples = [
    (12.9, 65.7, 81, 0.0),
    (10.0, 70.0, 80.0, 0.0),
    (15.0, 70.0, 80.0, 0.0),
    (20.0, 70.0, 80.0, 0.0),
    (25.0, 50.0, 50.0, 0.0),
    (25.0, 50.0, 50.0, 10.0),
]
for s in samples:
    norm, out = run_sample(*s)
    print('TRAIN NORM input', s, 'normalized', [round(x,3) for x in norm], '-> outputs', [round(float(x),3) for x in out])
    # firmware ranges (0..50 for temp)
    firmware_ranges = {'temp': (0.0, 50.0), 'hum': (0.0,100.0), 'soil': (0.0,100.0), 'lux': (0.0,5000.0)}
    fnorm, fout = run_with_custom_ranges(*s, firmware_ranges)
    print('FIRM NORM input', s, 'normalized', [round(x,3) for x in fnorm], '-> outputs', [round(float(x),3) for x in fout])
