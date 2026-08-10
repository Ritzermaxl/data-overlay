import os

# Path to your folder
folder = "./FSAAEndu/"

# List all files ending with .png
files = [f for f in os.listdir(folder) if f.endswith(".png")]

# Extract numbers from filenames (assuming format 000000.png)
numbers = sorted(int(f.split(".")[0]) for f in files)

missing = []
for i in range(numbers[0], numbers[-1] + 1):
    if i not in numbers:
        missing.append(f"{i:06d}.png")

if missing:
    print("Missing files:")
    for m in missing:
        print(m)
else:
    print("No files missing.")
