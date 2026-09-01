import os

org_file = r"d:\Vritan\backend\routers\organization.py"
temp_file = r"d:\Vritan\backend\routers\temp_branch_api.py"

with open(temp_file, "r") as f:
    content = f.read()

with open(org_file, "a") as f:
    f.write("\n" + content + "\n")

print("Appended successfully")
