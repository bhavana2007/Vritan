import os

admin_file = r"d:\Vritan\backend\routers\admin.py"
temp_file = r"d:\Vritan\backend\routers\temp_admin_api.py"

with open(temp_file, "r") as f:
    content = f.read()

with open(admin_file, "a") as f:
    f.write("\n" + content + "\n")

print("Appended successfully")
