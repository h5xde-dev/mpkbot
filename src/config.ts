export const scheduleUrl =
  'https://xn--80agvfr.xn--p1ai/students/schedule/teachers_schedule/open_json.php';

export const callbackShowSchedule = 'scheduller';

export const httpTimeoutMs = 30_000;
export const teachersCacheTtlMs = 24 * 60 * 60 * 1000;
export const sendRetryDelayMs = 2_000;
export const sendMaxRetries = 3;

export const usersFile = 'secret/users.json';
export const teachersCacheFile = 'secret/teachers.json';

export const dailyBroadcastStartDate = new Date('2025-01-01T00:00:00');
export const dailyBroadcastFrequencyDays = 1;
