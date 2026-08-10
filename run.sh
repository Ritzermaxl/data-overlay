#Ensure the folder exists

# Run the render directly into RAM
pnpm run parallel-render -i FSAA25_EnduranceRounded.csv -c config.yml -o FSAAEndu

# Once done, combine them with ffmpeg from the RAM disk
ffmpeg -framerate 60 -i FSAAEndu/%06d.png -c:v libx264 -pix_fmt yuv420p final_overlay.mp4

# Don't forget to delete the PNGs from RAM to free up memory!
