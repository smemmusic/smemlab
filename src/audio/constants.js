// Audio constants and dB/linear converters.

export const DB_FLOOR = -48;
export const ENV_PEAK_BOOST_DB = 48;   // dB boost above amp at envelope peak (true dB addition via series)

export function dbToLin(db) {
  return db <= -80 ? 0.00001 : Math.pow(10, db / 20);
}

export function linToDb(l) {
  return 20 * Math.log10(Math.max(l, 1e-6));
}

export function volToGain(v) {
  return (v / 100) * 0.55;
}
