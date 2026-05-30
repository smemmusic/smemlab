// Audio constants and dB/linear converters.

export const DB_FLOOR = -48;
export const ENV_PEAK_BOOST_DB = 48;   // dB boost above amp at envelope peak (true dB addition via series)

// How much filter cutoff modulation 100% LFO depth corresponds to.
// The LFO outputs a normalised ±depth signal so it can patch into any
// destination (pitch, amplitude, cutoff, …); each destination scales it to
// its own units. The filter cutoff scales it to ±this many Hz.
export const CUTOFF_MOD_RANGE_HZ = 2400;

export function dbToLin(db) {
  return db <= -80 ? 0.00001 : Math.pow(10, db / 20);
}

export function linToDb(l) {
  return 20 * Math.log10(Math.max(l, 1e-6));
}

export function volToGain(v) {
  return (v / 100) * 0.55;
}
