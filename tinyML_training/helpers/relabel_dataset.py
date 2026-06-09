import csv
import os

def relabel_csv(file_path):
    temp_file = file_path + '.tmp'
    
    with open(file_path, 'r', newline='') as infile, open(temp_file, 'w', newline='') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        header = next(reader)
        writer.writerow(header) # Write header
        
        # columns: temp,hum,soil,lux,fan,light,pump
        for row in reader:
            if not row:
                continue
            temp = float(row[0])
            hum = float(row[1])
            soil = float(row[2])
            lux = float(row[3])
            
            # Enforce clean thresholds
            # Fan: ON if Temp >= 30.0 else OFF
            new_fan = 1 if temp >= 30.0 else 0
            
            # Light: ON if Lux <= 200.0 else OFF
            new_light = 1 if lux <= 200.0 else 0
            
            # Pump: ON if Soil <= 50.0 else OFF
            new_pump = 1 if soil <= 50.0 else 0
            
            writer.writerow([temp, hum, soil, lux, new_fan, new_light, new_pump])
            
    # Replace old file with new file
    os.replace(temp_file, file_path)
    print(f"Successfully relabeled dataset at {file_path}")

if __name__ == '__main__':
    csv_path = 'dataset_tinyml_10000.csv'
    relabel_csv(csv_path)
