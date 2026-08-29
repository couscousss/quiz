/**
 * Singapore time helper.
 *
 * Singapore is permanently UTC+8 with no daylight saving, so a fixed offset is
 * exact all year — no Intl/timezone-database dependency needed in the Worker.
 */
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Current Singapore time as "HH:MM:SS". */
export function sgTimeHHMMSS() {
  return new Date(Date.now() + SGT_OFFSET_MS).toISOString().substr(11, 8);
}

/** Current Singapore date and time as "DD Mon, HH:MM:SS". */
export function sgDateTime() {
  const d = new Date(Date.now() + SGT_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ', ' + d.toISOString().substr(11, 8);
}
