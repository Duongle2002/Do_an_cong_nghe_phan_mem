import pandas as pd
import numpy as np

# Load dataset
df = pd.read_csv('dataset_tinyml_10000.csv')

report = []
report.append(f"Total rows: {len(df)}")

# Analyze Fan
# Let's see the range of temperature when fan is 1 vs 0
report.append("\n=== FAN LOGIC ===")
report.append(f"Fan ON count: {len(df[df['fan'] == 1])}")
report.append(f"Fan OFF count: {len(df[df['fan'] == 0])}")
report.append("Temperature stats when fan is 1:")
report.append(str(df[df['fan'] == 1]['temp'].describe()))
report.append("Temperature stats when fan is 0:")
report.append(str(df[df['fan'] == 0]['temp'].describe()))

# Analyze Pump
# Let's see the range of soil moisture when pump is 1 vs 0
report.append("\n=== PUMP LOGIC ===")
report.append(f"Pump ON count: {len(df[df['pump'] == 1])}")
report.append(f"Pump OFF count: {len(df[df['pump'] == 0])}")
report.append("Soil moisture stats when pump is 1:")
report.append(str(df[df['pump'] == 1]['soil'].describe()))
report.append("Soil moisture stats when pump is 0:")
report.append(str(df[df['pump'] == 0]['soil'].describe()))

# Analyze Light
# Let's see the range of lux when light is 1 vs 0
report.append("\n=== LIGHT LOGIC ===")
report.append(f"Light ON count: {len(df[df['light'] == 1])}")
report.append(f"Light OFF count: {len(df[df['light'] == 0])}")
report.append("Lux stats when light is 1:")
report.append(str(df[df['light'] == 1]['lux'].describe()))
report.append("Lux stats when light is 0:")
report.append(str(df[df['light'] == 0]['lux'].describe()))

# Check threshold correlation
# Check if there is a sharp threshold or noise
# Let's check if we can define clean rules:
# Fan = 1 if temp >= 30 else 0
# Pump = 1 if soil <= 50 else 0
# Light = 1 if lux <= 200 else 0
# Let's count accuracy of these rules on existing dataset:
df['rule_fan'] = (df['temp'] >= 30.0).astype(int)
df['rule_pump'] = (df['soil'] <= 50.0).astype(int)
df['rule_light'] = (df['lux'] <= 200.0).astype(int)

fan_acc = (df['rule_fan'] == df['fan']).mean() * 100
pump_acc = (df['rule_pump'] == df['pump']).mean() * 100
light_acc = (df['rule_light'] == df['light']).mean() * 100

report.append("\n=== ACCURACY OF SIMPLE DETERMINISTIC RULES ON ORIGINAL DATASET ===")
report.append(f"Fan rule (temp >= 30): {fan_acc:.2f}% match")
report.append(f"Pump rule (soil <= 50): {pump_acc:.2f}% match")
report.append(f"Light rule (lux <= 200): {light_acc:.2f}% match")

# Let's check some examples of mismatches for light
mismatch_light = df[df['rule_light'] != df['light']]
report.append(f"\nNumber of light mismatches: {len(mismatch_light)}")
report.append("Some light mismatches:")
report.append(str(mismatch_light[['temp', 'hum', 'soil', 'lux', 'light', 'rule_light']].head(20)))

with open('result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(report))

print("Done writing to result.txt")
