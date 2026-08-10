#import pandas as pd
#
## Read the CSV file
#df = pd.read_csv("fsaaendu.csv")
#
## Apply rounding to numeric columns
#df = df.apply(lambda col: col.round(4) if col.dtype.kind in 'fc' else col)
#
## Save back to CSV
#df.to_csv("FSAA25_EnduranceRounded.csv", index=False)
#

import pandas as pd

# Step 1: Load CSV while replacing ; with ,
with open("fsaaendu.csv", "r") as f:
    content = f.read().replace(";", ",")  # replace semicolons with commas

with open("temp.csv", "w") as f:
    f.write(content)

# Step 2: Read into pandas
df = pd.read_csv("temp.csv")

# Step 3: Try to convert all values to numbers if possible, then round
def try_round(x):
    try:
        return round(float(x), 4)
    except:
        return x  # keep as is if not numeric

df = df.applymap(try_round)

# Step 4: Save cleaned CSV
df.to_csv("FSAA25_EnduranceRounded.csv", index=False)
