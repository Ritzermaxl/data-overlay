from asammdf import MDF
import argparse
from os import path
import re

def log(*messages):
  if args.verbose:
    print(*messages)

parser = argparse.ArgumentParser(prog = 'data-overlay preprocessing')
parser.add_argument('filename')
parser.add_argument('-v', '--verbose', action='store_true')
parser.add_argument('-c', '--channel', action='append', nargs='+')
parser.add_argument('-s', '--start-time', type=float, default=0)
parser.add_argument('-e', '--end-time', type=float, default=-1)
parser.add_argument('-r', '--sample-rate', type=int, default=24)
parser.add_argument('-o', '--output', type=str, default='output')

args = parser.parse_args()


log("Verbose mode is ON")
log("Filename: ", args.filename)
log("Channel: ", args.channel)
log("Start time: ", args.start_time)
log("End time: ", args.end_time)
log("Sample rate: ", args.sample_rate)
log("Output: ", args.output)

# reduce array of arrays with strings to a single array with strings
channel_names = []
for channel in args.channel:
  for name in channel:
    channel_names.append(name)

log("Channel names: ", channel_names)


def get_channel_list(mdf):
  mdf_info = mdf.info()
  channel_names = list()
  for x, y in mdf_info.items():
    if isinstance(y, dict):
      xxx = y.get("channel 1")
      start_index = xxx.find("\"")
      end_index = xxx.find("\"", start_index + 1)
      quote = xxx[start_index + 1: end_index]
      channel_names.append(quote)
  return channel_names

def get_potential_signals(channel_name, mdf_chn_lst):
  relevant_signals = []
  p = re.compile('^[A-Za-z0-9_]{0,}' + channel_name + '[A-Za-z0-9_]{0,}$')
  temp_list = [s for s in mdf_chn_lst if p.match(s)]
  relevant_signals = relevant_signals + temp_list
  return relevant_signals

# check on filesystem if file exists
if not path.exists(args.filename):
  print("ERROR: MDF input file '", args.filename, "' does not exist!")
  exit(1)

mdf = MDF(args.filename)

start_time = args.start_time
end_time = args.end_time
sample_rate = args.sample_rate

all_channel_list = get_channel_list(mdf)

for channel_name in channel_names:
  if channel_name in all_channel_list:
    if args.verbose:
      log(channel_name, "is in the list")
  else:
    alternative_signals = get_potential_signals(channel_name, all_channel_list)
    print("ERROR: '", channel_name, "' is NOT present in the MDF file")
    if args.verbose:
      log("Instead these are found:")
      for alternative_signal in alternative_signals:
        log(alternative_signal)
    exit(1)

delta_t_list = []
for channel_name in channel_names:
    timestamps = mdf.get(channel_name).timestamps
    delta_t = (timestamps[-1] - timestamps[0]) / timestamps.size
    delta_t_list.append(round(delta_t, 4))
min_delta_t = min(delta_t_list)
log("Minimum delta t: ", min_delta_t)


log("Filtering channels")
mdf = mdf.filter(channel_names)

log("Resampling to minimum delta t")
mdf = mdf.resample(raster=min_delta_t)

log("Trimming start and end time")
if end_time == -1:
  #log("End time not specified, using max time of ", end_time)
  mdf = mdf.cut(start=start_time)
else:
  mdf = mdf.cut(start=start_time, stop=end_time)
log("Resampling to ", sample_rate, "Hz")
mdf = mdf.resample(raster=1/sample_rate)

log("Exporting to ", args.output)
mf4_filename = args.output + ".mf4"
csv_filename = args.output + ".csv"
mdf.export(fmt='csv', filename=csv_filename, single_time_base=True, overwrite=True)
log("Done exporting csv")
mdf.save(mf4_filename, overwrite=True)
log("Done exporting mf4")
