import pandas as pd
import numpy as np

# Load dataset
df = pd.read_csv('dataset_tinyml_10000.csv')
print("Total rows:", len(df))
print(df.head())

# Look at light rules
print("\nLight column value counts:")
print(df['light'].value_counts())

print("\nLux stats when light is 1:")
print(df[df['light'] == 1]['lux'].describe())

print("\nLux stats when light is 0:")
print(df[df['light'] == 0]['lux'].describe())

# Check if there are any rows with low lux but light is 0
low_lux_light_0 = df[(df['lux'] < 200) & (df['light'] == 0)]
print(f"\nNumber of rows with lux < 200 and light == 0: {len(low_lux_light_0)}")
if len(low_lux_light_0) > 0:
    print(low_lux_light_0.head(10))

# Check correlation/relationship between lux and light
print("\nRelationship between lux range and light status:")
for lux_threshold in [10, 50, 100, 200, 500, 1000]:
    total_under = len(df[df['lux'] < lux_threshold])
    light_on_under = len(df[(df['lux'] < lux_threshold) & (df['light'] == 1)])
    pct = (light_on_under / total_under * 100) if total_under > 0 else 0
    print(f"Lux < {lux_threshold:4d}: {light_on_under:5d} / {total_under:5d} ({pct:.1f}% have light ON)")
