import csv

# We will read dataset_tinyml_10000.csv manually
# Columns: temp,hum,soil,lux,fan,light,pump

total = 0
light_on = 0
light_off = 0

fan_on = 0
fan_off = 0

pump_on = 0
pump_off = 0

# For stats
lux_when_light_on = []
lux_when_light_off = []

temp_when_fan_on = []
temp_when_fan_off = []

soil_when_pump_on = []
soil_when_pump_off = []

with open('dataset_tinyml_10000.csv', 'r') as f:
    reader = csv.reader(f)
    header = next(reader)
    # columns are: temp,hum,soil,lux,fan,light,pump
    for row in reader:
        if not row:
            continue
        temp = float(row[0])
        hum = float(row[1])
        soil = float(row[2])
        lux = float(row[3])
        fan = int(row[4])
        light = int(row[5])
        pump = int(row[6])
        
        total += 1
        if light == 1:
            light_on += 1
            lux_when_light_on.append(lux)
        else:
            light_off += 1
            lux_when_light_off.append(lux)
            
        if fan == 1:
            fan_on += 1
            temp_when_fan_on.append(temp)
        else:
            fan_off += 1
            temp_when_fan_off.append(temp)
            
        if pump == 1:
            pump_on += 1
            soil_when_pump_on.append(soil)
        else:
            pump_off += 1
            soil_when_pump_off.append(soil)

report = []
report.append(f"Total rows: {total}")
report.append(f"Light ON: {light_on}, Light OFF: {light_off}")
if lux_when_light_on:
    report.append(f"Lux when Light ON: min={min(lux_when_light_on):.2f}, max={max(lux_when_light_on):.2f}, avg={sum(lux_when_light_on)/len(lux_when_light_on):.2f}")
if lux_when_light_off:
    report.append(f"Lux when Light OFF: min={min(lux_when_light_off):.2f}, max={max(lux_when_light_off):.2f}, avg={sum(lux_when_light_off)/len(lux_when_light_off):.2f}")

report.append(f"\nFan ON: {fan_on}, Fan OFF: {fan_off}")
if temp_when_fan_on:
    report.append(f"Temp when Fan ON: min={min(temp_when_fan_on):.2f}, max={max(temp_when_fan_on):.2f}, avg={sum(temp_when_fan_on)/len(temp_when_fan_on):.2f}")
if temp_when_fan_off:
    report.append(f"Temp when Fan OFF: min={min(temp_when_fan_off):.2f}, max={max(temp_when_fan_off):.2f}, avg={sum(temp_when_fan_off)/len(temp_when_fan_off):.2f}")

report.append(f"\nPump ON: {pump_on}, Pump OFF: {pump_off}")
if soil_when_pump_on:
    report.append(f"Soil when Pump ON: min={min(soil_when_pump_on):.2f}, max={max(soil_when_pump_on):.2f}, avg={sum(soil_when_pump_on)/len(soil_when_pump_on):.2f}")
if soil_when_pump_off:
    report.append(f"Soil when Pump OFF: min={min(soil_when_pump_off):.2f}, max={max(soil_when_pump_off):.2f}, avg={sum(soil_when_pump_off)/len(soil_when_pump_off):.2f}")

# Check mismatch counts against rule:
# Light = 1 if lux < 200 else 0
# Fan = 1 if temp > 30 else 0
# Pump = 1 if soil < 50 else 0

light_mismatch = 0
fan_mismatch = 0
pump_mismatch = 0

with open('dataset_tinyml_10000.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if not row:
            continue
        temp = float(row[0])
        soil = float(row[2])
        lux = float(row[3])
        fan = int(row[4])
        light = int(row[5])
        pump = int(row[6])
        
        expected_light = 1 if lux < 200 else 0
        expected_fan = 1 if temp > 30 else 0
        expected_pump = 1 if soil < 50 else 0
        
        if light != expected_light:
            light_mismatch += 1
        if fan != expected_fan:
            fan_mismatch += 1
        if pump != expected_pump:
            pump_mismatch += 1

report.append(f"\nMismatches against simple rules:")
report.append(f"Light mismatch: {light_mismatch} ({light_mismatch/total*100:.2f}%)")
report.append(f"Fan mismatch: {fan_mismatch} ({fan_mismatch/total*100:.2f}%)")
report.append(f"Pump mismatch: {pump_mismatch} ({pump_mismatch/total*100:.2f}%)")

with open('result_fast.txt', 'w', encoding='utf-8') as out_f:
    out_f.write('\n'.join(report))
print("Done check_fast")
