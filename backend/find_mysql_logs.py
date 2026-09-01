import os
import json

data_dir = r"c:\xampp\mysql\data"
results = {}

for f in os.listdir(data_dir):
    if f.lower().endswith(".err") or f.lower().endswith(".log"):
        path = os.path.join(data_dir, f)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                lines = file.readlines()
                results[f] = [line.strip() for line in lines[-100:]]
        except Exception as e:
            results[f] = f"ERROR reading file: {e}"

with open("mysql_logs_details.json", "w", encoding="utf-8") as file:
    json.dump(results, file, indent=2)
print("Wrote mysql_logs_details.json")
